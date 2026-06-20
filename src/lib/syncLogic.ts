import { User } from '@/lib/models/User';
import { DailyActivity } from '@/lib/models/DailyActivity';
import * as leetcodeService from '@/lib/leetcodeService';
import * as githubService from '@/lib/githubService';
import { pointsConfig } from '@/lib/points';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface SyncDetail {
  userId: string;
  name: string;
  success: boolean;
  leetcodeSolved?: number;
  githubContributions?: number;
  pointsEarned?: number;
  error?: string;
}

interface SyncStats {
  processed: number;
  successful: number;
  failed: number;
  details: SyncDetail[];
}

/**
 * Runs the daily sync job for all linked users for a target date string (YYYY-MM-DD).
 */
export async function runSyncForDate(targetDateStr: string): Promise<SyncStats> {
  console.log(`[Sync] Beginning sync for date: ${targetDateStr}`);
  
  const linkedUsers = await User.findLinkedUsers();
  console.log(`[Sync] Found ${linkedUsers.length} users with linked accounts.`);

  const stats: SyncStats = {
    processed: 0,
    successful: 0,
    failed: 0,
    details: []
  };

  for (const user of linkedUsers) {
    stats.processed++;
    
    // 500ms sleep delay between users to avoid rate limiting
    if (stats.processed > 1) {
      await sleep(500);
    }

    try {
      console.log(`[Sync] Processing user ${user.name} (ID: ${user.id})...`);
      
      let leetcodeSolvedToday = 0;
      let leetcodePoints = 0;
      let githubContributionsToday = 0;
      let githubPoints = 0;

      // 1. LeetCode Sync
      if (user.leetcodeUsername) {
        try {
          const lcActivity = await leetcodeService.fetchActivityForDate(user.leetcodeUsername, targetDateStr);
          
          leetcodeSolvedToday = (lcActivity.Easy || 0) + (lcActivity.Medium || 0) + (lcActivity.Hard || 0);
          leetcodePoints = 
            (lcActivity.Easy || 0) * pointsConfig.leetcode.Easy +
            (lcActivity.Medium || 0) * pointsConfig.leetcode.Medium +
            (lcActivity.Hard || 0) * pointsConfig.leetcode.Hard;

          console.log(`[Sync] [LeetCode] User ${user.leetcodeUsername} solved: Easy=${lcActivity.Easy}, Medium=${lcActivity.Medium}, Hard=${lcActivity.Hard} (Points: ${leetcodePoints})`);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Sync] [LeetCode] Failed to sync for user ${user.leetcodeUsername}:`, errMsg);
        }
      }

      // 2. GitHub Sync
      if (user.githubUsername) {
        try {
          githubContributionsToday = await githubService.fetchActivityForDate(user.githubUsername, targetDateStr);
          
          if (githubContributionsToday > 0) {
            githubPoints = pointsConfig.github.activeBonus + (githubContributionsToday * pointsConfig.github.perContribution);
          } else {
            githubPoints = 0;
          }

          console.log(`[Sync] [GitHub] User ${user.githubUsername} made ${githubContributionsToday} contributions (Points: ${githubPoints})`);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Sync] [GitHub] Failed to sync for user ${user.githubUsername}:`, errMsg);
        }
      }

      const totalPointsEarned = leetcodePoints + githubPoints;

      // 3. Save/Upsert activity log
      await DailyActivity.upsert({
        userId: user.id,
        date: targetDateStr,
        leetcodeSolvedToday,
        githubContributionsToday,
        pointsEarned: totalPointsEarned
      });

      stats.successful++;
      stats.details.push({
        userId: user.id,
        name: user.name,
        success: true,
        leetcodeSolved: leetcodeSolvedToday,
        githubContributions: githubContributionsToday,
        pointsEarned: totalPointsEarned
      });

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      stats.failed++;
      stats.details.push({
        userId: user.id,
        name: user.name,
        success: false,
        error: errMsg
      });
      console.error(`[Sync] Failed to process user ${user.name}:`, errMsg);
    }
  }

  return stats;
}
