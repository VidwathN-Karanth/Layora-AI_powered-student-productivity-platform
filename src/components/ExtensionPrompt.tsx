'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Puzzle, X } from 'lucide-react';

import { useExtensionInstalled, useStoreTarget } from '@/lib/extension';

/* ────────────────────────────────────────────────────────────────
   A quiet nudge to install the extension, for students who have not.

   Deliberately narrow about when it appears. It shows only when the browser
   has told us the extension is genuinely absent — never on a maybe. Firefox
   cannot answer the question at all (see useExtensionInstalled), so a Gecko
   visitor is left alone instead of being nagged on a guess.
   ──────────────────────────────────────────────────────────────── */

const DISMISS_KEY = 'layora:ext-prompt-dismissed';

/** A dismissal is a snooze, not a burial — a stray click should not cost the
 *  student the extension forever, and a month is long enough to stop being
 *  an irritation. */
const SNOOZE_DAYS = 30;

/** Let the page settle before sliding anything over it. */
const APPEAR_DELAY_MS = 2500;

function snoozed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    // Private mode, or storage blocked. Treat as not snoozed, but the
    // dismissal below will fail the same way — so cap the annoyance by
    // simply not showing it.
    return true;
  }
}

export default function ExtensionPrompt() {
  const pathname = usePathname();
  const installed = useExtensionInstalled();
  const store = useStoreTarget();

  const [visible, setVisible] = useState(false);

  // `installed === false` is the only state worth acting on. `null` means the
  // browser could not be asked, and `true` means there is nothing to say.
  const wanted = installed === false && pathname !== '/extension';

  useEffect(() => {
    if (!wanted || snoozed()) return;
    const timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [wanted]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Nothing to do — it reappears next session, which is the safe failure.
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="complementary"
          aria-label="Install the Layora browser extension"
          className="fixed bottom-4 right-4 z-50 w-[min(20rem,calc(100vw-2rem))] glass-card rounded-2xl border border-outline-variant p-4 shadow-xl"
        >
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-2.5 top-2.5 rounded-lg p-1 text-outline transition hover:bg-white/5 hover:text-on-surface cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-2 pr-6">
            <Puzzle className="h-4 w-4 shrink-0 text-primary" />
            <h4 className="font-mono text-xs font-bold tracking-wider text-primary">
              Add Layora to {store.name}
            </h4>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-on-surface-variant">
            Your quick launchers and courses, one click from any tab — without
            opening the dashboard first.
          </p>

          <div className="mt-3.5 flex items-center gap-2">
            <a
              href={store.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary transition hover:opacity-90"
            >
              <Puzzle className="h-3.5 w-3.5" /> {store.label}
            </a>
            <button
              onClick={dismiss}
              className="rounded-xl px-3 py-2 font-mono text-[11px] text-outline transition hover:text-on-surface cursor-pointer"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
