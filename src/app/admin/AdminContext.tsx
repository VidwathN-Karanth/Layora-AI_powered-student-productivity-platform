'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isCohort, type Cohort } from '@/lib/cohorts';

/**
 * What every admin screen shares: who is signed in, and which academic year
 * they are looking at.
 *
 * The console shows exactly one year at a time and every admin API route
 * demands an explicit `?cohort=`, so this selection has to survive moving
 * between sections. It used to be local state inside one 3,000-line page,
 * which is precisely why the console could not be split into pages.
 *
 * The choice is remembered in localStorage rather than in the synced store: it
 * is a per-device view preference, not workspace data, and it must not travel
 * to a student's device through the state blob.
 */

const STORAGE_KEY = 'layora-admin-cohort';

interface AdminContextValue {
  /** True once the server has confirmed this session is an admin. */
  authorized: boolean;
  selectedCohort: Cohort;
  setSelectedCohort: (cohort: Cohort) => void;
  adminName: string;
  adminEmail: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside the admin layout.');
  return value;
}

export function AdminProvider({
  authorized,
  adminName,
  adminEmail,
  children,
}: {
  authorized: boolean;
  adminName: string;
  adminEmail: string;
  children: React.ReactNode;
}) {
  // Always starts on 2nd Year so the server and the first client render agree;
  // the remembered choice is applied immediately after mount.
  const [selectedCohort, setCohortState] = useState<Cohort>('2nd Year');

  useEffect(() => {
    // Deferred by a microtask so the restore lands after this render has
    // committed. Reading localStorage during render instead would be worse:
    // the server has no such storage, so the two would disagree at hydration.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (isCohort(stored)) setCohortState(stored);
      } catch {
        // Private mode, or storage disabled. The default is a fine answer.
      }
    });
    return () => { cancelled = true; };
  }, []);

  const setSelectedCohort = useCallback((cohort: Cohort) => {
    setCohortState(cohort);
    try {
      window.localStorage.setItem(STORAGE_KEY, cohort);
    } catch {
      // Not being able to remember it is not a reason to refuse the switch.
    }
  }, []);

  const value = useMemo(
    () => ({ authorized, selectedCohort, setSelectedCohort, adminName, adminEmail }),
    [authorized, selectedCohort, setSelectedCohort, adminName, adminEmail]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
