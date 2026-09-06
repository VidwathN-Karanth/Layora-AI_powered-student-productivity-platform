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

/**
 * A document name reduced to the form two uploads are compared on.
 *
 * Case and stray spacing are not a meaningful difference between two documents
 * in a shared library — "Unit 1 Notes", "unit 1 notes" and "Unit  1  Notes"
 * are one title as far as a student scanning the list is concerned, so they
 * are treated as one here.
 */
export function normalizeResourceName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Whether two resource tags ever appear in the same list.
 *
 * Two years never see each other, so 2nd Year and 3rd Year may each hold their
 * own "Unit 1 Notes" without confusing anyone. The shared shelf is different:
 * it shows up in every cohort's library, so it collides with all of them.
 */
export function resourceTagsOverlap(a: unknown, b: unknown): boolean {
  const left = resolveResourceTag(a);
  const right = resolveResourceTag(b);
  return left === right || left === SHARED_RESOURCE_TAG || right === SHARED_RESOURCE_TAG;
}

/**
 * The existing resource that would make `name` ambiguous, if there is one.
 *
 * Only counts a clash where the two would be visible together — see
 * `resourceTagsOverlap`. Returns the offender rather than a boolean so the
 * caller can say who already holds the name.
 */
export function findResourceNameClash<T extends { name: string; year?: unknown }>(
  resources: readonly T[],
  name: string,
  year: unknown
): T | undefined {
  const wanted = normalizeResourceName(name);
  if (!wanted) return undefined;

  return resources.find(
    (r) => normalizeResourceName(r.name) === wanted && resourceTagsOverlap(r.year, year)
  );
}

/** "2nd Year" → "2nd Yr", for tight spaces like table headers and chips. */
export function shortCohortLabel(cohort: Cohort): string {
  return cohort.replace('Year', 'Yr');
}
