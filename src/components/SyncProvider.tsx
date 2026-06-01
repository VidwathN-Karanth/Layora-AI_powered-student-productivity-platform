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
  const pendingStateRef = useRef<any>(null);
  const lastSavedSerializedRef = useRef<string>('');

  const sanitizeStateForFirestore = (state: any) => {
    return JSON.parse(JSON.stringify(state));
  };
  
  const themeAccent = useStore((state) => state.themeAccent);
  const hasHydrated = useStore((state) => state.hasHydrated);

  // 0. Update DOM theme dynamically when state changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', themeAccent || 'purple');
    }
  }, [themeAccent]);

  // 1. Listen to Real-Time Updates from Firebase
  useEffect(() => {
    console.log('SyncProvider - checking Firebase config:', { isFirebaseConfigured, hasUser: !!user, hasHydrated });
    if (!hasHydrated) {
      return;
    }
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
            
            // Ignore snapshot if there are pending local writes to prevent overwriting new local state
            if (pendingStateRef.current !== null) {
              console.log('SyncProvider - ignoring snapshot because there are pending local writes');
              return;
            }
            
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
                chatHistory: localState.chatHistory.length > 1 ? localState.chatHistory : (firebaseState.chatHistory || []),
                proactiveRecommendations: localState.proactiveRecommendations || firebaseState.proactiveRecommendations || null
              };

              isHydrated.current = true;
              const docRef = doc(currentDb, 'user_states', user.id);
              setDoc(docRef, {
                state: sanitizeStateForFirestore(stateToSave),
                updated_at: new Date().toISOString()
              }, { merge: true }).catch((err) => {
                console.error('SyncProvider - failed to merge/initialize Firestore:', err);
              });
              
              useStore.getState().setFullState(stateToSave);
              lastSavedSerializedRef.current = JSON.stringify(stateToSave);
            } else {
              // Regular path: overwrite local state with Firestore state, but merge resources to prevent file loss
              isHydrated.current = false;
              
              const localState = useStore.getState();
              
              // Merge resources (documents)
              const mergedResources = { ...(firebaseState.resources || {}) };
              for (const subId in localState.resources) {
                const localFiles = localState.resources[subId] || [];
                const firebaseFiles = mergedResources[subId] || [];
                const combined = [...firebaseFiles];
                for (const lf of localFiles) {
                  if (!combined.some(ff => ff.id === lf.id || (ff.name === lf.name && ff.url === lf.url))) {
                    combined.push(lf);
                  }
                }
                mergedResources[subId] = combined;
              }

              const mergedState = {
                ...firebaseState,
                resources: mergedResources
              };

              useStore.getState().setFullState(mergedState);
              lastSavedSerializedRef.current = JSON.stringify(mergedState);

              // If the store's merged user profile is richer (has higher streak or study hours)
              // than what was stored in Firestore, or if resources were merged/updated,
              // immediately push the update back to Firestore
              const mergedStateStore = useStore.getState();
              const resourcesMergedAndChanged = JSON.stringify(mergedResources) !== JSON.stringify(firebaseState.resources || {});
              const profileChanged = mergedStateStore.user && firebaseState.user && 
                  (mergedStateStore.user.streakCount !== firebaseState.user.streakCount ||
                   mergedStateStore.user.totalStudyHours !== firebaseState.user.totalStudyHours);

              if (profileChanged || resourcesMergedAndChanged) {
                console.log('SyncProvider - merged state has richer profile or new resources, pushing update back to Firestore');
                const stateToSave = {
                  user: mergedStateStore.user,
                  subjects: mergedStateStore.subjects,
                  resources: mergedStateStore.resources,
                  activities: mergedStateStore.activities,
                  websites: mergedStateStore.websites,
                  courses: mergedStateStore.courses,
                  tasks: mergedStateStore.tasks,
                  timetable: mergedStateStore.timetable,
                  themeAccent: mergedStateStore.themeAccent,
                  apiKeys: mergedStateStore.apiKeys,
                  selectedModel: mergedStateStore.selectedModel,
                  calendarSynced: mergedStateStore.calendarSynced,
                  is24HourFormat: mergedStateStore.is24HourFormat,
                  chatHistory: mergedStateStore.chatHistory,
                  proactiveRecommendations: mergedStateStore.proactiveRecommendations
                };
                
                const docRef = doc(currentDb, 'user_states', user.id);
                setDoc(docRef, {
                  state: sanitizeStateForFirestore(stateToSave),
                  updated_at: new Date().toISOString()
                }, { merge: true }).catch((err) => {
                  console.error('SyncProvider - failed to push merged state:', err);
                });
                lastSavedSerializedRef.current = JSON.stringify(stateToSave);
              }
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
            calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations
          } = state;

          const stateToSave = {
            user: storeUser,
            subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations
          };

          const docRef = doc(currentDb, 'user_states', user.id);
          setDoc(docRef, {
            state: sanitizeStateForFirestore(stateToSave),
            updated_at: new Date().toISOString()
          }, { merge: true }).catch((err) => {
            console.error('SyncProvider - failed to initialize Firestore:', err);
          });
          lastSavedSerializedRef.current = JSON.stringify(stateToSave);
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
  }, [isLoaded, user?.id, hasHydrated]);

  // 2. Subscribe to Store Changes and Sync
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoaded || !user || !isFirebaseConfigured || !db) {
      return;
    }

    const currentDb = db;

    const unsubscribe = useStore.subscribe((state) => {
      if (!isHydrated.current) return;

      const {
        user: storeUser, subjects, resources, activities, websites, courses, tasks,
        timetable, themeAccent, apiKeys, selectedModel,
        calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations
      } = state;

      const stateToSave = {
        user: storeUser,
        subjects, resources, activities, websites, courses, tasks,
        timetable, themeAccent, apiKeys, selectedModel,
        calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations
      };

      const serialized = JSON.stringify(stateToSave);
      if (serialized === lastSavedSerializedRef.current) {
        return; // No meaningful change to save
      }

      pendingStateRef.current = state;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        try {
          const docRef = doc(currentDb, 'user_states', user.id);
          await setDoc(docRef, {
            state: sanitizeStateForFirestore(stateToSave),
            updated_at: new Date().toISOString()
          }, { merge: true });
          
          lastSavedSerializedRef.current = serialized;
          console.log('SyncProvider - successfully pushed state to Firebase');
        } catch (err) {
          console.error('Failed to sync state to Firebase:', err);
        } finally {
          pendingStateRef.current = null;
        }
      }, 200); // 200ms debounce
    });

    return () => {
      unsubscribe();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [isLoaded, user?.id, hasHydrated]);

  // 3. Force Flush Pending State on Unload/Visibility Change
  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoaded || !user || !isFirebaseConfigured || !db) {
      return;
    }

    const currentDb = db;

    const flushSync = async () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      if (pendingStateRef.current) {
        const state = pendingStateRef.current;
        pendingStateRef.current = null;
        try {
          const {
            user: storeUser, subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations
          } = state;

          const stateToSave = {
            user: storeUser,
            subjects, resources, activities, websites, courses, tasks,
            timetable, themeAccent, apiKeys, selectedModel,
            calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations
          };

          const docRef = doc(currentDb, 'user_states', user.id);
          await setDoc(docRef, {
            state: sanitizeStateForFirestore(stateToSave),
            updated_at: new Date().toISOString()
          }, { merge: true });
          
          console.log('SyncProvider - successfully flushed pending state on visibility change/unload');
        } catch (err) {
          console.error('Failed to flush state on visibility change/unload:', err);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      }
    };

    const handleBeforeUnload = () => {
      flushSync();
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [isLoaded, user?.id, hasHydrated]);

  return <>{children}</>;
}
