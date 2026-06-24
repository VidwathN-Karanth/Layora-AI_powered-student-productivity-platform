import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { User } from '@/lib/models/User';
import { DailyActivity } from '@/lib/models/DailyActivity';

export async function GET() {
  try {
    const { userId: authedUserId } = await auth();
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || '';

    // Verify requesting user is the system admin
    if (!authedUserId || email.toLowerCase() !== 'vidwathkaranth@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }

    // Fetch all users
    const users = await User.findAll();

    // Fetch leaderboard of all users (which collects points and sums up contributions)
    const leaderboard = await DailyActivity.getLeaderboard('all');

    // Create a map from userId to totalGithubContributions
    const githubContributionsMap = new Map<string, number>();
    for (const lbUser of leaderboard) {
      githubContributionsMap.set(lbUser.userId, lbUser.totalGithubContributions);
    }

    // Map user stats for exporting
    const exportData = users.map(u => {
      return {
        name: u.name,
        email: u.email,
        linkedinUrl: u.linkedinUrl || null,
        leetcodeUsername: u.leetcodeUsername || null,
        githubUsername: u.githubUsername || null,
        codechefUsername: u.codechefUsername || null,
        leetcodeEasyTotal: u.leetcodeEasyTotal || 0,
        leetcodeMediumTotal: u.leetcodeMediumTotal || 0,
        leetcodeHardTotal: u.leetcodeHardTotal || 0,
        codechefSolvedTotal: u.codechefSolvedTotal || 0,
        githubContributions: githubContributionsMap.get(u.id) || 0
      };
    });

    return NextResponse.json(exportData);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Admin export users failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Prevent dynamic routes from caching
