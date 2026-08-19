/**
 * Cohort vocabulary shared by the browser and the server.
 *
 * This file deliberately holds NO email addresses — it is safe to import from
 * client components. The roster itself lives in `roster.ts`, which is
 * server-only so that student email addresses never reach the JS bundle.
 */

/** The CSE department runs from 2nd year onward, so there is no 1st-year cohort. */
export const COHORTS = ['2nd Year', '3rd Year', '4th Year'] as const;

export type Cohort = (typeof COHORTS)[number];

/** Only college Google accounts may sign in. */
export const COLLEGE_EMAIL_DOMAIN = 'mite.ac.in';

/**
 * Shared-resource tag meaning "every year should see this" — department
 * handbooks, exam calendars, and the like.
 */
export const SHARED_RESOURCE_TAG = 'Others';

/** Every tag a shared resource may carry: one per cohort, plus the shared shelf. */
export const RESOURCE_TAGS = [...COHORTS, SHARED_RESOURCE_TAG] as const;

export type ResourceTag = Cohort | typeof SHARED_RESOURCE_TAG;

export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function isCohort(value: unknown): value is Cohort {
  return typeof value === 'string' && (COHORTS as readonly string[]).includes(value);
}

/**
 * Coerces a stored `year` value into a tag we still recognise.
 *
 * Resources uploaded before cohort isolation carry free-form tags, including
 * the retired '1st Year'. Folding anything unrecognised into the shared shelf
 * keeps those uploads visible instead of orphaning them behind a tag no
 * student can ever match.
 */
export function resolveResourceTag(year: unknown): ResourceTag {
  return isCohort(year) ? year : SHARED_RESOURCE_TAG;
}

/** Whether a student in `cohort` is allowed to see a resource tagged `year`. */
export function cohortCanSeeResource(cohort: Cohort, year: unknown): boolean {
  const tag = resolveResourceTag(year);
  return tag === cohort || tag === SHARED_RESOURCE_TAG;
}

/** "2nd Year" → "2nd Yr", for tight spaces like table headers and chips. */
export function shortCohortLabel(cohort: Cohort): string {
  return cohort.replace('Year', 'Yr');
}
