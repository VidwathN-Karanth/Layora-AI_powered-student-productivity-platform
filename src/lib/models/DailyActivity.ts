import { supabaseAdmin } from '../supabaseAdmin';
import { User } from './User';

export interface DailyActivityRow {
  id: number;
  userId: string;
  date: string;
  leetcodeSolvedToday: number;
  githubContributionsToday: number;
  pointsEarned: number;
  createdAt: string;
}

export interface LeaderboardUser {
  userId: string;
  name: string;
  leetcodeUsername: string | null;
  githubUsername: string | null;
  totalPoints: number;
  totalLeetcodeSolved: number;
  totalGithubContributions: number;
}

interface DatabaseDailyActivityRow {
  id: number;
  user_id: string;
  date: string;
  leetcode_solved_today: number;
  github_contributions_today: number;
  points_earned: number;
  created_at: string;
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
    pointsEarned: row.points_earned,
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
    pointsEarned
  }: {
    userId: string;
    date: string;
    leetcodeSolvedToday: number;
    githubContributionsToday: number;
    pointsEarned: number;
  }): Promise<DailyActivityRow | null> {
    const { data, error } = await supabaseAdmin
      .from('daily_activities')
      .upsert({
        user_id: userId,
        date,
        leetcode_solved_today: leetcodeSolvedToday,
        github_contributions_today: githubContributionsToday,
        points_earned: pointsEarned
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
   */
  static async getLeaderboard(range: 'today' | 'week' | 'all'): Promise<LeaderboardUser[]> {
    // 1. Fetch all users so we include 0-point users on the scoreboard
    const users = await User.findAll();

    // 2. Fetch daily activities for the chosen range
    let query = supabaseAdmin.from('daily_activities').select('*');

    const today = new Date();
    
    if (range === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      query = query.eq('date', todayStr);
    } else if (range === 'week') {
      const lastWeek = new Date();
      lastWeek.setUTCDate(today.getUTCDate() - 6); // 7 days rolling (including today)
      const startDateStr = lastWeek.toISOString().split('T')[0];
      query = query.gte('date', startDateStr);
    }

    const { data: activities, error } = await query;
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
        totalPoints: 0,
        totalLeetcodeSolved: 0,
        totalGithubContributions: 0
      };
    }

    const activityRows = (activities || []) as unknown as DatabaseDailyActivityRow[];

    // 4. Sum up points
    for (const act of activityRows) {
      const summary = leaderboardMap[act.user_id];
      if (summary) {
        summary.totalPoints += act.points_earned;
        summary.totalLeetcodeSolved += act.leetcode_solved_today;
        summary.totalGithubContributions += act.github_contributions_today;
      }
    }

    // 5. Convert to array and sort descending by totalPoints
    const sortedLeaderboard = Object.values(leaderboardMap).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      if (b.totalLeetcodeSolved !== a.totalLeetcodeSolved) {
        return b.totalLeetcodeSolved - a.totalLeetcodeSolved;
      }
      return b.totalGithubContributions - a.totalGithubContributions;
    });

    return sortedLeaderboard;
  }
}
