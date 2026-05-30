'use client';

import React, { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { db, isFirebaseConfigured } from '@/lib/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const isHydrated = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const themeAccent = useStore((state) => state.themeAccent);

  // 0. Update DOM theme dynamically when state changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', themeAccent || 'purple');
    }
  }, [themeAccent]);

  // 1. Initial Load from Firebase
  useEffect(() => {
    console.log('SyncProvider - checking Firebase config:', { isFirebaseConfigured, hasUser: !!user });
    if (!isLoaded || !user || !isFirebaseConfigured || !db) {
      return;
    }

    const currentDb = db;

    const loadState = async () => {
      try {
        const docRef = doc(currentDb, 'user_states', user.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.state) {
            console.log('SyncProvider - successfully loaded state from Firebase');
            useStore.getState().setFullState(data.state);
          }
        } else {
          console.log('SyncProvider - no state found in Firebase for user');
        }
      } catch (err) {
        console.error('Failed to load state:', err);
      } finally {
        isHydrated.current = true;
      }
    };

    loadState();
  }, [isLoaded, user?.id]);

  // 2. Subscribe to Store Changes and Sync
  useEffect(() => {
    if (!isLoaded || !user || !isFirebaseConfigured || !db) {
      return;
    }

    const currentDb = db;

    const unsubscribe = useStore.subscribe((state) => {
      if (!isHydrated.current) return;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        try {
          const {
            subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory
          } = state;

          const stateToSave = {
            subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory
          };

          const docRef = doc(currentDb, 'user_states', user.id);
          await setDoc(docRef, {
            state: stateToSave,
            updated_at: new Date().toISOString()
          }, { merge: true });
          
          console.log('SyncProvider - successfully pushed state to Firebase');
        } catch (err) {
          console.error('Failed to sync state to Firebase:', err);
        }
      }, 2000);
    });

    return () => {
      unsubscribe();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [isLoaded, user?.id]);

  return <>{children}</>;
}
