import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete Supabase user data
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('user_states')
        .delete()
        .eq('id', userId);
      if (error) throw error;
      console.log(`Purge: Deleted Supabase document for user ${userId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Purge failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
