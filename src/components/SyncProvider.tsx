'use client';

import React, { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// Module-level flag to suppress ALL database writes during a purge.
let suppressSync = false;
export function suppressSupabaseSync() { suppressSync = true; }

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const isHydrated = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<any>(null);
  const lastSavedSerializedRef = useRef<string>('');
  const lastSavedSubjectsRef = useRef<any[]>([]);
  const lastSavedResourcesRef = useRef<any>({});
  const inFlightWrites = useRef(0);
  const ignoreSnapshotUntilRef = useRef<number>(0);

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

  // Helper to merge local state and incoming cloud state
  const mergeLocalAndCloudState = (incomingState: any, localState: any) => {
    // Merge resources (documents)
    const mergedResources = { ...(incomingState.resources || {}) };
    for (const subId in localState.resources) {
      const localFiles = localState.resources[subId] || [];
      const cloudFiles = mergedResources[subId] || [];
      const combined = [...cloudFiles];
      for (const lf of localFiles) {
        if (!combined.some(cf => cf.id === lf.id || (cf.name === lf.name && cf.url === lf.url))) {
          combined.push(lf);
        }
      }
      mergedResources[subId] = combined;
    }

    // Merge subjects
    const mergedSubjects = [...(incomingState.subjects || [])];
    for (const ls of localState.subjects || []) {
      if (!mergedSubjects.some(fs => fs.id === ls.id || (fs.code === ls.code && fs.name === ls.name))) {
        mergedSubjects.push(ls);
      }
    }

    // Merge tasks
    const mergedTasks = [...(incomingState.tasks || [])];
    for (const lt of localState.tasks || []) {
      if (!mergedTasks.some(ft => ft.id === lt.id)) {
        mergedTasks.push(lt);
      }
    }

    // Merge timetable
    const mergedTimetable = [...(incomingState.timetable || [])];
    for (const lb of localState.timetable || []) {
      if (!mergedTimetable.some(fb => fb.id === lb.id)) {
        mergedTimetable.push(lb);
      }
    }

    // Merge courses
    const mergedCourses = [...(incomingState.courses || [])];
    for (const lc of localState.courses || []) {
      if (!mergedCourses.some(fc => fc.id === lc.id)) {
        mergedCourses.push(lc);
      }
    }

    // Merge activities
    const mergedActivities = [...(incomingState.activities || [])];
    for (const la of localState.activities || []) {
      if (!mergedActivities.some(fa => fa.id === la.id)) {
        mergedActivities.push(la);
      }
    }

    // Merge websites
    const mergedWebsites = [...(incomingState.websites || [])];
    for (const lw of localState.websites || []) {
      if (!mergedWebsites.some(fw => fw.id === lw.id)) {
        mergedWebsites.push(lw);
      }
    }

    return {
      ...incomingState,
      resources: mergedResources,
      subjects: mergedSubjects,
      tasks: mergedTasks,
      timetable: mergedTimetable,
      courses: mergedCourses,
      activities: mergedActivities,
      websites: mergedWebsites
    };
  };

  const processIncomingCloudState = async (cloudState: any, source: 'supabase') => {
    if (suppressSync) return;
    
    // Ignore snapshot if there are pending local writes, in-flight writes, or scheduled debounce timeouts
    if (pendingStateRef.current !== null || inFlightWrites.current > 0 || syncTimeoutRef.current !== null) {
      console.log(`SyncProvider - ignoring ${source} snapshot due to pending/in-flight writes`);
      return;
    }

    // Ignore snapshot echo cooldown
    if (Date.now() < ignoreSnapshotUntilRef.current) {
      console.log(`SyncProvider - ignoring ${source} snapshot echo (post-write cooldown)`);
      return;
    }

    const localState = useStore.getState();
    const localHasData = (localState.timetable && localState.timetable.length > 0) || 
                         (localState.subjects && localState.subjects.length > 0) || 
                         (localState.user && localState.user.isOnboarded);
    const cloudIsEmpty = !cloudState.user || !cloudState.user.isOnboarded;

    if (localHasData && cloudIsEmpty) {
      console.log(`SyncProvider - local state has active data but ${source} is empty, initializing cloud database`);
      const stateToSave = {
        user: localState.user,
        subjects: localState.subjects,
        resources: localState.resources,
        activities: localState.activities,
        websites: localState.websites,
        courses: localState.courses,
        tasks: localState.tasks,
        timetable: localState.timetable,
        themeAccent: localState.themeAccent || 'purple',
        apiKeys: localState.apiKeys,
        selectedModel: localState.selectedModel || 'groq',
        calendarSynced: localState.calendarSynced || false,
        is24HourFormat: localState.is24HourFormat || false,
        chatHistory: localState.chatHistory,
        proactiveRecommendations: localState.proactiveRecommendations
      };

      isHydrated.current = true;

      if (isSupabaseConfigured && supabase) {
        supabase.from('user_states').upsert({
          id: user!.id,
          state: sanitizeStateForFirestore(stateToSave),
          updated_at: new Date().toISOString()
        }).then(({ error }) => {
          if (error) console.error('Failed to merge initialize Supabase:', error);
        });
      }

      useStore.getState().setFullState(stateToSave);
      lastSavedSerializedRef.current = JSON.stringify(stateToSave);
      lastSavedSubjectsRef.current = stateToSave.subjects || [];
      lastSavedResourcesRef.current = stateToSave.resources || {};
    } else {
      isHydrated.current = false;
      const mergedState = mergeLocalAndCloudState(cloudState, localState);

      useStore.getState().setFullState(mergedState);
      lastSavedSerializedRef.current = JSON.stringify(mergedState);
      lastSavedSubjectsRef.current = mergedState.subjects || [];
      lastSavedResourcesRef.current = mergedState.resources || {};

      // If profile changed or merged changes exist, push back to keep aligned
      const mergedStateStore = useStore.getState();
      const profileChanged = mergedStateStore.user && cloudState.user && 
          (mergedStateStore.user.streakCount !== cloudState.user.streakCount ||
           mergedStateStore.user.totalStudyHours !== cloudState.user.totalStudyHours);
      const resourcesMergedAndChanged = JSON.stringify(mergedState.resources) !== JSON.stringify(cloudState.resources || {});

      if (profileChanged || resourcesMergedAndChanged) {
        console.log(`SyncProvider - merged state has richer profile/resources, pushing updates to ${source}`);
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

        if (isSupabaseConfigured && supabase) {
          supabase.from('user_states').upsert({
            id: user!.id,
            state: sanitizeStateForFirestore(stateToSave),
            updated_at: new Date().toISOString()
          }).then(({ error }) => {
            if (error) console.error('Failed to push Supabase merge back:', error);
          });
        }
        lastSavedSerializedRef.current = JSON.stringify(stateToSave);
        lastSavedSubjectsRef.current = stateToSave.subjects || [];
        lastSavedResourcesRef.current = stateToSave.resources || {};
      }
    }
    isHydrated.current = true;
  };

  // 1. Listen to Real-Time Updates from Supabase
  useEffect(() => {
    if (!hasHydrated || !isLoaded || !user) return;

    let supabaseChannel: any = null;

    console.log('SyncProvider - checking db configurations:', {
      isSupabaseConfigured,
      hasUser: !!user,
      hasHydrated
    });

    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      const loadInitialSupabaseState = async () => {
        try {
          const { data, error } = await client
            .from('user_states')
            .select('state')
            .eq('id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            throw error;
          }

          if (data && data.state) {
            console.log('SyncProvider - initial state loaded from Supabase');
            processIncomingCloudState(data.state, 'supabase');
          } else {
            console.log('SyncProvider - initializing state on Supabase...');
            processIncomingCloudState({}, 'supabase');
          }
        } catch (err) {
          console.error('Failed to load initial Supabase state:', err);
        }
      };

      loadInitialSupabaseState();

      // Subscribe to real-time table modifications for this row
      supabaseChannel = client
        .channel(`realtime:user_states:id=eq.${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_states',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('SyncProvider - real-time update received from Supabase');
            const newState = (payload.new as any)?.state;
            if (newState) {
              processIncomingCloudState(newState, 'supabase');
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (supabaseChannel && supabase) supabase.removeChannel(supabaseChannel);
    };
  }, [isLoaded, user?.id, hasHydrated]);

  // 2. Subscribe to local Store Changes and sync (writes to both)
  useEffect(() => {
    if (!hasHydrated || !isLoaded || !user) return;

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
      if (serialized === lastSavedSerializedRef.current) return;

      const lastSubjects = lastSavedSubjectsRef.current || [];
      const lastResources = lastSavedResourcesRef.current || {};
      const subjectsChanged = JSON.stringify(subjects) !== JSON.stringify(lastSubjects);
      const resourcesChanged = JSON.stringify(resources) !== JSON.stringify(lastResources);
      const isImmediate = subjectsChanged || resourcesChanged;

      pendingStateRef.current = state;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      const performSync = async () => {
        if (suppressSync) return;
        try {
          inFlightWrites.current++;
          const updateTime = new Date().toISOString();

          // Sync to Supabase
          if (isSupabaseConfigured && supabase) {
            const { error } = await supabase
              .from('user_states')
              .upsert({
                id: user.id,
                state: sanitizeStateForFirestore(stateToSave),
                updated_at: updateTime
              });
            if (error) throw error;
            console.log('SyncProvider - successfully saved to Supabase');
          }

          lastSavedSerializedRef.current = serialized;
          lastSavedSubjectsRef.current = subjects || [];
          lastSavedResourcesRef.current = resources || {};
          ignoreSnapshotUntilRef.current = Date.now() + 3000;
        } catch (err: any) {
          console.error('SyncProvider - failed to save states:', err);
        } finally {
          inFlightWrites.current--;
          if (pendingStateRef.current === state) {
            pendingStateRef.current = null;
          }
        }
      };

      if (isImmediate) {
        performSync();
      } else {
        syncTimeoutRef.current = setTimeout(performSync, 200);
      }
    });

    return () => {
      unsubscribe();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [isLoaded, user?.id, hasHydrated]);

  // 3. Force Flush Pending State on Unload/Visibility Change
  useEffect(() => {
    if (!hasHydrated || !isLoaded || !user) return;

    const flushSync = async () => {
      if (suppressSync) return;
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

          inFlightWrites.current++;
          const updateTime = new Date().toISOString();

          if (isSupabaseConfigured && supabase) {
            await supabase.from('user_states').upsert({
              id: user.id,
              state: sanitizeStateForFirestore(stateToSave),
              updated_at: updateTime
            });
          }
          ignoreSnapshotUntilRef.current = Date.now() + 3000;
          console.log('SyncProvider - successfully flushed state on unload');
        } catch (err) {
          console.error('Failed to flush state on unload:', err);
        } finally {
          inFlightWrites.current--;
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
