import { NextResponse } from 'next/server';
import { runSyncForDate } from '@/lib/syncLogic';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
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
