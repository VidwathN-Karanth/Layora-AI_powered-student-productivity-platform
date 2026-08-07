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
      return NextResponse.json({ globalAiChatEnabled: true });
    }

    const { data, error } = await supabaseAdmin
      .from('user_states')
      .select('state')
      .eq('id', 'global_settings')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Row not created yet, default to true
        return NextResponse.json({ globalAiChatEnabled: true });
      }
      throw error;
    }

    const globalAiChatEnabled = data?.state?.globalAiChatEnabled !== false;
    return NextResponse.json({ globalAiChatEnabled });
  } catch (error: any) {
    console.error('Failed to GET global settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || '';

    if (!userId || !isAdminEmail(email)) {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { globalAiChatEnabled } = body;

    if (globalAiChatEnabled === undefined) {
      return NextResponse.json({ error: 'Missing globalAiChatEnabled field' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('user_states')
      .upsert({
        id: 'global_settings',
        state: { globalAiChatEnabled },
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return NextResponse.json({ success: true, globalAiChatEnabled });
  } catch (error: any) {
    console.error('Failed to POST global settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
