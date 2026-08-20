import { supabaseAdmin } from '../supabaseAdmin';
import { User } from './User';
import { pointsConfig } from '../points';

export interface DailyActivityRow {
  id: number;
  userId: string;
  date: string;
  leetcodeSolvedToday: number;
  githubContributionsToday: number;
  codechefSolvedToday: number;
  pointsEarned: number;
  leetcodeEasyAccumulated: number;
  leetcodeMediumAccumulated: number;
  leetcodeHardAccumulated: number;
  codechefSolvedAccumulated: number;
  createdAt: string;
}

export interface LeaderboardUser {
  userId: string;
  name: string;
  leetcodeUsername: string | null;
  githubUsername: string | null;
  codechefUsername: string | null;
  linkedinUrl: string | null;
  totalPoints: number;
  totalLeetcodeSolved: number;
  totalGithubContributions: number;
  totalCodechefSolved: number;
}

interface DatabaseDailyActivityRow {
  id: number;
  user_id: string;
  date: string;
  leetcode_solved_today: number;
  github_contributions_today: number;
  codechef_solved_today: number;
  points_earned: number;
  leetcode_easy_accumulated: number;
  leetcode_medium_accumulated: number;
  leetcode_hard_accumulated: number;
  codechef_solved_accumulated: number;
  created_at: string;
}

/**
 * One already-summed row per student, as returned by the
 * `leaderboard_activity_totals` Postgres function.
 */
interface ActivityTotalsRow {
  user_id: string;
  points: number;
  leetcode_solved: number;
  github_contributions: number;
  codechef_solved: number;
}

/**
 * Maps database snake_case row to camelCase JS object.
 */
function mapActivityRow(row: DatabaseDailyActivityRow | null | undefined): DailyActivityRow | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    leetcodeSolvedToday: row.leetcode_solved_today,
    githubContributionsToday: row.github_contributions_today,
    codechefSolvedToday: row.codechef_solved_today || 0,
    pointsEarned: row.points_earned,
    leetcodeEasyAccumulated: row.leetcode_easy_accumulated || 0,
    leetcodeMediumAccumulated: row.leetcode_medium_accumulated || 0,
    leetcodeHardAccumulated: row.leetcode_hard_accumulated || 0,
    codechefSolvedAccumulated: row.codechef_solved_accumulated || 0,
    createdAt: row.created_at
  };
}

