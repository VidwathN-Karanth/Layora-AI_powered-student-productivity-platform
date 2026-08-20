'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, X, Check } from 'lucide-react';

const FOCUS_MINUTES = 20;
const TOTAL_SECONDS = FOCUS_MINUTES * 60;

interface ZenModeProps {
  open: boolean;
  onClose: () => void;
}

/**
 * A single 20-minute focus block.
 *
 * Everything except the countdown is removed: the page goes black and
 * fullscreen so the timer is the only thing on screen. Controls stay dim until
 * pointed at, so they do not compete with the number.
 */
export default function ZenMode({ open, onClose }: ZenModeProps) {
  const [remaining, setRemaining] = useState(TOTAL_SECONDS);
  const [running, setRunning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Leaving fullscreen (Esc, or the browser's own control) closes Zen mode, so
  // the two can never disagree about which state we are in.
  const exit = useCallback(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose]);

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

  // Reset whenever a fresh session starts.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setRemaining(TOTAL_SECONDS);
      setRunning(true);
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  // The clock is running only while the user wants it AND time is left, so
  // hitting zero stops it without a separate state update.
  const ticking = running && remaining > 0;

  useEffect(() => {
    if (!open || !ticking) return;
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [open, ticking]);

  if (!open) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const done = remaining === 0;
  const progress = 1 - remaining / TOTAL_SECONDS;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Zen mode, ${FOCUS_MINUTES} minute focus session`}
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center select-none"
    >
      {/* Elapsed, as a hairline across the top. */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
        <div
          className="h-full bg-white/70 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <button
        onClick={exit}
        aria-label="Leave Zen mode"
        className="absolute top-5 right-5 p-2.5 rounded-full text-white/25 hover:text-white hover:bg-white/10 transition cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      <span className="text-[11px] font-mono uppercase tracking-[0.35em] text-white/30 mb-6">
        {done ? 'Session complete' : ticking ? 'Focus' : 'Paused'}
      </span>

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
            {FOCUS_MINUTES} minutes done. Take a break.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setRemaining(TOTAL_SECONDS); setRunning(true); }}
              className="px-5 py-2.5 rounded-full border border-white/20 hover:border-white/50 text-sm text-white/80 hover:text-white transition cursor-pointer"
            >
              Another round
            </button>
            <button
              onClick={exit}
              className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition cursor-pointer"
            >
              Done
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
            onClick={() => { setRemaining(TOTAL_SECONDS); setRunning(true); }}
            aria-label="Restart the session"
            className="p-3.5 rounded-full border border-white/20 hover:border-white/60 text-white transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      <p className="absolute bottom-6 text-[10px] font-mono text-white/20 tracking-wider">
        Space to pause · Esc to leave
      </p>
    </div>,
    document.body
  );
}
