import { dayKey, type PomodoroDay } from './pomodoro';
import { activityForDay, type ActivityDay } from './activityLog';

/**
 * Turning the logs into a week a student can read.
 *
 * Everything here is pure arithmetic over date keys — no clock reads beyond the
 * `today` a caller passes in, no Date arithmetic in UTC. Weeks run Monday to
 * Sunday, which is how a college timetable runs, and every boundary is a local
 * calendar day so a late-night session lands in the day it felt like.
 */

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface WeekRange {
  /** Monday, 'YYYY-MM-DD'. */
  start: string;
  /** Sunday, 'YYYY-MM-DD'. */
  end: string;
  /** 0 for the current week, 1 for last week, and so on. */
  weeksAgo: number;
}

/** Midnight on the Monday of `d`'s week, in local time. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay() is Sunday-first; shift so Monday is 0 and Sunday is 6.
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

/** The week `weeksAgo` weeks before the one containing `today`. */
export function weekRange(weeksAgo = 0, today: Date = new Date()): WeekRange {
  const monday = startOfWeek(today);
  monday.setDate(monday.getDate() - weeksAgo * 7);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: dayKey(monday), end: dayKey(sunday), weeksAgo };
}

/** The seven date keys of a week, Monday first. */
export function daysOfWeek(range: WeekRange): string[] {
  const [y, m, d] = range.start.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(y, m - 1, d + i)));
}

export interface DayPoint {
  date: string;
  /** 'Mon' … 'Sun' */
  weekday: string;
  focusMinutes: number;
  sessions: number;
  tasksCompleted: number;
  blocksCompleted: number;
  taskMinutes: number;
  /** True once the day has happened — a future day is empty, not a zero score. */
  elapsed: boolean;
}

/** One row per day of the week, gaps filled with zeroes. */
export function buildDaySeries(
  range: WeekRange,
  pomodoroLog: PomodoroDay[] | null | undefined,
  activityLog: ActivityDay[] | null | undefined,
  today: Date = new Date()
): DayPoint[] {
  const todayKey = dayKey(today);

  return daysOfWeek(range).map((date, i) => {
    const pomo = (pomodoroLog || []).find((p) => p.date === date);
    const act = activityForDay(activityLog, date);
    return {
      date,
      weekday: WEEKDAY_LABELS[i],
      focusMinutes: pomo?.focusMinutes || 0,
      sessions: pomo?.sessions || 0,
      tasksCompleted: act.tasksCompleted,
      blocksCompleted: act.blocksCompleted,
      taskMinutes: act.taskMinutes,
      elapsed: date <= todayKey,
    };
  });
}

export interface WeekTotals {
  focusMinutes: number;
  sessions: number;
  tasksCompleted: number;
  blocksCompleted: number;
  taskMinutes: number;
  /** Days with something on them — the honest measure of consistency. */
  activeDays: number;
  /** The day that carried the week, or null if nothing happened. */
  bestDay: DayPoint | null;
  /** Mean length of a focus session, rounded. Null when there were none. */
  averageSessionMinutes: number | null;
}

export function totalsFor(series: DayPoint[]): WeekTotals {
  const sum = (pick: (d: DayPoint) => number) => series.reduce((n, d) => n + pick(d), 0);

  const focusMinutes = sum((d) => d.focusMinutes);
  const sessions = sum((d) => d.sessions);
  const active = series.filter(
    (d) => d.focusMinutes > 0 || d.tasksCompleted > 0 || d.blocksCompleted > 0
  );

  const bestDay = active.reduce<DayPoint | null>((best, d) => {
    if (!best) return d;
    // Focus time settles it; tasks break a tie so a reading day still counts.
    if (d.focusMinutes !== best.focusMinutes) return d.focusMinutes > best.focusMinutes ? d : best;
    return d.tasksCompleted > best.tasksCompleted ? d : best;
  }, null);

  return {
    focusMinutes,
    sessions,
    tasksCompleted: sum((d) => d.tasksCompleted),
    blocksCompleted: sum((d) => d.blocksCompleted),
    taskMinutes: sum((d) => d.taskMinutes),
    activeDays: active.length,
    bestDay,
    averageSessionMinutes: sessions > 0 ? Math.round(focusMinutes / sessions) : null,
  };
}

/**
 * Percent change from `previous` to `current`.
 *
 * Null when there is nothing honest to say: no previous week to compare
 * against, or a jump from zero, which is not "+100%", it is a start.
 */
export function changePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface WeekSummary {
  range: WeekRange;
  series: DayPoint[];
  totals: WeekTotals;
}

export function buildWeek(
  weeksAgo: number,
  pomodoroLog: PomodoroDay[] | null | undefined,
  activityLog: ActivityDay[] | null | undefined,
  today: Date = new Date()
): WeekSummary {
  const range = weekRange(weeksAgo, today);
  const series = buildDaySeries(range, pomodoroLog, activityLog, today);
  return { range, series, totals: totalsFor(series) };
}

/** The last `count` weeks, oldest first — the shape a trend row is drawn from. */
export function weeklyTrend(
  count: number,
  pomodoroLog: PomodoroDay[] | null | undefined,
  activityLog: ActivityDay[] | null | undefined,
  today: Date = new Date()
): WeekSummary[] {
  return Array.from({ length: count }, (_, i) => buildWeek(count - 1 - i, pomodoroLog, activityLog, today));
}

export interface SubjectSlice {
  subject: string;
  minutes: number;
  /** Share of the week's task minutes, 0–100. */
  share: number;
}

/** Where the week's logged minutes went, biggest first. */
export function subjectBreakdown(
  range: WeekRange,
  activityLog: ActivityDay[] | null | undefined
): SubjectSlice[] {
  const days = new Set(daysOfWeek(range));
  const totals = new Map<string, number>();

  for (const day of activityLog || []) {
    if (!days.has(day.date) || !day.bySubject) continue;
    for (const [subject, minutes] of Object.entries(day.bySubject)) {
      if (!Number.isFinite(minutes) || minutes <= 0) continue;
      totals.set(subject, (totals.get(subject) || 0) + minutes);
    }
  }

  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  if (grand <= 0) return [];

  return [...totals.entries()]
    .map(([subject, minutes]) => ({ subject, minutes, share: Math.round((minutes / grand) * 100) }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** "4h 20m", "45m", "—". Minutes are the unit everywhere; hours are presentation. */
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total || 0));
  if (m === 0) return '—';
  if (m < 60) return `${m}m`;
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/** "18/08 – 24/08", in the dd/mm the rest of the site uses. */
export function formatWeekLabel(range: WeekRange): string {
  const short = (key: string) => {
    const [, m, d] = key.split('-');
    return `${d}/${m}`;
  };
  return `${short(range.start)} – ${short(range.end)}`;
}
