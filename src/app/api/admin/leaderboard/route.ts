import { NextResponse } from 'next/server';
import { DailyActivity } from '@/lib/models/DailyActivity';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || 'all';

  const validRanges = ['today', 'week', 'all'];
  if (!validRanges.includes(range)) {
    return NextResponse.json(
      { error: `Invalid range parameter "${range}". Valid options are: today, week, all.` },
      { status: 400 }
    );
  }

  try {
    const leaderboard = await DailyActivity.getLeaderboard(range as 'today' | 'week' | 'all');
    return NextResponse.json(leaderboard);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Leaderboard fetch failed for range "${range}":`, errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic'; // Prevent Next.js from caching GET at build-time
