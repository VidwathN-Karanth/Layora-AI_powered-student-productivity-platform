import { NextResponse } from 'next/server';
import { runSyncSlice } from '@/lib/syncLogic';
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
    const { date, offset: rawOffset } = body;
    let targetDate = date;

    // Same slicing as the nightly cron, for the same reason: the whole
    // department no longer fits in one request. The console posts again with
    // the returned nextOffset until it comes back null, so the admin sees
    // progress instead of a button that appears to hang and then fails.
    const offset = rawOffset === undefined ? 0 : Number(rawOffset);
    if (!Number.isFinite(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'offset must be a non-negative number.' },
        { status: 400 }
      );
    }

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

    const { nextOffset, ...stats } = await runSyncSlice(targetDate, { offset });
    const done = nextOffset === null;

    // One line per run, not one per page: the log records that an admin ran
    // the sync, and a five-page run is still one thing they did.
    if (done) {
      await AdminLog.record({
        actor: { userId, email, name },
        action: 'stats.sync',
        summary: `Ran the coding-stats sync by hand for ${targetDate}`,
        target: targetDate,
      });
    }

    return NextResponse.json({
      success: true,
      done,
      nextOffset,
      message: done
        ? `Manually triggered sync completed for date: ${targetDate}`
        : `Synced ${stats.processed} student(s) from ${offset}; resume at ${nextOffset}`,
      stats
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Manual sync failed:`, errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// Matches the cron route: runSyncSlice budgets itself well inside this.
export const maxDuration = 60;
