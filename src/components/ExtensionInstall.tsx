'use client';

import { useSyncExternalStore } from 'react';
import { Download, Puzzle } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   The install step of /extension, in whichever browser is reading it.

   One button, never two. A student on Firefox and a student on Edge are each
   given exactly the file that will load in front of them, and the steps
   underneath match the button — the two halves are never allowed to disagree,
   because a Chrome instruction under a Firefox download is worse than no
   instruction at all.
   ──────────────────────────────────────────────────────────────── */

/** Set once each listing exists; until then the manual route shows instead. */
const CHROME_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || '';
const FIREFOX_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_AMO_URL || '';

export type BrowserFamily = 'firefox' | 'chromium';

/**
 * Which build this browser can actually load.
 *
 * Only two answers are useful here, because only two packages exist: Gecko, and
 * everything Chromium. Edge, Brave, Opera, Vivaldi and Arc all carry `Chrome/`
 * in their user agent and all load the same zip, so none of them need naming.
 *
 * Firefox on iOS reports `FxiOS` and is WebKit underneath — it cannot load an
 * extension at all, so it is deliberately *not* matched as Firefox. It falls to
 * the Chromium branch, which is equally wrong for it but at least points at the
 * package a student's desktop will accept.
 */
export function detectBrowser(userAgent: string): BrowserFamily {
  return /\bFirefox\/\d+/.test(userAgent) && !/Seamonkey/i.test(userAgent)
    ? 'firefox'
    : 'chromium';
}

interface Build {
  /** What the one button says. */
  label: string;
  /** The package it hands over. */
  file: string;
  /** The store listing, when there is one. */
  storeUrl: string;
  storeLabel: string;
  /** How to load the package by hand, in this browser. */
  steps: React.ReactNode[];
  /** Shown under the steps when the manual route has a catch. */
  caveat?: string;
  /** What a student calls this browser, for the link to the other build. */
  name: string;
}

const CODE = 'rounded bg-surface px-1.5 py-0.5 text-on-surface';

const BUILDS: Record<BrowserFamily, Build> = {
  chromium: {
    label: 'Download for Chrome',
    file: '/layora-extension.zip',
    storeUrl: CHROME_STORE_URL,
    storeLabel: 'Add to Chrome',
    name: 'Chrome',
    steps: [
      <>Unzip the folder somewhere you will not delete it.</>,
      <>Open <span className={CODE}>chrome://extensions</span> and turn on <span className="text-on-surface">Developer mode</span>, top right.</>,
      <>Press <span className="text-on-surface">Load unpacked</span> and pick the unzipped folder.</>,
      <>Pin Layora to your toolbar, then come back here for step 2.</>,
    ],
  },
  firefox: {
    label: 'Download for Firefox',
    file: '/layora-extension-firefox.zip',
    storeUrl: FIREFOX_STORE_URL,
    storeLabel: 'Add to Firefox',
    name: 'Firefox',
    steps: [
      <>Open a new tab and type <span className={CODE}>about:debugging</span> in the URL bar.</>,
      <>Click <span className="text-on-surface">This Firefox</span> in the left sidebar.</>,
      <>Click the <span className="text-on-surface">Load Temporary Add-on…</span> button.</>,
      <>Select the downloaded Firefox ZIP file — no need to unzip it.</>,
    ],
    caveat:
      'Firefox removes a temporary add-on when it closes, so this needs repeating after a restart until the Add-ons listing is live.',
  },
};

export default function ExtensionInstall() {
  // The user agent is a client-only value, so it is read through
  // useSyncExternalStore rather than an effect: the server snapshot is what
  // gets rendered on the server and on the first client pass, which keeps
  // hydration in agreement, and React swaps in the real answer immediately
  // after. It never changes afterwards, hence the no-op subscribe.
  const family = useSyncExternalStore<BrowserFamily>(
    () => () => {},
    () => detectBrowser(navigator.userAgent),
    () => 'chromium'
  );

  const build = BUILDS[family];
  const other = BUILDS[family === 'firefox' ? 'chromium' : 'firefox'];

  if (build.storeUrl) {
    return (
      <a
        href={build.storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
      >
        <Puzzle className="h-4 w-4" /> {build.storeLabel}
      </a>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm leading-relaxed text-on-surface-variant">
        The store listing is not live yet, so it installs by hand for now.
        It takes about a minute.
      </p>

      <a
        href={build.file}
        download
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
      >
        <Download className="h-4 w-4" /> {build.label}
      </a>

      <ol className="space-y-2 border-t border-outline-variant pt-4 font-mono text-[11px] leading-relaxed text-on-surface-variant">
        {build.steps.map((step, i) => (
          <li key={i}>{i + 1}. {step}</li>
        ))}
      </ol>

      {build.caveat && (
        <p className="font-mono text-[11px] leading-relaxed text-outline">{build.caveat}</p>
      )}

      {/* Deliberately a text link, not a second button: someone downloading
          here to install on another machine still needs a way through. */}
      <p className="font-mono text-[11px] text-outline">
        Installing on {other.name} instead?{' '}
        <a href={other.file} download className="text-primary underline underline-offset-2">
          Get the {other.name} build
        </a>
      </p>
    </div>
  );
}
