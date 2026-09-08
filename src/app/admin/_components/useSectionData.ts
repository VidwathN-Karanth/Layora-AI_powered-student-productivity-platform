'use client';

import { useEffect } from 'react';

/**
 * Runs a section's loader on mount, and again whenever it changes identity —
 * which, for every console section, means whenever the selected year changes.
 *
 * The microtask hop is the point of the hook. A loader's first act is
 * `setLoading(true)`, and calling it straight from an effect body sets state
 * synchronously during commit, which cascades a second render before the
 * first has been painted. Deferring by one microtask puts that first state
 * change after the commit, where it belongs, at the cost of nothing a person
 * can perceive.
 *
 * `cancelled` covers the year being switched twice in quick succession: the
 * loader for the year already left behind never starts.
 *
 * Pass a `useCallback`-wrapped loader, or this re-runs on every render.
 */
export function useSectionData(load: () => void | Promise<void>): void {
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);
}
