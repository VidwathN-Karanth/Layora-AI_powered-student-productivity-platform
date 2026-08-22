import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/authz';
import { AdminLog, RETENTION_DAYS } from '@/lib/models/AdminLog';

/** The trail, newest first. Admins only — this is who-did-what about them. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const logs = await AdminLog.recent();
    return NextResponse.json({ logs, retentionDays: RETENTION_DAYS });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Admin GET logs failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/**
 * Records that an admin opened the console.
 *
 * The body is ignored on purpose: the actor, the action and the timestamp all
 * come from the session and the server clock, so a client cannot write a line
 * that says something else happened.
 */
export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await AdminLog.recordAccess(guard.requester);
  return NextResponse.json({ success: true });
}

export const dynamic = 'force-dynamic';
