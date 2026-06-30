import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { isAdminEmail } from '@/lib/admin';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ state: null, isLocalMode: true });
    }

    // 1. Fetch the state from user_states table first
    const { data, error } = await supabaseAdmin
      .from('user_states')
      .select('state')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 2. No user_states row found. Check if the user is an admin
        const clerkUser = await currentUser();
        const email = clerkUser?.primaryEmailAddress?.emailAddress || '';
        if (email && isAdminEmail(email)) {
          // Admin users should bypass onboarding
          const adminDefaultState = {
            user: {
              name: clerkUser?.fullName || 'Admin User',
              email: email,
              streakCount: 0,
              totalStudyHours: 0,
              isOnboarded: true,
              wakeTime: '06:00',
              sleepTime: '22:00',
              collegeStart: '09:00',
              collegeEnd: '16:00',
              freeBlocks: [
                { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
                { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
              ]
            }
          };
          return NextResponse.json({ state: adminDefaultState });
        }

        // 3. Check if they exist in the users table
        const { data: dbUser, error: dbUserError } = await supabaseAdmin
          .from('users')
          .select('id, name, email')
          .eq('id', userId)
          .single();

        if (dbUser && !dbUserError) {
          // If they exist in users table, they are an existing user.
          // Bypass onboarding with a default state.
          const existingDefaultState = {
            user: {
              name: dbUser.name,
              email: dbUser.email,
              streakCount: 0,
              totalStudyHours: 0,
              isOnboarded: true,
              wakeTime: '06:00',
              sleepTime: '22:00',
              collegeStart: '09:00',
              collegeEnd: '16:00',
              freeBlocks: [
                { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
                { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
              ]
            }
          };
          return NextResponse.json({ state: existingDefaultState });
        }

        // Truly a new user
        return NextResponse.json({ state: null });
      }
      throw error;
    }

    return NextResponse.json({ state: data?.state || null });
  } catch (error: any) {
    console.error('Server GET state failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
    }

    const { state } = await request.json();

    // 1. Upsert into user_states
    const { error: stateError } = await supabaseAdmin
      .from('user_states')
      .upsert({
        id: userId,
        state,
        updated_at: new Date().toISOString()
      });

    if (stateError) throw stateError;

    // 2. Automatically register / sync the user metadata to the users table
    if (state?.user) {
      try {
        await supabaseAdmin
          .from('users')
          .upsert({
            id: userId,
            name: state.user.name || 'Student',
            email: state.user.email || '',
            leetcode_username: state.user.leetcodeUsername || null,
            github_username: state.user.githubUsername || null,
            codechef_username: state.user.codechefUsername || null,
            linkedin_url: state.user.linkedinUrl || null
          }, {
            onConflict: 'id'
          });
      } catch (userUpsertError) {
        console.warn('[Sync] Auto users table sync skipped or failed:', userUpsertError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Server POST state failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
