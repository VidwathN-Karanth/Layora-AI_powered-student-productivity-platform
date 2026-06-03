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

  const themeAccent = useStore((state) => state.themeAccent);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const isCloudLoaded = useStore((state) => state.isCloudLoaded);

  const sanitizeStateForFirestore = (state: any) => {
    return JSON.parse(JSON.stringify(state));
  };

  // Set hasHydrated to true on client-side mount and clear old localStorage leftovers
  useEffect(() => {
    useStore.getState().setHasHydrated(true);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('layora-productivity-store');
    }
  }, []);

  // 0. Update DOM theme dynamically when state changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', themeAccent || 'purple');
    }
  }, [themeAccent]);

  // Cloud-wins: Supabase is the authoritative source of truth for all data arrays.
  // We no longer merge local data into cloud data — that was causing stale local subjects/tasks
  // to contaminate fresh cloud data when opening on a new device.
  //
  // The only exception: if Supabase has NO data yet (first login / empty cloud),
  // we upload the local state to initialise the cloud record (one-time migration).

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

    // Check if cloud has actual data (subjects, tasks, timetable, etc) - not just onboarding status
    const cloudHasData = (cloudState.subjects && cloudState.subjects.length > 0) ||
                         (cloudState.tasks && cloudState.tasks.length > 0) ||
                         (cloudState.timetable && cloudState.timetable.length > 0) ||
                         (cloudState.activities && cloudState.activities.length > 0) ||
                         (cloudState.courses && cloudState.courses.length > 0) ||
                         (cloudState.websites && cloudState.websites.length > 0);
    const cloudIsEmpty = !cloudHasData && (!cloudState.user || !cloudState.user.isOnboarded);

    if (localHasData && cloudIsEmpty) {
      // First-time migration: upload local state to Supabase to seed the cloud record.
      console.log(`SyncProvider - cloud is empty, uploading local state to ${source}`);
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
          if (error) console.error('Failed to initialise Supabase state:', error);
        });
      }

      useStore.getState().setFullState(stateToSave);
      lastSavedSerializedRef.current = JSON.stringify(stateToSave);
      lastSavedSubjectsRef.current = stateToSave.subjects || [];
      lastSavedResourcesRef.current = stateToSave.resources || {};
    } else {
      // CLOUD-WINS: Apply Supabase data directly — no local merge.
      // All data arrays (subjects, tasks, timetable, courses, activities, websites, resources)
      // come exclusively from Supabase. This guarantees cross-device consistency.
      console.log(`SyncProvider - applying ${source} cloud state (cloud-wins)`);

      const cloudStateToApply = {
        ...cloudState,
        // Merge user profile: take the best values from both
        user: cloudState.user ? {
          ...cloudState.user,
          streakCount: Math.max(cloudState.user.streakCount ?? 0, localState.user?.streakCount ?? 0),
          totalStudyHours: Math.max(cloudState.user.totalStudyHours ?? 0, localState.user?.totalStudyHours ?? 0),
        } : localState.user,
        // Settings: prefer cloud, fall back to device-local localStorage value
        themeAccent: cloudState.themeAccent || localState.themeAccent || 'purple',
        selectedModel: cloudState.selectedModel || localState.selectedModel || 'groq',
        is24HourFormat: cloudState.is24HourFormat ?? localState.is24HourFormat ?? false,
        calendarSynced: cloudState.calendarSynced ?? localState.calendarSynced ?? false,
        apiKeys: { ...(localState.apiKeys || {}), ...(cloudState.apiKeys || {}) },
        // chatHistory is device-local — don't overwrite with cloud version
        chatHistory: localState.chatHistory,
      };

      useStore.getState().setFullState(cloudStateToApply);
      lastSavedSerializedRef.current = JSON.stringify(cloudStateToApply);
      lastSavedSubjectsRef.current = cloudStateToApply.subjects || [];
      lastSavedResourcesRef.current = cloudStateToApply.resources || {};
    }
    isHydrated.current = true;
    useStore.getState().setIsCloudLoaded(true);
  };

  // 1. Listen to Real-Time Updates from Supabase
  useEffect(() => {
    if (!hasHydrated || !isLoaded || !user) {
      console.log('SyncProvider - skipping, conditions not met:', { hasHydrated, isLoaded, hasUser: !!user });
      return;
    }

    let supabaseChannel: any = null;

    console.log('SyncProvider - ✓ All conditions met, loading data from Supabase', {
      userId: user.id,
      isSupabaseConfigured
    });

    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      const loadInitialSupabaseState = async () => {
        try {
          console.log('SyncProvider - attempting to fetch user state from Supabase...');
          const { data, error } = await client
            .from('user_states')
            .select('state')
            .eq('id', user.id)
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              // No data found - this is expected for first login
              console.log('SyncProvider - no existing cloud data (first login), creating new state');
              processIncomingCloudState({}, 'supabase');
            } else {
              console.error('SyncProvider - CRITICAL: Database query failed:', error);
              throw error;
            }
          } else if (data && data.state) {
            console.log('SyncProvider - ✓ Loaded existing state from Supabase:', {
              isOnboarded: data.state.user?.isOnboarded,
              subjects: data.state.subjects?.length || 0,
              tasks: data.state.tasks?.length || 0
            });
            processIncomingCloudState(data.state, 'supabase');
          } else {
            console.warn('SyncProvider - unexpected: no data but no error');
            processIncomingCloudState({}, 'supabase');
          }
        } catch (err) {
          console.error('SyncProvider - CRITICAL: Failed to load initial Supabase state:', err);
          // Still mark as loaded even if failed to prevent infinite loops
          useStore.getState().setIsCloudLoaded(true);
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

      // Prevent syncing empty/null states during logout or unauthenticated phases
      if (!state.isAuthenticated || !state.user) {
        console.log('SyncProvider - store is unauthenticated or user is null, skipping sync');
        return;
      }

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

      pendingStateRef.current = state;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      // Perform immediate sync for ALL changes (no debouncing) - Supabase is the only source of truth
      const performSync = async () => {
        if (suppressSync) return;
        try {
          inFlightWrites.current++;
          const updateTime = new Date().toISOString();

          // Sync to Supabase immediately
          if (isSupabaseConfigured && supabase) {
            const { error } = await supabase
              .from('user_states')
              .upsert({
                id: user.id,
                state: sanitizeStateForFirestore(stateToSave),
                updated_at: updateTime
              });
            if (error) {
              console.error('SyncProvider - Supabase sync failed:', error);
              throw error;
            }
            console.log('SyncProvider - ✓ Synced to Supabase:', { subjects: subjects?.length, tasks: stateToSave.tasks?.length, timestamp: updateTime });
          }

          lastSavedSerializedRef.current = serialized;
          lastSavedSubjectsRef.current = subjects || [];
          lastSavedResourcesRef.current = resources || {};
          ignoreSnapshotUntilRef.current = Date.now() + 3000;
        } catch (err: any) {
          console.error('SyncProvider - CRITICAL: Failed to save to Supabase:', err);
          // Don't swallow errors - log them loudly so user knows sync failed
        } finally {
          inFlightWrites.current--;
          if (pendingStateRef.current === state) {
            pendingStateRef.current = null;
          }
        }
      };

      // Sync immediately - don't debounce, Supabase is the only source of truth
      performSync();
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

      // Flush any pending state and wait for in-flight writes
      const maxWaitTime = 5000; // Max 5 seconds
      const startTime = Date.now();
      while (inFlightWrites.current > 0 && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 50));
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
            const { error } = await supabase.from('user_states').upsert({
              id: user.id,
              state: sanitizeStateForFirestore(stateToSave),
              updated_at: updateTime
            });
            if (error) throw error;
          }
          ignoreSnapshotUntilRef.current = Date.now() + 3000;
          console.log('SyncProvider - ✓ Flushed & synced to Supabase on page unload');
        } catch (err) {
          console.error('SyncProvider - CRITICAL: Failed to flush state on unload:', err);
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

  if (isLoaded && user && !isCloudLoaded) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden cyber-grid font-mono">
        <div className="absolute w-[500px] h-[500px] bg-cyber-purple/15 -top-[10%] -right-[10%] rounded-full blur-[120px] animate-[pulse_8s_infinite_alternate] pointer-events-none"></div>
        <div className="absolute w-[500px] h-[500px] bg-cyber-blue/15 -bottom-[10%] -left-[10%] rounded-full blur-[120px] animate-[pulse_10s_infinite_alternate] pointer-events-none"></div>

        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border border-cyber-purple animate-ping"></div>
            <div className="absolute inset-2 rounded-full border border-cyber-blue/50 animate-pulse"></div>
            <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-cyber-purple to-cyber-blue flex items-center justify-center shadow-lg shadow-cyber-purple/20">
              <span className="text-white font-mono font-bold text-2xl tracking-tighter">L</span>
            </div>
          </div>
          
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue font-mono">
              LAYORA
            </h1>
            <p className="text-xs text-cyber-blue/60 font-mono mt-1">
              Synchronizing academic core...
            </p>
          </div>

          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyber-purple to-cyber-blue w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
          </div>
        </div>
        <style jsx global>{`
          @keyframes loading-bar {
            0% { left: -33%; width: 33%; }
            50% { width: 50%; }
            100% { left: 100%; width: 33%; }
          }
        `}</style>
      </main>
    );
  }

  return <>{children}</>;
}
