import "server-only";

import { supabaseAdmin } from "./supabaseAdmin";
import {
  COLLEGE_EMAIL_DOMAIN,
  isCohort,
  normalizeEmail,
  type Cohort,
} from "./cohorts";

/**
 * ============================================================================
 *  THE CSE DEPARTMENT ROSTER — who may sign in, and as what.
 * ============================================================================
 *
 *  Lives in public.access_grants and is edited from the admin console's Access
 *  page, so adding a student no longer needs a code change or a redeploy.
 *  Every gate (the proxy, the API guards, the extension) asks this module.
 *
 *  A student's year decides which leaderboard they compete on, which shared
 *  resources they can see, and which year the admin console shows them under.
 *
 *  DO NOT DERIVE THE YEAR FROM THE ROLL NUMBER
 *  -------------------------------------------
 *  The USN prefix does not indicate academic year. Lateral-entry students join
 *  2nd year with the next batch's prefix, and a repeater keeps their original
 *  prefix in the year below. Only the lecturer knows, so the lists are manual.
 *
 *  THE YEARLY ROLLOVER (once each August)
 *  --------------------------------------
 *  On the Access page, paste the 3rd-year list into 4th Year, then the
 *  2nd-year list into 3rd Year — adding a student to a year moves them out of
 *  their old one. Remove the graduating batch, then paste the new 2nd years.
 *
 *  RULES
 *  -----
 *  - A student needs an @mite.ac.in address and a place in exactly one year.
 *  - An admin is staff, not a student, and has no year.
 *  - If the table cannot be read, everyone is denied until it can — the safe
 *    direction to fail, since there is no hardcoded fallback list.
 * ============================================================================
 */

export type Role = "admin" | "student";

export interface Grant {
  email: string;
  role: Role;
  /** Null for admins; the year for students. */
  cohort: Cohort | null;
}

export interface Access {
  isAdmin: boolean;
  /** The student's year. Null for admins and for anyone not on the roster. */
  cohort: Cohort | null;
}

const TABLE = "access_grants";

/**
 * A short per-instance cache of "the grants for this email".
 *
 * A protected navigation hits the proxy and then several API guards, each of
 * which asks this question. Serverless instances are short-lived, so this only
 * collapses repeats within one instance and expires fast enough that a roster
 * change is visible everywhere within seconds. Writes bust it immediately.
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; grants: Grant[] }>();

function invalidate(email: string): void {
  cache.delete(email);
}

async function getGrantsForEmail(email: string): Promise<Grant[]> {
  if (!email) return [];

  const hit = cache.get(email);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.grants;

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("email, role, cohort")
    .eq("email", email);

  if (error) {
    // Not cached, so access comes back the moment the table is readable.
    console.error("[roster] Could not read access grants; denying:", error.message);
    return [];
  }

  const grants: Grant[] = [];
  for (const row of (data || []) as { role: string; cohort: string | null }[]) {
    if (row.role === "admin") grants.push({ email, role: "admin", cohort: null });
    // A student row whose year is no longer a real cohort grants nothing.
    else if (row.role === "student" && isCohort(row.cohort)) {
      grants.push({ email, role: "student", cohort: row.cohort });
    }
  }

  cache.set(email, { at: Date.now(), grants });
  return grants;
}

/** Whether this address belongs to the college at all. */
export function isCollegeEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email).endsWith(`@${COLLEGE_EMAIL_DOMAIN}`);
}

/** Everything a gate needs to know about one address, from one cached read. */
export async function getAccess(email: string | null | undefined): Promise<Access> {
  const normalized = normalizeEmail(email);
  const grants = await getGrantsForEmail(normalized);
  const isAdmin = grants.some((g) => g.role === "admin");
  const student = grants.find((g) => g.role === "student");
  return {
    isAdmin,
    cohort: !isAdmin && student && isCollegeEmail(normalized) ? student.cohort : null,
  };
}

/** Every student address in one year, lowercased. Used to scope DB queries. */
export async function emailsForCohort(cohort: Cohort): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("email")
    .eq("role", "student")
    .eq("cohort", cohort);

  if (error) throw new Error(`Could not read the ${cohort} roster: ${error.message}`);
  return (data || []).map((r: { email: string }) => normalizeEmail(r.email)).filter(Boolean);
}

/* ── Writes, for the Access page ─────────────────────────────────────────── */

export interface GrantRow extends Grant {
  granted_by: string | null;
  created_at: string;
}

export async function listGrants(): Promise<GrantRow[]> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("email, role, cohort, granted_by, created_at")
    .order("email", { ascending: true });

  if (error) throw new Error(`Could not load the roster: ${error.message}`);
  return (data || []) as GrantRow[];
}

export type AddOutcome =
  | { ok: true; movedFrom?: Cohort }
  | { ok: false; reason: string };

/**
 * Adds one grant. Adding a student who is already in another year moves them,
 * which is what the yearly rollover is. The caller has already checked that
 * the actor is an admin.
 */
export async function addGrant(
  input: { email: string; role: Role; cohort: Cohort | null },
  actorEmail: string,
): Promise<AddOutcome> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, reason: "Empty address" };

  if (input.role === "student" && (!input.cohort || !isCollegeEmail(email))) {
    return { ok: false, reason: `Not an @${COLLEGE_EMAIL_DOMAIN} address` };
  }

  invalidate(email);
  const existing = await getGrantsForEmail(email);
  const asStudent = existing.find((g) => g.role === "student");

  if (input.role === "admin") {
    if (existing.some((g) => g.role === "admin")) return { ok: false, reason: "Already an admin" };
    if (asStudent) return { ok: false, reason: `A student in ${asStudent.cohort} — remove them first` };
  } else {
    if (existing.some((g) => g.role === "admin")) return { ok: false, reason: "Already an admin" };
    if (asStudent?.cohort === input.cohort) return { ok: false, reason: `Already in ${input.cohort}` };
    if (asStudent) {
      const { error } = await supabaseAdmin
        .from(TABLE)
        .delete()
        .eq("email", email)
        .eq("role", "student");
      if (error) return { ok: false, reason: "Could not move them" };
    }
  }

  const { error } = await supabaseAdmin.from(TABLE).insert({
    email,
    role: input.role,
    cohort: input.role === "admin" ? null : input.cohort,
    granted_by: normalizeEmail(actorEmail) || null,
  });
  invalidate(email);

  if (error) {
    console.error("[roster] addGrant failed:", error.message);
    return { ok: false, reason: "Could not save" };
  }
  return asStudent?.cohort ? { ok: true, movedFrom: asStudent.cohort } : { ok: true };
}

/** Revokes one grant. Their workspace and history stay, so re-adding restores them. */
export async function removeGrant(email: string, role: Role): Promise<void> {
  const normalized = normalizeEmail(email);
  const { error } = await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq("email", normalized)
    .eq("role", role);
  invalidate(normalized);
  if (error) throw new Error(`Could not remove that grant: ${error.message}`);
}

/** How many admins exist. Guards the last-admin case. */
export async function adminCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(TABLE)
    .select("email", { count: "exact", head: true })
    .eq("role", "admin");
  // On a bad read, report one so the delete is refused rather than risk
  // removing a genuine last admin.
  if (error) return 1;
  return count ?? 0;
}
