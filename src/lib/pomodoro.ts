/**
 * The Pomodoro cycle, as shared vocabulary.
 *
 * Two very different things depend on these rules and must agree: the Zen mode
 * timer a student actually sits in front of, and the weekly scheduler, which
 * shapes study blocks into the same focus/break rhythm. Keeping the arithmetic
 * here means a student who sets a 50-minute focus length gets 50-minute study
 * blocks on their timetable too.
 */

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Focus rounds completed before the long break is offered. */
  roundsBeforeLongBreak: number;
  /** Whether the next phase starts on its own when one ends. */
  autoStartNext: boolean;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  autoStartNext: true,
};

/** Bounds keep a stray value from producing a 0-second or day-long timer. */
export const SETTING_LIMITS = {
  focusMinutes: { min: 5, max: 90, step: 5 },
  shortBreakMinutes: { min: 1, max: 30, step: 1 },
  longBreakMinutes: { min: 5, max: 60, step: 5 },
  roundsBeforeLongBreak: { min: 2, max: 8, step: 1 },
} as const;

export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

/** Clamps every numeric setting into range, so bad stored data cannot break the timer. */
export function normalizeSettings(settings: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  const merged = { ...DEFAULT_POMODORO_SETTINGS, ...(settings || {}) };

  const clamp = (value: unknown, key: keyof typeof SETTING_LIMITS): number => {
    const { min, max } = SETTING_LIMITS[key];
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return DEFAULT_POMODORO_SETTINGS[key];
    return Math.min(max, Math.max(min, n));
  };

  return {
    focusMinutes: clamp(merged.focusMinutes, 'focusMinutes'),
    shortBreakMinutes: clamp(merged.shortBreakMinutes, 'shortBreakMinutes'),
    longBreakMinutes: clamp(merged.longBreakMinutes, 'longBreakMinutes'),
    roundsBeforeLongBreak: clamp(merged.roundsBeforeLongBreak, 'roundsBeforeLongBreak'),
    autoStartNext: merged.autoStartNext !== false,
  };
}

/** How long a phase runs, in minutes. */
export function phaseMinutes(phase: PomodoroPhase, settings: PomodoroSettings): number {
  if (phase === 'focus') return settings.focusMinutes;
  if (phase === 'shortBreak') return settings.shortBreakMinutes;
  return settings.longBreakMinutes;
}

/**
 * What comes after the phase that just ended.
 *
 * `completedFocusRounds` counts focus rounds finished so far, including the one
 * that just ended — so with the default of 4, the long break arrives after the
 * 4th, 8th, 12th round and so on.
 */
export function nextPhase(
  ended: PomodoroPhase,
  completedFocusRounds: number,
  settings: PomodoroSettings
): PomodoroPhase {
  if (ended !== 'focus') return 'focus';
  return completedFocusRounds > 0 && completedFocusRounds % settings.roundsBeforeLongBreak === 0
    ? 'longBreak'
    : 'shortBreak';
}

/** One day's focus record. Dates are local calendar days, never UTC. */
export interface PomodoroDay {
  date: string; // 'YYYY-MM-DD'
  sessions: number;
  focusMinutes: number;
}

/** How many days of history to keep. Enough for a month view, small enough to sync. */
export const LOG_RETENTION_DAYS = 60;

/** Local calendar date key. `toISOString` would report yesterday before 05:30 in IST. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Adds one completed focus session to the log, returning a new log.
 *
 * Same-day sessions accumulate into one row, and anything older than the
 * retention window is dropped so the log cannot grow without bound in the
 * synced user state.
 */
export function recordSession(
  log: PomodoroDay[],
  focusMinutes: number,
  today: string = dayKey()
): PomodoroDay[] {
  const minutes = Math.max(0, Math.round(focusMinutes));
  const cutoff = dayKey(new Date(Date.now() - LOG_RETENTION_DAYS * 86_400_000));

  const kept = (log || []).filter((d) => d.date >= cutoff);
  const existing = kept.find((d) => d.date === today);

  const updated = existing
    ? kept.map((d) =>
        d.date === today
          ? { ...d, sessions: d.sessions + 1, focusMinutes: d.focusMinutes + minutes }
          : d
      )
    : [...kept, { date: today, sessions: 1, focusMinutes: minutes }];

  return updated.sort((a, b) => a.date.localeCompare(b.date));
}

/** Totals over the last `days` calendar days, today included. */
export function totalsForLastDays(
  log: PomodoroDay[],
  days: number,
  today: Date = new Date()
): { sessions: number; focusMinutes: number } {
  const from = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)));
  const to = dayKey(today);

  return (log || [])
    .filter((d) => d.date >= from && d.date <= to)
    .reduce(
      (acc, d) => ({ sessions: acc.sessions + d.sessions, focusMinutes: acc.focusMinutes + d.focusMinutes }),
      { sessions: 0, focusMinutes: 0 }
    );
}

/** "1h 35m", "45m", "0m" — for stat lines, never for a running countdown. */
export function formatFocusDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
