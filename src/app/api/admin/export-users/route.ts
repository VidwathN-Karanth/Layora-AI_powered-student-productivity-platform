import { NextResponse } from 'next/server';
import { User } from '@/lib/models/User';
import { DailyActivity } from '@/lib/models/DailyActivity';
import { requireAdminCohort } from '@/lib/authz';
import { emailsForCohort } from '@/lib/roster';

/** CSV export for one academic year, matching whichever year the console shows. */
export async function GET(request: Request) {
  try {
    const guard = await requireAdminCohort(request.url);
    if (!guard.ok) return guard.response;

    const { cohort } = guard.requester;
    const rosterEmails = emailsForCohort(cohort);
    const allowed = new Set(rosterEmails);

    const allUsers = await User.findAll();
    const users = allUsers.filter((u) => allowed.has((u.email || '').trim().toLowerCase()));

    // Points and contribution totals, scoped to the same year
    const leaderboard = await DailyActivity.getLeaderboard('all', { restrictToEmails: rosterEmails });

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
