/**
 * Certificate vocabulary shared by the browser and the server.
 *
 * Students file every certificate under exactly one of these, and the admin
 * console reports on them one bucket at a time — so the list has to be short,
 * closed, and identical on both sides. A matching CHECK constraint on
 * `certificates.category` keeps the database honest too.
 */

export const CERTIFICATE_CATEGORIES = ['NPTEL', 'Course', 'Competitions'] as const;

export type CertificateCategory = (typeof CERTIFICATE_CATEGORIES)[number];

export function isCertificateCategory(value: unknown): value is CertificateCategory {
  return typeof value === 'string' && (CERTIFICATE_CATEGORIES as readonly string[]).includes(value);
}

/** What each bucket is for, shown under the picker so students file correctly. */
export const CATEGORY_HINTS: Record<CertificateCategory, string> = {
  NPTEL: 'NPTEL / SWAYAM course completion certificates.',
  Course: 'Online courses and skill badges — Coursera, Udemy, HackerRank, and the like.',
  Competitions: 'Hackathons, coding contests, and technical fests.',
};

/**
 * Per-category accent classes for the student workspace, which uses the
 * themed Material tokens rather than raw colours.
 */
export const CATEGORY_ACCENT: Record<CertificateCategory, string> = {
  NPTEL: 'border-orange-500/30 text-orange-400 bg-orange-500/5',
  Course: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
  Competitions: 'border-purple-500/30 text-purple-400 bg-purple-500/5',
};

/** The same three accents for the admin console's darker, flatter panels. */
export const CATEGORY_ADMIN_ACCENT: Record<CertificateCategory, string> = {
  NPTEL: 'border-orange-400/25 text-orange-300 bg-orange-400/10',
  Course: 'border-sky-400/25 text-sky-300 bg-sky-400/10',
  Competitions: 'border-purple-400/25 text-purple-300 bg-purple-400/10',
};

/**
 * Folds a stored value into a category we still recognise.
 *
 * Nothing should fail to match — the column is constrained — but the admin
 * grouping must never silently drop a student's certificate, so anything
 * unexpected lands in `Course` rather than vanishing.
 */
export function resolveCategory(value: unknown): CertificateCategory {
  return isCertificateCategory(value) ? value : 'Course';
}

/** How many certificates sit in each bucket. Always has all three keys, so a
 *  category nobody has used still reports a 0 rather than going missing. */
export function countByCategory(items: { category: string }[]): Record<CertificateCategory, number> {
  const counts = Object.fromEntries(
    CERTIFICATE_CATEGORIES.map((c) => [c, 0])
  ) as Record<CertificateCategory, number>;

  for (const item of items) {
    counts[resolveCategory(item.category)] += 1;
  }
  return counts;
}

/** Splits a list of certificates into the three buckets, in display order. */
export function groupByCategory<T extends { category: string }>(
  items: T[]
): { category: CertificateCategory; items: T[] }[] {
  return CERTIFICATE_CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => resolveCategory(item.category) === category),
  }));
}
