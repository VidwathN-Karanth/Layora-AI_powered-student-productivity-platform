import { NextResponse } from 'next/server';
import { DailyActivity } from '@/lib/models/DailyActivity';
import { requireAdminCohort } from '@/lib/authz';
import { emailsForCohort } from '@/lib/roster';

const VALID_RANGES = ['today', 'week', 'all'] as const;
type Range = (typeof VALID_RANGES)[number];

/**
 * The admin leaderboard for one academic year.
 *
 * `?cohort=` is required: the console shows one year at a time, so a request
 * that does not say which year is a bug rather than a request for everything.
 */
export async function GET(request: Request) {
  const guard = await requireAdminCohort(request.url);
  if (!guard.ok) return guard.response;

  const { cohort } = guard.requester;
  const range = new URL(request.url).searchParams.get('range') || 'all';

  if (!(VALID_RANGES as readonly string[]).includes(range)) {
    return NextResponse.json(
      { error: `Invalid range parameter "${range}". Valid options are: ${VALID_RANGES.join(', ')}.` },
      { status: 400 }
    );
  }

  try {
    const leaderboard = await DailyActivity.getLeaderboard(range as Range, {
      restrictToEmails: await emailsForCohort(cohort),
    });
    return NextResponse.json({ cohort, range, leaderboard });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Admin leaderboard fetch failed for ${cohort} / "${range}":`, errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Prevent Next.js from caching GET at build-time
