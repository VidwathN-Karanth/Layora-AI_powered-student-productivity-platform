import { NextResponse } from 'next/server';
import { DailyActivity } from '@/lib/models/DailyActivity';
import { requireStudent } from '@/lib/authz';
import { emailsForCohort } from '@/lib/roster';

const VALID_RANGES = ['today', 'week', 'all'] as const;
type Range = (typeof VALID_RANGES)[number];

/**
 * The student-facing leaderboard, scoped to the caller's own academic year.
 *
 * The cohort comes from the session, never from a query parameter — a 2nd year
 * has no way to ask for the 3rd year board.
 */
export async function GET(request: Request) {
  const guard = await requireStudent();
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
      restrictToEmails: emailsForCohort(cohort),
    });
    return NextResponse.json({ cohort, range, leaderboard });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Leaderboard fetch failed for ${cohort} / "${range}":`, errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
