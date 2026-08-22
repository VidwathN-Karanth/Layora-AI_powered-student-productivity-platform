import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/authz';
import { User } from '@/lib/models/User';
import { AdminLog } from '@/lib/models/AdminLog';

/** How a student appears in the audit trail: a name, not a Clerk id. */
async function describeStudent(userId: string): Promise<string> {
  try {
    const user = await User.findById(userId);
    if (!user) return userId;
    return user.name ? `${user.name} (${user.email})` : user.email || userId;
  } catch {
    return userId;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { state } = await req.json();

    const { error } = await supabaseAdmin
      .from('user_states')
      .upsert({
        id: userId,
        state,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    await AdminLog.record({
      actor: guard.requester,
      action: 'student.update',
      summary: `Edited the workspace of ${await describeStudent(userId)}`,
      target: userId,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Admin update user failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    // Read the name before the row goes — afterwards there is nothing left to
    // identify them by, and "deleted 3f9a…" is not an audit trail.
    const description = await describeStudent(userId);

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

    await AdminLog.record({
      actor: guard.requester,
      action: 'student.delete',
      summary: `Deleted ${description} and all of their activity history`,
      target: userId,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Admin delete user failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
