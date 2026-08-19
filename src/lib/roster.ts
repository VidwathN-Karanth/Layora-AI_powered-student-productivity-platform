import "server-only";

import {
  COHORTS,
  COLLEGE_EMAIL_DOMAIN,
  normalizeEmail,
  type Cohort,
} from "./cohorts";

/**
 * ============================================================================
 *  THE CSE DEPARTMENT ROSTER — this is the file the lecturer edits.
 * ============================================================================
 *
 *  Everything else in Layora is derived from this list. A student's email
 *  decides which leaderboard they compete on, which shared resources they can
 *  see, and which year the admin console shows them under. Nothing about a
 *  cohort is stored in the database, so editing this file is the only step
 *  needed to move someone between years.
 *
 *  HOW TO ADD A STUDENT
 *  --------------------
 *  Paste their full college address into the right year's list, in quotes,
 *  with a trailing comma. Case and stray spaces do not matter. Then redeploy.
 *
 *  DO NOT TRY TO DERIVE THE YEAR FROM THE ROLL NUMBER
 *  --------------------------------------------------
 *  The USN prefix does not indicate academic year, and no amount of parsing
 *  will make it:
 *    - Lateral-entry students join directly into 2nd year carrying a '4mt25cs'
 *      prefix while sitting alongside the '4mt24cs' batch.
 *    - A student who fails and repeats a year keeps their original prefix in
 *      the year below their batch.
 *  So '4mt24cs239' being in 3rd Year is not a typo to be "corrected", and any
 *  future attempt to auto-assign or validate cohorts from the roll number
 *  would silently put real students on the wrong leaderboard. Only the
 *  lecturer knows the truth, which is exactly why these lists are manual.
 *
 *  THE YEARLY ROLLOVER (once each August)
 *  --------------------------------------
 *  1. Delete the '4th Year' list — those students have graduated.
 *  2. Move '3rd Year' → '4th Year'.
 *  3. Move '2nd Year' → '3rd Year'.
 *  4. Paste the incoming 2nd-year batch into '2nd Year'.
 *  5. Redeploy.
 *  Repeaters and lateral entrants are the exceptions to this shift — move them
 *  by hand rather than with their batch.
 *
 *  RULES ENFORCED FOR YOU
 *  ----------------------
 *  - An address must end in @mite.ac.in or the student cannot sign in at all.
 *  - An address missing from all three lists cannot sign in; they are shown a
 *    message telling them to ask you to add it. This is deliberate — it means
 *    nobody can ever end up competing outside their year.
 *  - The same address in two lists is a mistake, and the app refuses to start
 *    in development until it is fixed (see the guard at the bottom).
 *
 *  NOTE: admins (see `admin.ts`) are not students and do not belong here.
 * ============================================================================
 */
export const COHORT_ROSTER: Record<Cohort, string[]> = {
  "2nd Year": [
    // e.g. '4mt24cs001@mite.ac.in',
  ],

  "3rd Year": [
    "4mt24cs239@mite.ac.in",
    "4mt24cs130@mite.ac.in",
    "4mt24cs140@mite.ac.in",
  ],

  "4th Year": [
    // e.g. '4mt22cs001@mite.ac.in',
  ],
};

/**
 * Lowercased lookup built once at module load, so a request never scans the
 * roster linearly.
 */
const EMAIL_TO_COHORT: Map<string, Cohort> = (() => {
  const map = new Map<string, Cohort>();
  const duplicates: string[] = [];

  for (const cohort of COHORTS) {
    for (const rawEmail of COHORT_ROSTER[cohort]) {
      const email = normalizeEmail(rawEmail);
      if (!email) continue;

      const existing = map.get(email);
      if (existing && existing !== cohort) {
        duplicates.push(
          `${email} is listed under both ${existing} and ${cohort}`,
        );
        continue;
      }
      map.set(email, cohort);
    }
  }

  if (duplicates.length > 0) {
    const detail = duplicates.join("; ");
    // Fail loudly in development so the mistake is fixed before it ships. In
    // production, keep serving with the first listing rather than taking the
    // whole department offline mid-term.
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Roster error in src/lib/roster.ts — ${detail}`);
    }
    console.error(
      `[roster] Duplicate roster entries, using the first listing for each: ${detail}`,
    );
  }

  return map;
})();

/** Whether this address belongs to the college at all. */
export function isCollegeEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  return normalized.endsWith(`@${COLLEGE_EMAIL_DOMAIN}`);
}

/** The student's year, or null if they are not on the roster. */
export function getCohortForEmail(
  email: string | null | undefined,
): Cohort | null {
  return EMAIL_TO_COHORT.get(normalizeEmail(email)) ?? null;
}

/** Every roster address for one year, lowercased. Used to scope DB queries. */
export function emailsForCohort(cohort: Cohort): string[] {
  return COHORT_ROSTER[cohort].map(normalizeEmail).filter(Boolean);
}

/** How many students each year has on the roster. For admin diagnostics. */
export function rosterCounts(): Record<Cohort, number> {
  return {
    "2nd Year": emailsForCohort("2nd Year").length,
    "3rd Year": emailsForCohort("3rd Year").length,
    "4th Year": emailsForCohort("4th Year").length,
  };
}
