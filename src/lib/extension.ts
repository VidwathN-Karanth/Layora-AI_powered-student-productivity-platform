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

/**
 * Whether this visitor has the extension installed.
 *
 * `true` / `false` once known, and `null` while the answer is still unknown —
 * which on Firefox means *permanently* unknown, so callers must treat `null`
 * as "say nothing". The check rides `externally_connectable` in the manifest,
 * which is a Chromium-only key; Firefox drops it, and its `browser.runtime` is
 * not exposed to web pages at all. There is no equivalent, so a Gecko visitor
 * is never nagged rather than being nagged wrongly.
 *
 * The extension answers `layora:ping` from any Layora page. If it is missing,
 * Chromium invokes the callback with no response and sets `lastError`, which
 * has to be *read* inside the callback or the console fills with unchecked
 * runtime errors on every page load.
 */
export function useExtensionInstalled(): boolean | null {
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const runtime = (window as unknown as { chrome?: { runtime?: PageRuntime } })
      .chrome?.runtime;

    // Firefox, Safari, and every mobile browser: no way to ask. Stay null.
    if (!runtime || typeof runtime.sendMessage !== 'function') return;

    let cancelled = false;

    try {
      runtime.sendMessage(EXTENSION_ID, { type: 'layora:ping' }, (response) => {
        // Reading this is what suppresses Chromium's console warning when the
        // extension is absent. The value itself is not needed.
        void runtime.lastError;
        if (!cancelled) setInstalled(Boolean(response && response.ok));
      });
    } catch {
      // Some Chromium forks throw instead of calling back with lastError.
      // Deferred to a microtask so the effect body never sets state
      // synchronously, which would cascade a second render on every mount.
      queueMicrotask(() => {
        if (!cancelled) setInstalled(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return installed;
}

/** Where this browser installs from, and what the button should say. */
export function useStoreTarget() {
  const family = useBrowserFamily();
  return family === 'firefox'
    ? { family, url: FIREFOX_STORE_URL, label: 'Add to Firefox', name: 'Firefox' as const }
    : { family, url: CHROME_STORE_URL, label: 'Add to Chrome', name: 'Chrome' as const };
}
