import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ state: null, isLocalMode: true });
    }

    const { data, error } = await supabaseAdmin
      .from('user_states')
      .select('state')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found
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

    const { error } = await supabaseAdmin
      .from('user_states')
      .upsert({
        id: userId,
        state,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Server POST state failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

