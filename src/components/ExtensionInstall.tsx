'use client';

import { Download, Puzzle } from 'lucide-react';

import {
  CHROME_STORE_URL,
  FIREFOX_STORE_URL,
  useBrowserFamily,
  type BrowserFamily,
} from '@/lib/extension';

/* ────────────────────────────────────────────────────────────────
   The install step of /extension, in whichever browser is reading it.

   One button, never two. A student on Firefox and a student on Edge are each
   given exactly the file that will load in front of them, and the steps
   underneath match the button — the two halves are never allowed to disagree,
   because a Chrome instruction under a Firefox download is worse than no
   instruction at all.

   Both browsers now have a published listing, so the by-hand route below is
   only reachable if a store URL is deliberately unset by env var. It is kept
   working, and kept accurate, for that case.
   ──────────────────────────────────────────────────────────────── */

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
      'Loaded this way, Firefox drops the add-on when it closes. Installing from the Add-ons site instead makes it permanent.',
  },
};

export default function ExtensionInstall() {
  const family: BrowserFamily = useBrowserFamily();

  const build = BUILDS[family];
  const other = BUILDS[family === 'firefox' ? 'chromium' : 'firefox'];

  /* Shown on both routes: someone downloading here to install on another
     machine still needs a way across. Deliberately a text link, not a second
     button. It points at the other browser's store when there is one. */
  const secondary = (
    <p className="font-mono text-[11px] text-outline">
      Installing on {other.name} instead?{' '}
      {other.storeUrl ? (
        <a
          href={other.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          Get it for {other.name}
        </a>
      ) : (
        <a href={other.file} download className="text-primary underline underline-offset-2">
          Get the {other.name} build
        </a>
      )}
    </p>
  );

  if (build.storeUrl) {
    return (
      <div className="mt-5 space-y-4">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          One click from the official store, and it updates itself from then on.
        </p>

        <a
          href={build.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-90"
        >
          <Puzzle className="h-4 w-4" /> {build.storeLabel}
        </a>

        {secondary}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <p className="text-sm leading-relaxed text-on-surface-variant">
        The {build.name} store listing is not live yet, so it installs by hand
        for now. It takes about a minute.
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

      {secondary}
    </div>
  );
}
