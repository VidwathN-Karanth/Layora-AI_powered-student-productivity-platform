'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, X, Check, SkipForward, Settings2, Minus, Plus } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  PHASE_LABEL, SETTING_LIMITS, dayKey, formatFocusDuration, nextPhase, phaseMinutes,
  totalsForLastDays, type PomodoroPhase, type PomodoroSettings,
} from '@/lib/pomodoro';

interface ZenModeProps {
  open: boolean;
  onClose: () => void;
}

/** Breaks read cooler than focus, so the phase is legible at a glance. */
const PHASE_ACCENT: Record<PomodoroPhase, string> = {
  focus: 'bg-white/70',
  shortBreak: 'bg-emerald-400/80',
  longBreak: 'bg-sky-400/80',
};

/**
 * A full Pomodoro cycle, fullscreen and black.
 *
 * Focus, short break, focus, ... and a long break every few rounds. The lengths
 * are the same settings the weekly scheduler uses to size study blocks, so the
 * timetable and the timer never disagree about what "a session" means.
 *
 * Everything except the countdown stays dim until pointed at, so nothing
 * competes with the number.
 */
export default function ZenMode({ open, onClose }: ZenModeProps) {
  const settings = useStore((s) => s.pomodoroSettings);
  const setPomodoroSettings = useStore((s) => s.setPomodoroSettings);
  const recordPomodoroSession = useStore((s) => s.recordPomodoroSession);
  const pomodoroLog = useStore((s) => s.pomodoroLog);
  const tasks = useStore((s) => s.tasks);
  const activeTaskId = useStore((s) => s.activeTaskId);

  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [remaining, setRemaining] = useState(settings.focusMinutes * 60);
  const [running, setRunning] = useState(true);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mirrors, so the interval callback never reads a stale closure. These
  // effects only assign refs — they never set state.
  const phaseRef = useRef(phase);
  const remainingRef = useRef(remaining);
  const roundsRef = useRef(completedRounds);
  const settingsRef = useRef<PomodoroSettings>(settings);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { remainingRef.current = remaining; }, [remaining]);
  useEffect(() => { roundsRef.current = completedRounds; }, [completedRounds]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) || null,
    [tasks, activeTaskId]
  );

  const today = useMemo(
    () => (pomodoroLog || []).find((d) => d.date === dayKey()) || { sessions: 0, focusMinutes: 0 },
    [pomodoroLog]
  );
  const week = useMemo(() => totalsForLastDays(pomodoroLog || [], 7), [pomodoroLog]);

  // Leaving fullscreen (Esc, or the browser's own control) closes Zen mode, so
  // the two can never disagree about which state we are in.
  const exit = useCallback(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose]);

  /** Moves to the phase that follows the one on screen. */
  const advance = useCallback((endedPhase: PomodoroPhase, autoStart: boolean) => {
    const current = settingsRef.current;
    const rounds = endedPhase === 'focus' ? roundsRef.current + 1 : roundsRef.current;
    const upcoming = nextPhase(endedPhase, rounds, current);

    setCompletedRounds(rounds);
    setPhase(upcoming);
    setRemaining(phaseMinutes(upcoming, current) * 60);
    setRunning(autoStart);
  }, []);

  /**
   * Called from the interval when a phase runs out — a finished focus round is
   * banked here, which is the only place sessions are counted.
   */
  const finishPhase = useCallback(() => {
    const ended = phaseRef.current;
    const current = settingsRef.current;

    if (ended === 'focus') {
      recordPomodoroSession(current.focusMinutes);
    }

    if (current.autoStartNext) {
      advance(ended, true);
    } else {
      setRunning(false);
    }
  }, [advance, recordPomodoroSession]);

  useEffect(() => {
    if (!open) return;

    const el = containerRef.current;
    // Fullscreen can be refused (permissions, iframes); the overlay still works.
    el?.requestFullscreen?.().catch(() => {});

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // A fresh open always starts a fresh cycle at round zero.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setPhase('focus');
      setRemaining(settingsRef.current.focusMinutes * 60);
      setCompletedRounds(0);
      setRunning(true);
      setShowSettings(false);
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  const ticking = running && remaining > 0;

  useEffect(() => {
    if (!open || !ticking) return;
    const id = setInterval(() => {
      const next = remainingRef.current - 1;
      remainingRef.current = next;
      setRemaining(next > 0 ? next : 0);
      if (next <= 0) finishPhase();
    }, 1000);
    return () => clearInterval(id);
  }, [open, ticking, finishPhase]);

  /** Editing a length while that phase is on screen retimes it immediately. */
  const changeSetting = (key: keyof typeof SETTING_LIMITS, delta: number) => {
    const { min, max, step } = SETTING_LIMITS[key];
    const value = Math.min(max, Math.max(min, settings[key] + delta * step));
    setPomodoroSettings({ [key]: value } as Partial<PomodoroSettings>);

    const affects: Record<PomodoroPhase, keyof typeof SETTING_LIMITS> = {
      focus: 'focusMinutes',
      shortBreak: 'shortBreakMinutes',
      longBreak: 'longBreakMinutes',
    };
    if (affects[phase] === key && !running) {
      setRemaining(value * 60);
    }
  };

  if (!open) return null;

  const totalSeconds = phaseMinutes(phase, settings) * 60;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const done = remaining === 0;
  const progress = totalSeconds > 0 ? 1 - remaining / totalSeconds : 0;
  const roundInCycle = (completedRounds % settings.roundsBeforeLongBreak) + 1;
  const upcoming = nextPhase(phase, phase === 'focus' ? completedRounds + 1 : completedRounds, settings);

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Zen mode, ${PHASE_LABEL[phase]} for ${phaseMinutes(phase, settings)} minutes`}
      className="zen-overlay fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center select-none"
    >
      {/* Elapsed, as a hairline across the top. */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none ${PHASE_ACCENT[phase]}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="absolute top-5 right-5 flex items-center gap-1">
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Session lengths"
          aria-expanded={showSettings}
          className={`p-2.5 rounded-full transition cursor-pointer ${
            showSettings ? 'text-white bg-white/10' : 'text-white/25 hover:text-white hover:bg-white/10'
          }`}
        >
          <Settings2 className="w-5 h-5" />
        </button>
        <button
          onClick={exit}
          aria-label="Leave Zen mode"
          className="p-2.5 rounded-full text-white/25 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {showSettings && (
        <div className="absolute top-16 right-5 w-64 rounded-2xl border border-white/10 bg-[#0B0B0C] p-4 space-y-3 z-10">
          {([
            ['focusMinutes', 'Focus'],
            ['shortBreakMinutes', 'Short break'],
            ['longBreakMinutes', 'Long break'],
            ['roundsBeforeLongBreak', 'Rounds per cycle'],
          ] as [keyof typeof SETTING_LIMITS, string][]).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/50">{label}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => changeSetting(key, -1)}
                  disabled={settings[key] <= SETTING_LIMITS[key].min}
                  aria-label={`Decrease ${label}`}
                  className="p-1 rounded-md border border-white/15 text-white/60 hover:text-white hover:border-white/40 transition cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-10 text-center text-xs font-mono tabular-nums text-white">
                  {settings[key]}
                  {key === 'roundsBeforeLongBreak' ? '' : 'm'}
                </span>
                <button
                  onClick={() => changeSetting(key, 1)}
                  disabled={settings[key] >= SETTING_LIMITS[key].max}
                  aria-label={`Increase ${label}`}
                  className="p-1 rounded-md border border-white/15 text-white/60 hover:text-white hover:border-white/40 transition cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          <label className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 cursor-pointer">
            <span className="text-[11px] text-white/50">Auto-start next</span>
            <input
              type="checkbox"
              checked={settings.autoStartNext}
              onChange={(e) => setPomodoroSettings({ autoStartNext: e.target.checked })}
              className="accent-white cursor-pointer"
            />
          </label>

          <p className="text-[9px] text-white/25 leading-relaxed pt-1">
            These lengths also shape the study blocks on your weekly timetable.
          </p>
        </div>
      )}

      <span className="text-[11px] font-mono uppercase tracking-[0.35em] text-white/30 mb-2">
        {done ? `${PHASE_LABEL[phase]} complete` : ticking ? PHASE_LABEL[phase] : 'Paused'}
      </span>

      {/* Which round of the cycle this is — the long break is the payoff. */}
      <div className="flex items-center gap-1.5 mb-6" aria-label={`Round ${roundInCycle} of ${settings.roundsBeforeLongBreak}`}>
        {Array.from({ length: settings.roundsBeforeLongBreak }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < completedRounds % settings.roundsBeforeLongBreak || (phase !== 'focus' && i < roundInCycle - 1)
                ? 'w-6 bg-white/70'
                : i === roundInCycle - 1 && phase === 'focus'
                  ? 'w-6 bg-white/30'
                  : 'w-1.5 bg-white/15'
            }`}
          />
        ))}
      </div>

      {activeTask && phase === 'focus' && (
        <p className="text-xs text-white/40 mb-4 max-w-md text-center truncate px-6">
          Working on <span className="text-white/70">{activeTask.title}</span>
        </p>
      )}

      <div
        aria-live="polite"
        className="font-mono font-bold tabular-nums leading-none text-white"
        style={{ fontSize: 'clamp(5rem, 22vw, 20rem)' }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>

      {done ? (
        <div className="mt-10 flex flex-col items-center gap-5">
          <p className="flex items-center gap-2 text-sm text-white/70">
            <Check className="w-4 h-4 text-emerald-400" />
            {phase === 'focus'
              ? `${settings.focusMinutes} minutes done. ${PHASE_LABEL[upcoming]} next.`
              : 'Break over. Back to it.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => advance(phase, true)}
              className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition cursor-pointer"
            >
              Start {PHASE_LABEL[upcoming].toLowerCase()}
            </button>
            <button
              onClick={exit}
              className="px-5 py-2.5 rounded-full border border-white/20 hover:border-white/50 text-sm text-white/80 hover:text-white transition cursor-pointer"
            >
              Finish
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-12 flex items-center gap-3 opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 motion-reduce:transition-none">
          <button
            onClick={() => setRunning((r) => !r)}
            aria-label={ticking ? 'Pause' : 'Resume'}
            className="p-3.5 rounded-full border border-white/20 hover:border-white/60 text-white transition cursor-pointer"
          >
            {ticking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => { setRemaining(phaseMinutes(phase, settings) * 60); setRunning(true); }}
            aria-label="Restart this phase"
            className="p-3.5 rounded-full border border-white/20 hover:border-white/60 text-white transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {/* Skipping never banks a focus round — only finishing one does. */}
          <button
            onClick={() => advance(phase, settings.autoStartNext)}
            aria-label={`Skip to ${PHASE_LABEL[upcoming].toLowerCase()}`}
            title={`Skip to ${PHASE_LABEL[upcoming].toLowerCase()}`}
            className="p-3.5 rounded-full border border-white/20 hover:border-white/60 text-white transition cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* The day's record, quiet enough to ignore while the timer runs. */}
      <div className="absolute bottom-14 flex items-center gap-5 text-[10px] font-mono text-white/25 tracking-wider">
        <span>
          Today <span className="text-white/50">{today.sessions}</span>{' '}
          {today.sessions === 1 ? 'session' : 'sessions'} · {formatFocusDuration(today.focusMinutes)}
        </span>
        <span className="w-px h-3 bg-white/10" />
        <span>7 days <span className="text-white/50">{formatFocusDuration(week.focusMinutes)}</span></span>
      </div>

      <p className="absolute bottom-6 text-[10px] font-mono text-white/20 tracking-wider">
        Space to pause · Esc to leave
      </p>
    </div>,
    document.body
  );
}
