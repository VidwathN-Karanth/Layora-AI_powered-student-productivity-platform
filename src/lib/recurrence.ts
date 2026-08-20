/**
 * Repeating calendar entries.
 *
 * A weekly seminar is one row in the database, not fifty-two. The stored row
 * carries a rule and an optional end date, and the occurrences are worked out
 * here whenever a range of the calendar is drawn — so changing or deleting the
 * series is one operation, and the events table does not grow with the term.
 *
 * Everything here uses local calendar fields. `toISOString` reports the
 * previous day in IST before 05:30, which would file an occurrence on the
 * wrong date.
 */

export const REPEAT_RULES = ['none', 'daily', 'weekly', 'monthly'] as const;

export type RepeatRule = (typeof REPEAT_RULES)[number];

export const REPEAT_LABEL: Record<RepeatRule, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
};

export function isRepeatRule(value: unknown): value is RepeatRule {
  return typeof value === 'string' && (REPEAT_RULES as readonly string[]).includes(value);
}

/** A runaway rule with no end date would still be bounded by this. */
export const MAX_OCCURRENCES = 400;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

/** 'YYYY-MM-DD' from local calendar fields. */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' to a local midnight Date, avoiding the UTC parse of `new Date(str)`. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface RepeatingEntry {
  eventDate: string; // the first occurrence
  repeat?: RepeatRule | null;
  repeatUntil?: string | null;
}

/**
 * Every date this entry falls on within [rangeStart, rangeEnd], inclusive.
 *
 * Monthly repeats keep the day-of-month and skip months that do not have it —
 * a 31st entry appears in March and May but not in April, which is what a
 * person means by "the 31st of every month" and avoids silently sliding the
 * event onto the 1st.
 */
export function occurrencesInRange(
  entry: RepeatingEntry,
  rangeStart: string,
  rangeEnd: string
): string[] {
  const rule = entry.repeat && isRepeatRule(entry.repeat) ? entry.repeat : 'none';

  if (!isDateKey(entry.eventDate)) return [];
  if (rangeEnd < rangeStart) return [];

  // A one-off is simply in range or it is not.
  if (rule === 'none') {
    return entry.eventDate >= rangeStart && entry.eventDate <= rangeEnd ? [entry.eventDate] : [];
  }

  // The series never starts before its first occurrence, and never runs past
  // its own end date.
  const hardEnd =
    entry.repeatUntil && isDateKey(entry.repeatUntil) && entry.repeatUntil < rangeEnd
      ? entry.repeatUntil
      : rangeEnd;
  if (hardEnd < entry.eventDate || hardEnd < rangeStart) return [];

  const first = fromKey(entry.eventDate);
  const dates: string[] = [];

  if (rule === 'monthly') {
    const dayOfMonth = first.getDate();
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);

    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), dayOfMonth);
      // Rolled into the next month, so this month is too short for that day.
      const exists = candidate.getMonth() === cursor.getMonth();
      const key = toKey(candidate);

      if (exists && key > hardEnd) break;
      if (exists && key >= entry.eventDate && key >= rangeStart) dates.push(key);

      cursor.setMonth(cursor.getMonth() + 1);
      if (toKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) > hardEnd) break;
    }
    return dates;
  }

  const stepDays = rule === 'daily' ? 1 : 7;
  const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate());

  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const key = toKey(cursor);
    if (key > hardEnd) break;
    if (key >= rangeStart) dates.push(key);
    cursor.setDate(cursor.getDate() + stepDays);
  }

  return dates;
}

/** Whether the entry falls on one specific day. */
export function occursOn(entry: RepeatingEntry, date: string): boolean {
  return occurrencesInRange(entry, date, date).length > 0;
}

/**
 * Expands a list of entries into per-date buckets across a range.
 *
 * The calendar grid draws from this, so a weekly seminar shows on every one of
 * its Tuesdays without a row per week existing anywhere.
 */
export function expandByDate<T extends RepeatingEntry>(
  entries: T[],
  rangeStart: string,
  rangeEnd: string
): Map<string, T[]> {
  const byDate = new Map<string, T[]>();

  for (const entry of entries) {
    for (const date of occurrencesInRange(entry, rangeStart, rangeEnd)) {
      const list = byDate.get(date) || [];
      list.push(entry);
      byDate.set(date, list);
    }
  }

  return byDate;
}
