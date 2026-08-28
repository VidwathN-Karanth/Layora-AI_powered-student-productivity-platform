import { NextResponse } from 'next/server';
import { runSyncSlice } from '@/lib/syncLogic';
import { AdminLog, RETENTION_DAYS } from '@/lib/models/AdminLog';
import { DailyActivity } from '@/lib/models/DailyActivity';

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
    const url = new URL(request.url);

    // One call syncs one page of students and reports where to resume. The
    // caller keeps calling with the returned offset until it comes back null.
    //
    // It is done this way because a serverless function has a hard time limit
    // and the whole department no longer fits inside one: at 800 students the
    // old single-pass run took a quarter of an hour, so the platform would kill
    // it partway and the students in the unreached half would silently miss a
    // day of points.
    const rawOffset = url.searchParams.get('offset');
    const offset = rawOffset ? Number(rawOffset) : 0;
    if (!Number.isFinite(offset) || offset < 0) {
      return NextResponse.json({ error: 'offset must be a non-negative number.' }, { status: 400 });
    }

    // Sync for the current day (today) since cron runs at 10:00 PM IST (4:30 PM UTC)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    console.log(`[Cron Route] Sync slice at offset ${offset} for: ${todayStr}`);
    const { nextOffset, ...stats } = await runSyncSlice(todayStr, { offset });

    const done = nextOffset === null;

    // The admin trail is swept on the same nightly run rather than by a cron of
    // its own: one schedule is one thing to keep working, and a day of extra
    // lines is harmless — the reader never shows past the retention window.
    //
    // Only on the final slice, or it would run once per page.
    let purgedLogs = 0;
    let ledgerRows: number | null = null;
    if (done) {
      try {
        purgedLogs = await AdminLog.purgeExpired();
        console.log(`[Cron Route] Purged ${purgedLogs} admin log line(s) older than ${RETENTION_DAYS} days`);
      } catch (purgeError: unknown) {
        // A failed sweep must not fail the sync that students depend on.
        const msg = purgeError instanceof Error ? purgeError.message : String(purgeError);
        console.error('[Cron Route] Admin log purge failed:', msg);
      }

      // One line a night saying how big the points ledger has grown. It is
      // reported, never trimmed — see DailyActivity.footprint for why cutting
      // old rows would silently lower every student's all-time score. This is
      // the early warning for Supabase's 500 MB limit.
      try {
        ledgerRows = (await DailyActivity.footprint()).rows;
        console.log(`[Cron Route] Activity ledger now holds ${ledgerRows} row(s)`);
      } catch (sizeError: unknown) {
        const msg = sizeError instanceof Error ? sizeError.message : String(sizeError);
        console.warn('[Cron Route] Could not measure the activity ledger:', msg);
      }
    }

    return NextResponse.json({
      success: true,
      done,
      nextOffset,
      message: done
        ? `Cron sync completed for date: ${todayStr}`
        : `Synced students ${offset}-${offset + stats.processed - 1}; resume at ${nextOffset}`,
      stats,
      purgedLogs,
      ledgerRows
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Daily cron sync route encountered an error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Prevent static compilation caching

// Vercel's Hobby ceiling. runSyncSlice keeps its own, smaller budget so it
// returns an answer rather than being killed mid-student.
export const maxDuration = 60;
