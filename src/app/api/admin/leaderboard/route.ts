import { NextResponse } from 'next/server';
import { DailyActivity } from '@/lib/models/DailyActivity';
import { auth, currentUser } from '@clerk/nextjs/server';
import { isAdminEmail } from '@/lib/admin';

export async function GET(request: Request) {
  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress || '';

  if (!userId || !isAdminEmail(email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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
