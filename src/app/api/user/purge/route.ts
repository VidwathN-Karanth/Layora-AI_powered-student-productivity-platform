import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete Supabase user data
    if (isSupabaseConfigured) {
      // 1. Delete from user_states
      const { error: stateError } = await supabaseAdmin
        .from('user_states')
        .delete()
        .eq('id', userId);
      if (stateError) throw stateError;

      // 2. Delete from daily_activities
      const { error: activityError } = await supabaseAdmin
        .from('daily_activities')
        .delete()
        .eq('user_id', userId);
      if (activityError) throw activityError;

      // 3. Delete from users
      const { error: userError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);
      if (userError) throw userError;

      console.log(`Purge: Deleted all Supabase documents for user ${userId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Purge failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

