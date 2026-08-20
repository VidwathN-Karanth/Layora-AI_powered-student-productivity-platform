/**
 * One date format for the whole site: dd/mm/yyyy.
 *
 * `toLocaleDateString()` with no locale follows whatever the browser is set to,
 * so the same page could read 20/08/2026 for one student and 8/20/2026 for
 * another. Everything user-facing goes through here instead.
 *
 * Date-only values ('YYYY-MM-DD') are parsed from their calendar fields rather
 * than handed to `new Date(str)`, which treats them as UTC midnight and lands
 * on the previous day in IST.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type DateInput = Date | string | number | null | undefined;

/** Coerces any accepted input to a Date, or null when it is not a real date. */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** dd/mm/yyyy — the site-wide date format. */
export function formatDate(value: DateInput, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** dd/mm/yyyy, HH:MM — 24-hour unless `hour12` is asked for. */
export function formatDateTime(value: DateInput, options: { hour12?: boolean } = {}, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;

  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (options.hour12) {
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${formatDate(d)}, ${h12}:${minutes} ${suffix}`;
  }

  return `${formatDate(d)}, ${String(hours).padStart(2, '0')}:${minutes}`;
}

/** "Thursday, 20/08/2026" — for a heading that names one day. */
export function formatLongDate(value: DateInput, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${WEEKDAYS[d.getDay()]}, ${formatDate(d)}`;
}

/** "Thu 20/08" — for tight spaces like a header clock. */
export function formatShortDate(value: DateInput, fallback = '—'): string {
  const d = toDate(value);
  if (!d) return fallback;
  const weekday = WEEKDAYS[d.getDay()].slice(0, 3);
  return `${weekday} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "August 2026" — a month heading is a name, not a number. */
export function formatMonthLabel(value: DateInput, fallback = ''): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 'YYYY-MM-DD' from local calendar fields — the key format used for storage. */
export function toDateKey(value: DateInput): string {
  const d = toDate(value) || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
