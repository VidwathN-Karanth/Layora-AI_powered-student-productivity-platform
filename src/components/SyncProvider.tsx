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
  const initialCloudLoadSucceededRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<any>(null);
  const lastSavedSerializedRef = useRef<string>('');
  const lastSavedSubjectsRef = useRef<any[]>([]);
  const lastSavedResourcesRef = useRef<any>({});
  const inFlightWrites = useRef(0);
  const ignoreSnapshotUntilRef = useRef<number>(0);

  // Sequential Sync Queue refs
  const isWritingRef = useRef(false);
  const pendingWriteRef = useRef<{ stateToSave: any; serialized: string } | null>(null);
  const lastLocalWriteTimestampRef = useRef<number>(0);

  const themeAccent = useStore((state) => state.themeAccent);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const isCloudLoaded = useStore((state) => state.isCloudLoaded);

  const serverLog = (msg: string, isError = false) => {
    if (isError) {
      console.error(msg);
    } else {
      console.log(msg);
    }
    if (typeof window !== 'undefined') {
      fetch('/api/debug-log/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      }).catch(() => {});
    }
  };

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
    
    // Mark cloud load as successful
    initialCloudLoadSucceededRef.current = true;
    
    // Ignore snapshot if there are pending local writes, in-flight writes, or active queue processing
    if (pendingStateRef.current !== null || inFlightWrites.current > 0 || isWritingRef.current || pendingWriteRef.current !== null) {
      console.log(`SyncProvider - ignoring ${source} snapshot due to pending/in-flight writes`);
      return;
    }

    // Ignore snapshot echo cooldown
    if (Date.now() < ignoreSnapshotUntilRef.current) {
      console.log(`SyncProvider - ignoring ${source} snapshot echo (post-write cooldown)`);
      return;
    }

    // Prevent out-of-order and echo overwrites via client timestamp validation
    if (cloudState?.clientTimestamp && cloudState.clientTimestamp <= lastLocalWriteTimestampRef.current) {
      console.log(`SyncProvider - ignoring cloud state update: cloud clientTimestamp (${cloudState.clientTimestamp}) <= local lastLocalWriteTimestamp (${lastLocalWriteTimestampRef.current})`);
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

      if (isSupabaseConfigured) {
        const migrationTimestamp = Date.now();
        lastLocalWriteTimestampRef.current = migrationTimestamp;
        const stateWithTimestamp = { ...stateToSave, clientTimestamp: migrationTimestamp };

        fetch('/api/user/state/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: sanitizeStateForFirestore(stateWithTimestamp) })
        }).then((res) => {
          if (!res.ok) {
            console.error('Failed to initialise Supabase state: HTTP error', res.status);
          }
        }).catch((err) => {
          console.error('Failed to initialise Supabase state:', err);
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
      if (cloudState.clientTimestamp) {
        lastLocalWriteTimestampRef.current = cloudState.clientTimestamp;
      }
    }
    isHydrated.current = true;
    useStore.getState().setIsCloudLoaded(true);
  };

  // 1. Listen to Real-Time Updates from Supabase
  useEffect(() => {
    if (!hasHydrated || !isLoaded || !user) {
      serverLog(`SyncProvider - skipping, conditions not met: hasHydrated=${hasHydrated}, isLoaded=${isLoaded}, hasUser=${!!user}`);
      return;
    }

    let supabaseChannel: any = null;

    serverLog(`SyncProvider - ✓ All conditions met, loading data from Supabase. user.id=${user.id}, isSupabaseConfigured=${isSupabaseConfigured}`);

    if (isSupabaseConfigured && supabase) {
      const loadInitialSupabaseState = async () => {
        try {
          serverLog('SyncProvider - attempting to fetch user state from Server Proxy...');
          
          // Wrap the database query in a promise race with an 8-second timeout to prevent infinite loader hangs
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Server state fetch timed out after 8000ms')), 8000)
          );

          const fetchPromise = fetch('/api/user/state/').then(async (res) => {
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP error ${res.status}`);
            }
            return res.json();
          });

          const result = await Promise.race([fetchPromise, timeoutPromise]) as any;

          if (result.isLocalMode) {
            serverLog('SyncProvider - running in local-only demo mode (Supabase not configured)');
          } else if (result.state) {
            serverLog(`SyncProvider - ✓ Loaded existing state from Server Proxy: isOnboarded=${result.state.user?.isOnboarded}, subjects=${result.state.subjects?.length || 0}`);
            await processIncomingCloudState(result.state, 'supabase');
          } else {
            serverLog('SyncProvider - no existing cloud data (first login), creating new state');
            await processIncomingCloudState({}, 'supabase');
          }
        } catch (err: any) {
          serverLog(`SyncProvider - CRITICAL: Failed to load initial state: ${err.message}`, true);
        } finally {
          isHydrated.current = true;
          useStore.getState().setIsCloudLoaded(true);
        }
      };

      loadInitialSupabaseState();

      // Subscribe to real-time table modifications for this row
      supabaseChannel = supabase
        .channel(`realtime:user_states:id=eq.${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_states',
            filter: `id=eq.${user.id}`
          },
          async (payload) => {
            serverLog('SyncProvider - real-time update received from Supabase');
            const newState = (payload.new as any)?.state;
            if (newState) {
              await processIncomingCloudState(newState, 'supabase');
            }
          }
        )
        .subscribe();
    } else {
      serverLog('SyncProvider - Supabase is not configured, running in local-only demo mode');
      isHydrated.current = true;
      useStore.getState().setIsCloudLoaded(true);
    }

    return () => {
      if (supabaseChannel && supabase) supabase.removeChannel(supabaseChannel);
    };
  }, [isLoaded, user?.id, hasHydrated]);

  // 2. Subscribe to local Store Changes and sync using a sequential write queue
  useEffect(() => {
    if (!hasHydrated || !isLoaded || !user) return;

    // Helper that executes database upserts sequentially
    const performSync = async (stateToSave: any, serialized: string) => {
      if (suppressSync) return;
      isWritingRef.current = true;
      try {
        inFlightWrites.current++;

        if (isSupabaseConfigured) {
          const res = await fetch('/api/user/state/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: sanitizeStateForFirestore(stateToSave) })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${res.status}`);
          }

          console.log('SyncProvider - ✓ Synced to Supabase via Server Proxy (Queue):', {
            subjects: stateToSave.subjects?.length,
            tasks: stateToSave.tasks?.length
          });
        }

        lastSavedSerializedRef.current = serialized;
        lastSavedSubjectsRef.current = stateToSave.subjects || [];
        lastSavedResourcesRef.current = stateToSave.resources || {};
        ignoreSnapshotUntilRef.current = Date.now() + 3000;
      } catch (err: any) {
        console.error('SyncProvider - CRITICAL: Failed to save to Supabase:', err);
      } finally {
        inFlightWrites.current--;
        
        // Check if a new write was staged while this write was in flight
        if (pendingWriteRef.current) {
          const nextWrite = pendingWriteRef.current;
          pendingWriteRef.current = null;
          // Trigger next sync asynchronously to avoid recursion call stack build-up
          setTimeout(() => {
            performSync(nextWrite.stateToSave, nextWrite.serialized);
          }, 0);
        } else {
          isWritingRef.current = false;
        }
      }
    };

    const unsubscribe = useStore.subscribe((state) => {
      if (!isHydrated.current) return;

      // Block writes if initial state load failed to prevent overwriting cloud state with empty defaults
      if (isSupabaseConfigured && !initialCloudLoadSucceededRef.current) {
        console.warn('SyncProvider - blocking write because initial cloud state load failed');
        return;
      }

      // Prevent syncing empty/null states during logout or unauthenticated phases
      if (!state.isAuthenticated || !state.user) {
        serverLog(`SyncProvider - store is unauthenticated or user is null, skipping sync. isAuthenticated=${state.isAuthenticated}, hasUser=${!!state.user}`);
        return;
      }

      const {
        user: storeUser, subjects, resources, activities, websites, courses, tasks,
        timetable, themeAccent, apiKeys, selectedModel,
        calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations
      } = state;

      const writeTimestamp = Date.now();
      lastLocalWriteTimestampRef.current = writeTimestamp;

      const stateToSave = {
        user: storeUser,
        subjects, resources, activities, websites, courses, tasks,
        timetable, themeAccent, apiKeys, selectedModel,
        calendarSynced, is24HourFormat, chatHistory, proactiveRecommendations,
        clientTimestamp: writeTimestamp
      };

      const serialized = JSON.stringify(stateToSave);
      if (serialized === lastSavedSerializedRef.current) return;

      // Keep pendingStateRef updated for unload flush
      pendingStateRef.current = state;

      // Queue state writes: immediate execution if queue is idle, otherwise stage the latest state
      if (isWritingRef.current) {
        pendingWriteRef.current = { stateToSave, serialized };
        console.log('SyncProvider - Sync in progress, staging next write');
      } else {
        performSync(stateToSave, serialized);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isLoaded, user?.id, hasHydrated]);

  // 3. Force Flush Pending State/Queue on Unload/Visibility Change
  useEffect(() => {
    if (!hasHydrated || !isLoaded || !user) return;

    const flushSync = async () => {
      if (suppressSync) return;

      // Block flush if initial state load failed to prevent overwriting cloud state with empty defaults
      if (isSupabaseConfigured && !initialCloudLoadSucceededRef.current) {
        return;
      }

      const maxWaitTime = 5000; // Max 5 seconds
      const startTime = Date.now();

      // Wait for any in-flight writes or current queue executions to complete
      while ((isWritingRef.current || inFlightWrites.current > 0) && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // If a write is still pending in the queue, flush it out
      if (pendingWriteRef.current) {
        const toWrite = pendingWriteRef.current;
        pendingWriteRef.current = null;
        try {
          isWritingRef.current = true;
          inFlightWrites.current++;
          const updateTime = new Date().toISOString();

          if (isSupabaseConfigured) {
            const res = await fetch('/api/user/state/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ state: sanitizeStateForFirestore(toWrite.stateToSave) })
            });
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          }
          lastSavedSerializedRef.current = toWrite.serialized;
          ignoreSnapshotUntilRef.current = Date.now() + 3000;
          console.log('SyncProvider - ✓ Flushed pending queue write to Supabase on page unload');
        } catch (err) {
          console.error('SyncProvider - CRITICAL: Failed to flush pending queue write on unload:', err);
        } finally {
          inFlightWrites.current--;
          isWritingRef.current = false;
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
