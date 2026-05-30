'use client';

import React, { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { db, isFirebaseConfigured } from '@/lib/firebaseClient';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

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

  // 1. Listen to Real-Time Updates from Firebase
  useEffect(() => {
    console.log('SyncProvider - checking Firebase config:', { isFirebaseConfigured, hasUser: !!user });
    if (!isLoaded || !user || !isFirebaseConfigured || !db) {
      return;
    }

    const currentDb = db;

    const unsubscribeSnapshot = onSnapshot(doc(currentDb, 'user_states', user.id), (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.state) {
            console.log('SyncProvider - real-time state loaded from Firebase');
            
            // Smart merge on initial load:
            // If the local state is already populated (e.g. has active schedule or subjects)
            // but the incoming Firebase state's timetable is empty/missing, we should merge
            // and push the local state to Firebase to prevent wiping out the active device's data.
            const localState = useStore.getState();
            const firebaseState = data.state;
            
            const localHasData = (localState.timetable && localState.timetable.length > 0) || 
                                 (localState.subjects && localState.subjects.length > 0) || 
                                 (localState.user && localState.user.isOnboarded);
            const firebaseIsEmpty = !firebaseState.timetable || firebaseState.timetable.length === 0;
            
            if (localHasData && firebaseIsEmpty) {
              console.log('SyncProvider - local state has active data but Firestore is empty/default, merging and initializing Firestore');
              
              const stateToSave = {
                user: localState.user,
                subjects: localState.subjects.length > 0 ? localState.subjects : (firebaseState.subjects || []),
                resources: localState.resources,
                activities: localState.activities.length > 0 ? localState.activities : (firebaseState.activities || []),
                websites: localState.websites.length > 0 ? localState.websites : (firebaseState.websites || []),
                courses: localState.courses.length > 0 ? localState.courses : (firebaseState.courses || []),
                tasks: localState.tasks.length > 0 ? localState.tasks : (firebaseState.tasks || []),
                timetable: localState.timetable.length > 0 ? localState.timetable : (firebaseState.timetable || []),
                themeAccent: localState.themeAccent || firebaseState.themeAccent || 'purple',
                apiKeys: { ...firebaseState.apiKeys, ...localState.apiKeys },
                selectedModel: localState.selectedModel || firebaseState.selectedModel || 'groq',
                calendarSynced: localState.calendarSynced || firebaseState.calendarSynced || false,
                is24HourFormat: localState.is24HourFormat || firebaseState.is24HourFormat || false,
                chatHistory: localState.chatHistory.length > 1 ? localState.chatHistory : (firebaseState.chatHistory || [])
              };

              isHydrated.current = true;
              const docRef = doc(currentDb, 'user_states', user.id);
              setDoc(docRef, {
                state: stateToSave,
                updated_at: new Date().toISOString()
              }, { merge: true }).catch((err) => {
                console.error('SyncProvider - failed to merge/initialize Firestore:', err);
              });
              
              useStore.getState().setFullState(stateToSave);
            } else {
              // Regular path: overwrite local state with what is in Firestore
              isHydrated.current = false;
              useStore.getState().setFullState(firebaseState);
            }
          }
          isHydrated.current = true;
        } else {
          console.log('SyncProvider - no state found in Firebase for user, initializing with local state');
          isHydrated.current = true;
          
          const state = useStore.getState();
          const {
            user: storeUser, subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory
          } = state;

          const stateToSave = {
            user: storeUser,
            subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory
          };

          const docRef = doc(currentDb, 'user_states', user.id);
          setDoc(docRef, {
            state: stateToSave,
            updated_at: new Date().toISOString()
          }, { merge: true }).catch((err) => {
            console.error('SyncProvider - failed to initialize Firestore:', err);
          });
        }
      } catch (err) {
        console.error('Failed to process real-time state update:', err);
        isHydrated.current = true;
      }
    }, (err) => {
      console.error('Failed to listen to state:', err);
      isHydrated.current = true;
    });

    return () => {
      unsubscribeSnapshot();
    };
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
            user: storeUser, subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory
          } = state;

          const stateToSave = {
            user: storeUser,
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
