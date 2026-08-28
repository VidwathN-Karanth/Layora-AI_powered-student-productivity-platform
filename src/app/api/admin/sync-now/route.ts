import { NextResponse } from 'next/server';
import { runSyncForDate } from '@/lib/syncLogic';
import { requireAdmin } from '@/lib/authz';
import { AdminLog } from '@/lib/models/AdminLog';

export async function POST(request: Request) {
  try {
    // The shared guard rather than a local email compare, so this route
    // inherits whatever requireAdmin() grows into.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;
    const { userId, email, name } = guard.requester;

    const body = await request.json().catch(() => ({}));
    const { date } = body;
    let targetDate = date;

    if (targetDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        return NextResponse.json(
          { error: 'Invalid date format. Expected YYYY-MM-DD.' },
          { status: 400 }
        );
      }
    } else {
      // Default to today (UTC)
      const today = new Date();
      targetDate = today.toISOString().split('T')[0];
    }

    const stats = await runSyncForDate(targetDate);

    await AdminLog.record({
      actor: { userId, email, name },
      action: 'stats.sync',
      summary: `Ran the coding-stats sync by hand for ${targetDate}`,
      target: targetDate,
    });

    return NextResponse.json({
      success: true,
      message: `Manually triggered sync completed for date: ${targetDate}`,
      stats
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Manual sync failed:`, errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
