import 'server-only';

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

import { isAdminEmail } from './admin';
import { COHORTS, isCohort, type Cohort } from './cohorts';
import { getCohortForEmail, isCollegeEmail } from './roster';

export type AccessDenialReason = 'signed_out' | 'wrong_domain' | 'not_on_roster';

export interface Requester {
  userId: string;
  email: string;
  /** Display name from the Google account. Never taken from client input. */
  name: string;
  isAdmin: boolean;
  /** Null for admins (who are not students) and for anyone off the roster. */
  cohort: Cohort | null;
  allowed: boolean;
  denialReason: AccessDenialReason | null;
}

/**
 * Resolves who is making this request and whether they are allowed in at all.
 *
 * Admins bypass the roster: they are staff, not students, so they have no
 * cohort and are never expected to appear in a year list.
 */
export async function getRequester(): Promise<Requester | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const name = user?.fullName || user?.firstName || email.split('@')[0] || 'Student';

  if (isAdminEmail(email)) {
    return { userId, email, name, isAdmin: true, cohort: null, allowed: true, denialReason: null };
  }

  if (!isCollegeEmail(email)) {
    return { userId, email, name, isAdmin: false, cohort: null, allowed: false, denialReason: 'wrong_domain' };
  }

  const cohort = getCohortForEmail(email);
  if (!cohort) {
    return { userId, email, name, isAdmin: false, cohort: null, allowed: false, denialReason: 'not_on_roster' };
  }

  return { userId, email, name, isAdmin: false, cohort, allowed: true, denialReason: null };
}

type Guard<T> = { ok: true; requester: T } | { ok: false; response: NextResponse };

function deny(status: number, error: string, reason?: AccessDenialReason): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error, reason }, { status }) };
}

/** Requires a signed-in admin. */
export async function requireAdmin(): Promise<Guard<Requester>> {
  const requester = await getRequester();
  if (!requester) return deny(401, 'Unauthorized', 'signed_out');
  if (!requester.isAdmin) return deny(401, 'Unauthorized admin access');
  return { ok: true, requester };
}

/**
 * Requires a signed-in student who is on the roster. The returned cohort is
 * non-null, and it is derived from the session — never from a query parameter —
 * so a student cannot ask for another year's data.
 */
export async function requireStudent(): Promise<Guard<Requester & { cohort: Cohort }>> {
  const requester = await getRequester();
  if (!requester) return deny(401, 'Unauthorized', 'signed_out');

  if (requester.isAdmin) {
    return deny(403, 'Admins use the admin console, not the student workspace.');
  }
  if (requester.denialReason === 'wrong_domain') {
    return deny(403, 'Layora is open only to college accounts.', 'wrong_domain');
  }
  if (!requester.cohort) {
    return deny(403, 'Your email is not on the department roster yet.', 'not_on_roster');
  }

  return { ok: true, requester: { ...requester, cohort: requester.cohort } };
}

/**
 * Requires a signed-in admin AND an explicit, valid `?cohort=` parameter.
 *
 * The admin console shows one year at a time, so every admin data route must
 * say which year it means. A missing or bogus value is a bug, not a request
 * for everything — hence 400 rather than a silent department-wide result.
 */
export async function requireAdminCohort(url: string): Promise<Guard<Requester & { cohort: Cohort }>> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const raw = new URL(url).searchParams.get('cohort');
  if (!isCohort(raw)) {
    return deny(400, `Missing or invalid "cohort" parameter. Expected one of: ${COHORTS.join(', ')}.`);
  }

  return { ok: true, requester: { ...guard.requester, cohort: raw } };
}
