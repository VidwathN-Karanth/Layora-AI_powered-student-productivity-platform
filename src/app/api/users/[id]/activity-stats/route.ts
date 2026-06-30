import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { User } from '@/lib/models/User';
import { DailyActivity } from '@/lib/models/DailyActivity';
import { pointsConfig } from '@/lib/points';
import { isAdminEmail } from '@/lib/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;

  try {
    const { userId: authedUserId } = await auth();
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || '';
    const isAdmin = authedUserId && isAdminEmail(email);

    if (!authedUserId || (authedUserId !== userId && !isAdmin)) {
      return NextResponse.json({ error: 'Unauthorized user access' }, { status: 401 });
    }
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const activities = await DailyActivity.findByUserId(userId);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setUTCDate(today.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const lastWeekDate = new Date();
    lastWeekDate.setUTCDate(today.getUTCDate() - 6);
    const lastWeekStr = lastWeekDate.toISOString().split('T')[0];

    const lastMonthDate = new Date();
    lastMonthDate.setUTCDate(today.getUTCDate() - 29);
    const lastMonthStr = lastMonthDate.toISOString().split('T')[0];

    // Initialize stats structure
    const stats = {
      today: { commits: 0, solves: 0, points: 0 },
      yesterday: { commits: 0, solves: 0, points: 0 },
      week: { commits: 0, solves: 0, points: 0 },
      month: { commits: 0, solves: 0, points: 0 },
      allTime: {
        commits: 0,
        solves: user.leetcodeEasyTotal + user.leetcodeMediumTotal + user.leetcodeHardTotal + (user.codechefSolvedTotal || 0),
        points: (user.leetcodeEasyTotal * pointsConfig.leetcode.Easy) +
                (user.leetcodeMediumTotal * pointsConfig.leetcode.Medium) +
                (user.leetcodeHardTotal * pointsConfig.leetcode.Hard) +
                ((user.codechefSolvedTotal || 0) * (pointsConfig.codechef?.perSolve || 15)),
        leetcodeUsername: user.leetcodeUsername,
        githubUsername: user.githubUsername,
        codechefUsername: user.codechefUsername
      }
    };

    // Calculate helper for git points (GitHub points are disabled, always 0)
    const getGitPoints = (commits: number) => {
      return 0;
    };

    for (const act of activities) {
      const actDate = act.date;
      const ghPoints = getGitPoints(act.githubContributionsToday);

      // All time github
      stats.allTime.commits += act.githubContributionsToday;
      stats.allTime.points += ghPoints;

      // Today
      if (actDate === todayStr) {
        stats.today.commits = act.githubContributionsToday;
        stats.today.solves = act.leetcodeSolvedToday + (act.codechefSolvedToday || 0);
        stats.today.points = act.pointsEarned;
      }

      // Yesterday
      if (actDate === yesterdayStr) {
        stats.yesterday.commits = act.githubContributionsToday;
        stats.yesterday.solves = act.leetcodeSolvedToday + (act.codechefSolvedToday || 0);
        stats.yesterday.points = act.pointsEarned;
      }

      // Week (date >= lastWeekStr)
      if (actDate >= lastWeekStr) {
        stats.week.commits += act.githubContributionsToday;
        stats.week.solves += act.leetcodeSolvedToday + (act.codechefSolvedToday || 0);
        stats.week.points += act.pointsEarned;
      }

      // Month (date >= lastMonthStr)
      if (actDate >= lastMonthStr) {
        stats.month.commits += act.githubContributionsToday;
        stats.month.solves += act.leetcodeSolvedToday + (act.codechefSolvedToday || 0);
        stats.month.points += act.pointsEarned;
      }
    }

    return NextResponse.json(stats);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error loading activity stats for user ${userId}:`, errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
