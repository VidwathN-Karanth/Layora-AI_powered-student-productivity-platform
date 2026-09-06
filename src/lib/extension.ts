'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/* ────────────────────────────────────────────────────────────────
   One definition of the browser extension, for every page that
   mentions it: where it is published, and whether this visitor has it.
   ──────────────────────────────────────────────────────────────── */

/**
 * The published Chrome Web Store id.
 *
 * A store install always has this id, which is what makes detection possible
 * at all — an unpacked install gets a random one, so a developer testing from
 * `chrome://extensions` will read as "not installed" here. That is the right
 * trade: the prompt exists for students, and a student installs from the store.
 */
export const EXTENSION_ID = 'mmhpnmhikoafdcgdhiiloddjkhehiabm';

export const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_EXTENSION_STORE_URL ||
  `https://chromewebstore.google.com/detail/layora-quick-access/${EXTENSION_ID}`;

export const FIREFOX_STORE_URL =
  process.env.NEXT_PUBLIC_EXTENSION_AMO_URL ||
  'https://addons.mozilla.org/en-US/firefox/addon/layora-quick-access/';

export type BrowserFamily = 'firefox' | 'chromium';

/**
 * Which build this browser can actually load.
 *
 * Only two answers are useful, because only two packages exist: Gecko, and
 * everything Chromium. Edge, Brave, Opera, Vivaldi and Arc all carry `Chrome/`
 * in their user agent and all install from the same listing.
 *
 * Firefox on iOS reports `FxiOS` and is WebKit underneath — it cannot load an
 * extension at all, so it is deliberately *not* matched as Firefox.
 */
export function detectBrowser(userAgent: string): BrowserFamily {
  return /\bFirefox\/\d+/.test(userAgent) && !/Seamonkey/i.test(userAgent)
    ? 'firefox'
    : 'chromium';
}

/**
 * The visitor's browser family, hydration-safe.
 *
 * The server has no user agent to read here, so it renders the Chromium
 * snapshot and React swaps in the real answer on the first client pass. It
 * never changes afterwards, hence the no-op subscribe.
 */
export function useBrowserFamily(): BrowserFamily {
  return useSyncExternalStore<BrowserFamily>(
    () => () => {},
    () => detectBrowser(navigator.userAgent),
    () => 'chromium'
  );
}

/** The shape Chromium exposes to a page listed in `externally_connectable`. */
interface PageRuntime {
  sendMessage: (
    id: string,
    message: unknown,
    callback: (response?: { ok?: boolean }) => void
  ) => void;
  lastError?: { message?: string };
}

/** Chromium browsers that cannot install an extension at all. */
const MOBILE = /Android|iPhone|iPad|iPod|Mobile/i;

/** If the ping is going to be answered, it is answered immediately. */
const PING_TIMEOUT_MS = 1500;

/**
 * Whether this visitor has the extension installed.
 *
 * `true` / `false` once known, `null` while the question cannot be asked at
 * all — so callers must treat `null` as "say nothing".
 *
 * The check rides `externally_connectable`, a Chromium-only manifest key that
 * grants the Layora origin the right to message the extension. Two things
 * follow from how Chromium implements it, and both matter here:
 *
 * 1. `chrome.runtime` is injected into a page *only* when some installed
 *    extension lists that page in `externally_connectable`. Its absence is
 *    therefore the ordinary signal that ours is not installed — not a signal
 *    that the browser could not be asked. Treating absence as "unknown" makes
 *    the negative answer unreachable, which is the whole point of asking.
 * 2. When `chrome.runtime` *is* present but ours is missing, Chromium calls
 *    back with no response and sets `lastError`, which has to be read inside
 *    the callback or the console fills with unchecked runtime errors.
 *
 * Firefox is the genuine `null`: it drops `externally_connectable` and exposes
 * no equivalent to a web page, so a Gecko visitor is left alone rather than
 * nagged on a guess. Mobile Chromium is the other, since it cannot install
 * extensions at all.
 */
export function useExtensionInstalled(): boolean | null {
  const family = useBrowserFamily();
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    // Gecko cannot answer, and no mobile browser can install one.
    if (family !== 'chromium') return;
    if (MOBILE.test(navigator.userAgent)) return;

    let cancelled = false;
    // Deferred so the effect body never sets state synchronously, which would
    // cascade a second render on every mount.
    const settle = (value: boolean) => {
      queueMicrotask(() => {
        if (!cancelled) setInstalled(value);
      });
    };

    const runtime = (window as unknown as { chrome?: { runtime?: PageRuntime } })
      .chrome?.runtime;

    // Nothing is listening on this origin, so ours is not among them.
    if (!runtime || typeof runtime.sendMessage !== 'function') {
      settle(false);
      return () => {
        cancelled = true;
      };
    }

    // Another extension may own the runtime we can see, so still ask ours.
    const timer = setTimeout(() => settle(false), PING_TIMEOUT_MS);

    try {
      runtime.sendMessage(EXTENSION_ID, { type: 'layora:ping' }, (response) => {
        void runtime.lastError;
        clearTimeout(timer);
        settle(Boolean(response && response.ok));
      });
    } catch {
      clearTimeout(timer);
      settle(false);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [family]);

  return installed;
}

/** Where this browser installs from, and what the button should say. */
export function useStoreTarget() {
  const family = useBrowserFamily();
  return family === 'firefox'
    ? { family, url: FIREFOX_STORE_URL, label: 'Add to Firefox', name: 'Firefox' as const }
    : { family, url: CHROME_STORE_URL, label: 'Add to Chrome', name: 'Chrome' as const };
}
