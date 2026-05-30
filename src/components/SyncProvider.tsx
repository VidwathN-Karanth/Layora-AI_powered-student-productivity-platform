'use client';

import React, { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const isHydrated = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load from Supabase
  useEffect(() => {
    console.log('SyncProvider - checking Supabase config:', { isSupabaseConfigured, hasUser: !!user });
    if (!isLoaded || !user || !isSupabaseConfigured || !supabase) {
      return;
    }

    const loadState = async () => {
      try {
        const { data, error } = await supabase!
          .from('user_states')
          .select('state')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching state from Supabase:', error);
        }

        if (data && data.state) {
          console.log('SyncProvider - successfully loaded state from Supabase');
          useStore.getState().setFullState(data.state);
        } else {
          console.log('SyncProvider - no state found in Supabase for user');
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
    if (!isLoaded || !user || !isSupabaseConfigured || !supabase) {
      return;
    }

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

          const { error } = await supabase!.from('user_states').upsert({
            user_id: user.id,
            state: stateToSave,
            updated_at: new Date().toISOString()
          });
          
          if (error) {
            console.error('Supabase Upsert Error:', error);
          } else {
            console.log('SyncProvider - successfully pushed state to Supabase');
          }
        } catch (err) {
          console.error('Failed to sync state to Supabase:', err);
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
