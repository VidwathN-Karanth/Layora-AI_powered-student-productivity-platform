const supabase = require('../config/supabase');
const User = require('./User');

function checkDb() {
  if (!supabase) {
    throw new Error('Database is unconfigured. Please check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  }
}

/**
 * Maps database snake_case daily activity row to camelCase JS object
 */
function mapActivityRow(row) {
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

class DailyActivity {
  /**
   * Upserts a daily activity row.
   * If a row for the given (userId, date) already exists, it is overwritten, ensuring idempotency.
   */
  static async upsert({ userId, date, leetcodeSolvedToday, githubContributionsToday, pointsEarned }) {
    checkDb();
    const { data, error } = await supabase
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

    return mapActivityRow(data);
  }

  /**
   * Fetches the leaderboard.
   * Returns a list of users, sorted descending by totalPoints earned within the specified date range.
   * Range can be:
   *  - 'today': current UTC date
   *  - 'week': past 7 days (UTC)
   *  - 'all': all time
   */
  static async getLeaderboard(range) {
    checkDb();
    // 1. Retrieve all users in the system to ensure a full list (including 0-point users)
    const users = await User.findAll();

    // 2. Fetch all daily activity records for the target range
    let query = supabase.from('daily_activities').select('*');

    const today = new Date();
    
    if (range === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      query = query.eq('date', todayStr);
    } else if (range === 'week') {
      const lastWeek = new Date();
      lastWeek.setUTCDate(today.getUTCDate() - 6); // Past 7 days (including today)
      const startDateStr = lastWeek.toISOString().split('T')[0];
      query = query.gte('date', startDateStr);
    }

    const { data: activities, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch daily activities for leaderboard: ${error.message}`);
    }

    // 3. Initialize the leaderboard map with all users at 0 points
    const leaderboardMap = {};
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

    // 4. Accumulate activity stats per user
    for (const act of activities) {
      const summary = leaderboardMap[act.user_id];
      if (summary) {
        summary.totalPoints += act.points_earned;
        summary.totalLeetcodeSolved += act.leetcode_solved_today;
        summary.totalGithubContributions += act.github_contributions_today;
      }
    }

    // 5. Convert map to array and sort descending by totalPoints
    const sortedLeaderboard = Object.values(leaderboardMap).sort((a, b) => {
      // Sort by totalPoints descending. If tied, sort by totalLeetcodeSolved, then github contributions
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

module.exports = DailyActivity;