export class DailyActivity {
  /**
   * Idempotently logs a day's activity metrics and points ledger row.
   */
  static async upsert({
    userId,
    date,
    leetcodeSolvedToday,
    githubContributionsToday,
    codechefSolvedToday = 0,
    pointsEarned,
    leetcodeEasyAccumulated = 0,
    leetcodeMediumAccumulated = 0,
    leetcodeHardAccumulated = 0,
    codechefSolvedAccumulated = 0
  }: {
    userId: string;
    date: string;
    leetcodeSolvedToday: number;
    githubContributionsToday: number;
    codechefSolvedToday?: number;
    pointsEarned: number;
    leetcodeEasyAccumulated?: number;
    leetcodeMediumAccumulated?: number;
    leetcodeHardAccumulated?: number;
    codechefSolvedAccumulated?: number;
  }): Promise<DailyActivityRow | null> {
    const { data, error } = await supabaseAdmin
      .from('daily_activities')
      .upsert({
        user_id: userId,
        date,
        leetcode_solved_today: leetcodeSolvedToday,
        github_contributions_today: githubContributionsToday,
        codechef_solved_today: codechefSolvedToday,
        points_earned: pointsEarned,
        leetcode_easy_accumulated: leetcodeEasyAccumulated,
        leetcode_medium_accumulated: leetcodeMediumAccumulated,
        leetcode_hard_accumulated: leetcodeHardAccumulated,
        codechef_solved_accumulated: codechefSolvedAccumulated
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert daily activity: ${error.message}`);
    }

    return mapActivityRow(data as DatabaseDailyActivityRow);
  }

  /**
   * Computes rank list for a range (today, week, all).
   *
   * `restrictToEmails` scopes the board to one academic year. Students only
   * ever compete within their own year, so callers pass that year's roster
   * addresses; omitting it ranks everybody, which is what the CSV export and
   * cron jobs want.
   */
  static async getLeaderboard(
    range: 'today' | 'week' | 'all',
    opts: { restrictToEmails?: string[] } = {}
  ): Promise<LeaderboardUser[]> {
    // 1. Fetch all users and filter out those who haven't entered LeetCode, GitHub, or CodeChef usernames
    const allUsers = await User.findAll();

    // Scope to a cohort before any points are summed, so no other year's
    // numbers can reach the caller even by accident.
    const allowedEmails = opts.restrictToEmails
      ? new Set(opts.restrictToEmails.map((e) => e.trim().toLowerCase()))
      : null;

    const users = allUsers.filter(u => {
      if (allowedEmails && !allowedEmails.has((u.email || '').trim().toLowerCase())) {
        return false;
      }
      const hasLeetcode = u.leetcodeUsername && u.leetcodeUsername.trim() !== '';
      const hasGithub = u.githubUsername && u.githubUsername.trim() !== '';
      const hasCodechef = u.codechefUsername && u.codechefUsername.trim() !== '';
      return !!(hasLeetcode || hasGithub || hasCodechef);
    });

    // 2. Aggregate the points ledger in Postgres, not in Node.
    //
    // This used to `select('*')` the whole daily_activities table and sum it
    // here. That is one row per student per day forever — at 800 students it
    // reaches tens of megabytes on every single request. The RPC does the
    // GROUP BY server-side and hands back one row per student instead.
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let startDate: string | null = null;
    let endDate: string | null = null;

    if (range === 'today') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (range === 'week') {
      const lastWeek = new Date();
      lastWeek.setUTCDate(today.getUTCDate() - 6); // 7 days rolling (including today)
      startDate = lastWeek.toISOString().split('T')[0];
    }

    const { data: totals, error } = await supabaseAdmin.rpc('leaderboard_activity_totals', {
      p_user_ids: users.map((u) => u.id),
      p_start_date: startDate,
      p_end_date: endDate
    });

    if (error) {
      throw new Error(`Failed to fetch daily activities for leaderboard: ${error.message}`);
    }

    // 3. Initialize scoreboard map
    const leaderboardMap: { [key: string]: LeaderboardUser } = {};
    for (const user of users) {
      leaderboardMap[user.id] = {
        userId: user.id,
        name: user.name,
        leetcodeUsername: user.leetcodeUsername,
        githubUsername: user.githubUsername,
        codechefUsername: user.codechefUsername,
        linkedinUrl: user.linkedinUrl,
        totalPoints: 0,
        totalLeetcodeSolved: 0,
        totalGithubContributions: 0,
        totalCodechefSolved: 0
      };
    }

    // 4. Fold the per-student totals in
    for (const row of (totals || []) as ActivityTotalsRow[]) {
      const summary = leaderboardMap[row.user_id];
      if (!summary) continue;

      if (range === 'all') {
        // All-time points come from the User profile totals in step 4.5; the
        // ledger only contributes the GitHub contribution count.
        summary.totalGithubContributions += Number(row.github_contributions);
      } else {
        // For today/week, the daily ledger is the whole story.
        summary.totalPoints += Number(row.points);
        summary.totalLeetcodeSolved += Number(row.leetcode_solved);
        summary.totalGithubContributions += Number(row.github_contributions);
        summary.totalCodechefSolved += Number(row.codechef_solved);
      }
    }

    // 4.5 For all-time, add the cumulative LeetCode and CodeChef solved counts from the User profile
    if (range === 'all') {
      for (const user of users) {
        const summary = leaderboardMap[user.id];
        if (summary) {
          const lcSolved = user.leetcodeEasyTotal + user.leetcodeMediumTotal + user.leetcodeHardTotal;
          const lcPoints = user.leetcodeEasyTotal * pointsConfig.leetcode.Easy +
                           user.leetcodeMediumTotal * pointsConfig.leetcode.Medium +
                           user.leetcodeHardTotal * pointsConfig.leetcode.Hard;
          
          const ccSolved = user.codechefSolvedTotal || 0;
          const ccPoints = ccSolved * (pointsConfig.codechef?.perSolve || 15);

          summary.totalLeetcodeSolved = lcSolved;
          summary.totalCodechefSolved = ccSolved;
          summary.totalPoints += lcPoints + ccPoints;
        }
      }
    }

    // 5. Convert to array and sort descending by totalPoints
    const sortedLeaderboard = Object.values(leaderboardMap).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      const totalSolvedB = b.totalLeetcodeSolved + b.totalCodechefSolved;
      const totalSolvedA = a.totalLeetcodeSolved + a.totalCodechefSolved;
      if (totalSolvedB !== totalSolvedA) {
        return totalSolvedB - totalSolvedA;
      }
      return b.totalGithubContributions - a.totalGithubContributions;
    });

    return sortedLeaderboard;
  }

  /**
   * Fetches all daily activities for a specific user.
   */
  static async findByUserId(userId: string): Promise<DailyActivityRow[]> {
    const { data, error } = await supabaseAdmin
      .from('daily_activities')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`Failed to retrieve activities for user: ${error.message}`);
    }

    return (data || []).map((row) => mapActivityRow(row as DatabaseDailyActivityRow)).filter((a): a is DailyActivityRow => a !== null);
  }
}
