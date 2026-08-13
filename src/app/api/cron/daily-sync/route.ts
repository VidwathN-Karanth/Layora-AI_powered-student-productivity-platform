import { NextResponse } from 'next/server';
import { runSyncForDate } from '@/lib/syncLogic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: this route must always be protected by CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET not set' }, { status: 500 });
  }
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Sync for the current day (today) since cron runs at 10:00 PM IST (4:30 PM UTC)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`[Cron Route] Starting cron sync run for: ${todayStr}`);
    const stats = await runSyncForDate(todayStr);

    return NextResponse.json({
      success: true,
      message: `Cron sync completed for date: ${todayStr}`,
      stats
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Daily cron sync route encountered an error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Prevent static compilation caching
