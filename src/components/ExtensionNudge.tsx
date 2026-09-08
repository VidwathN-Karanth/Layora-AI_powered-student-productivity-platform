'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Puzzle, X } from 'lucide-react';
import { apiFetch, readJson } from '@/lib/apiClient';
import { useExtensionInstalled } from '@/lib/extension';

/* ────────────────────────────────────────────────────────────────
   "Your extension is not connected", bottom right.

   The trigger is the pairing-token list: an account with no live token has
   never finished connecting a browser, which is exactly the state worth
   mentioning, and revoking the last device brings the card back.

   What the card *says* comes from useExtensionInstalled, because "connect it"
   is the wrong instruction for someone who has not installed it yet. That hook
   answers null on Firefox and on mobile, where the question cannot be asked —
   there the card offers the extension in neutral wording rather than guessing
   which half of the job is outstanding.

   Shown once per week per device at most. A nudge that reappears on every
   navigation is an advert, and the whole point is that it is easy to ignore.
   ──────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'layora-extension-nudge-dismissed';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** Long enough that it never competes with the page still painting. */
const APPEAR_DELAY_MS = 4000;

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    // Storage unavailable — better to stay quiet than to nag every load.
    return true;
  }
}

export default function ExtensionNudge() {
  const [show, setShow] = useState(false);
  const installed = useExtensionInstalled();

  useEffect(() => {
    if (dismissedRecently()) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await readJson<{ tokens?: unknown[] }>(await apiFetch('/api/extension/token'));
        if (!cancelled && (data.tokens || []).length === 0) setShow(true);
      } catch {
        // Signed out, offline, or the route said no. Say nothing.
      }
    }, APPEAR_DELAY_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Nothing to do; it will simply be offered again next week's equivalent.
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          role="status"
          className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-[340px] z-[70] rounded-2xl border border-outline-variant bg-surface-container p-4 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <Puzzle className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-bold text-on-surface">
                {installed ? 'Extension not connected' : 'Add the Layora extension'}
              </p>
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-outline">
                {installed
                  ? 'It is installed but not linked to your account yet, so its popup is empty.'
                  : 'Put your quick launchers and courses one click from any tab. It takes about a minute.'}
              </p>

              <a
                href="/extension"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary transition hover:bg-primary/20"
              >
                {installed ? 'Connect it' : 'Get it'} <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-outline transition hover:text-on-surface cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
