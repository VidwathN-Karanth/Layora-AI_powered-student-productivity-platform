import { NextResponse } from 'next/server';
import { runSyncForDate } from '@/lib/syncLogic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Enforce security in production when CRON_SECRET is configured
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Sync for the day that just ended (yesterday UTC)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log(`[Cron Route] Starting cron sync run for: ${yesterdayStr}`);
    const stats = await runSyncForDate(yesterdayStr);

    return NextResponse.json({
      success: true,
      message: `Cron sync completed for date: ${yesterdayStr}`,
      stats
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Daily cron sync route encountered an error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Prevent static compilation caching
