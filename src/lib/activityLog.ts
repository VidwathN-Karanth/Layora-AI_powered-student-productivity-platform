import { dayKey } from './pomodoro';

/**
 * The durable record of what a student got done, one row per day.
 *
 * This exists because the workspace deliberately forgets: completed tasks are
 * pruned from `tasks` the next day, and a timetable block's `completed` flag is
 * overwritten when the week regenerates. Both are right for the screens a
 * student works in — and both make a weekly report impossible to reconstruct
 * after the fact. So the moment something is finished, it is counted here.
 *
 * Deliberately a rollup, not an event stream: one small row per day keeps the
 * synced user state a few kilobytes rather than growing with every click, and
 * a report only ever asks "how much on this day", never "in what order".
 *
 * Focus minutes are NOT duplicated here — they already live in `pomodoroLog`,
 * which is the single source for anything the Zen timer produced.
 */

export interface ActivityDay {
  /** Local calendar date, 'YYYY-MM-DD'. Local, not UTC: a 1 AM session in IST belongs to that night. */
  date: string;
  /** Tasks moved into `completed` on this day. */
  tasksCompleted: number;
  /** Timetable blocks ticked off on this day. */
  blocksCompleted: number;
  /** Minutes logged against tasks on this day, from the task timer. */
  taskMinutes: number;
  /** Those same minutes split by subject, for the "where the time went" view. */
  bySubject?: Record<string, number>;
}

/**
 * How much history to keep. Four months is enough for a term's worth of weekly
 * comparisons while staying small enough to ride along in the synced state.
 */
export const ACTIVITY_RETENTION_DAYS = 120;

/** What one event contributes. Every field is optional; omitted means zero. */
export interface ActivityDelta {
  tasksCompleted?: number;
  blocksCompleted?: number;
  taskMinutes?: number;
  /** Subject the minutes belong to. Ignored when `taskMinutes` is absent or zero. */
  subject?: string | null;
}

const EMPTY: Omit<ActivityDay, 'date'> = { tasksCompleted: 0, blocksCompleted: 0, taskMinutes: 0 };

function cutoffKey(days = ACTIVITY_RETENTION_DAYS): string {
  return dayKey(new Date(Date.now() - days * 86_400_000));
}

/** A whole number, never negative, never NaN — bad input costs a count, not the log. */
function safe(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Adds one day's worth of progress, returning a new log.
 *
 * Same-day events accumulate into one row and anything past the retention
 * window is dropped, so the log cannot grow without bound.
 */
export function recordActivity(
  log: ActivityDay[] | null | undefined,
  delta: ActivityDelta,
  today: string = dayKey()
): ActivityDay[] {
  const tasksCompleted = safe(delta.tasksCompleted);
  const blocksCompleted = safe(delta.blocksCompleted);
  const taskMinutes = safe(delta.taskMinutes);

  // Nothing to record — hand back the same log rather than churning state.
  if (!tasksCompleted && !blocksCompleted && !taskMinutes) return log || [];

  const cutoff = cutoffKey();
  const kept = (log || []).filter((d) => d.date >= cutoff);
  const existing = kept.find((d) => d.date === today);

  const subject = taskMinutes && delta.subject ? String(delta.subject).slice(0, 60) : null;

  const merge = (row: ActivityDay): ActivityDay => {
    const bySubject = { ...(row.bySubject || {}) };
    if (subject) bySubject[subject] = (bySubject[subject] || 0) + taskMinutes;

    return {
      ...row,
      tasksCompleted: row.tasksCompleted + tasksCompleted,
      blocksCompleted: row.blocksCompleted + blocksCompleted,
      taskMinutes: row.taskMinutes + taskMinutes,
      ...(Object.keys(bySubject).length ? { bySubject } : {}),
    };
  };

  const updated = existing
    ? kept.map((d) => (d.date === today ? merge(d) : d))
    : [...kept, merge({ date: today, ...EMPTY })];

  return updated.sort((a, b) => a.date.localeCompare(b.date));
}

/** One day's row, or a zeroed one — callers never have to handle a gap. */
export function activityForDay(log: ActivityDay[] | null | undefined, date: string): ActivityDay {
  return (log || []).find((d) => d.date === date) || { date, ...EMPTY };
}

/**
 * Folds two logs into one, keeping the fuller record of each day.
 *
 * The cloud copy and the local copy are both monotonic counters over the same
 * calendar day, so the larger number is the one that saw more — a device that
 * recorded a session offline keeps it when the server's state arrives, and a
 * day the server knows about is not lost by a device that never saw it. Taking
 * the max also makes the merge idempotent: syncing twice cannot double a count.
 */
export function mergeActivityLogs(
  a: ActivityDay[] | null | undefined,
  b: ActivityDay[] | null | undefined
): ActivityDay[] {
  const byDate = new Map<string, ActivityDay>();

  for (const row of [...(a || []), ...(b || [])]) {
    if (!row || typeof row.date !== 'string') continue;
    const existing = byDate.get(row.date);
    if (!existing) {
      byDate.set(row.date, { ...row, bySubject: row.bySubject ? { ...row.bySubject } : undefined });
      continue;
    }

    const bySubject: Record<string, number> = { ...(existing.bySubject || {}) };
    for (const [subject, minutes] of Object.entries(row.bySubject || {})) {
      bySubject[subject] = Math.max(bySubject[subject] || 0, safe(minutes));
    }

    byDate.set(row.date, {
      date: row.date,
      tasksCompleted: Math.max(safe(existing.tasksCompleted), safe(row.tasksCompleted)),
      blocksCompleted: Math.max(safe(existing.blocksCompleted), safe(row.blocksCompleted)),
      taskMinutes: Math.max(safe(existing.taskMinutes), safe(row.taskMinutes)),
      ...(Object.keys(bySubject).length ? { bySubject } : {}),
    });
  }

  const cutoff = cutoffKey();
  return [...byDate.values()]
    .filter((d) => d.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}
