import { NextResponse } from 'next/server';
import { runSyncForDate } from '@/lib/syncLogic';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isAdminEmail } from '@/lib/admin';
import { AdminLog } from '@/lib/models/AdminLog';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || '';

    if (!userId || !isAdminEmail(email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      actor: { userId, email, name: user?.fullName ?? null },
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
