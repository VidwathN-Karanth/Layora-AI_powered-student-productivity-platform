import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/admin';

// Helper to check admin access
async function verifyAdminAccess() {
  const { userId: authedUserId } = await auth();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || '';
  return authedUserId && isAdminEmail(email);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const isAuthorized = await verifyAdminAccess();
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }

    const { state } = await req.json();

    const { error } = await supabaseAdmin
      .from('user_states')
      .upsert({
        id: userId,
        state,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`Admin update user ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const isAuthorized = await verifyAdminAccess();
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }

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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`Admin delete user failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
