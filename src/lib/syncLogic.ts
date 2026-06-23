import { User } from '@/lib/models/User';
import { DailyActivity } from '@/lib/models/DailyActivity';
import * as leetcodeService from '@/lib/leetcodeService';
import * as githubService from '@/lib/githubService';
import { pointsConfig } from '@/lib/points';
import { supabaseAdmin } from './supabaseAdmin';

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

      let newEasyTotal = user.leetcodeEasyTotal || 0;
      let newMediumTotal = user.leetcodeMediumTotal || 0;
      let newHardTotal = user.leetcodeHardTotal || 0;

      // 1. LeetCode Sync (Cumulative Solves)
      if (user.leetcodeUsername) {
        try {
          const totals = await leetcodeService.fetchTotalSolves(user.leetcodeUsername);
          newEasyTotal = totals.Easy;
          newMediumTotal = totals.Medium;
          newHardTotal = totals.Hard;

          // Retrieve the closest baseline snapshot before targetDateStr
          const { data: baselineRows } = await supabaseAdmin
            .from('daily_activities')
            .select('leetcode_easy_accumulated, leetcode_medium_accumulated, leetcode_hard_accumulated')
            .eq('user_id', user.id)
            .lt('date', targetDateStr)
            .order('date', { ascending: false })
            .limit(1);

          const baseline = baselineRows && baselineRows.length > 0 
            ? {
                Easy: baselineRows[0].leetcode_easy_accumulated || 0,
                Medium: baselineRows[0].leetcode_medium_accumulated || 0,
                Hard: baselineRows[0].leetcode_hard_accumulated || 0
              }
            : { Easy: 0, Medium: 0, Hard: 0 };

          const easyDiff = Math.max(0, newEasyTotal - baseline.Easy);
          const mediumDiff = Math.max(0, newMediumTotal - baseline.Medium);
          const hardDiff = Math.max(0, newHardTotal - baseline.Hard);

          leetcodeSolvedToday = easyDiff + mediumDiff + hardDiff;
          leetcodePoints = 
            easyDiff * pointsConfig.leetcode.Easy +
            mediumDiff * pointsConfig.leetcode.Medium +
            hardDiff * pointsConfig.leetcode.Hard;

          console.log(`[Sync] [LeetCode] User ${user.leetcodeUsername} solved diff: Easy=${easyDiff}, Medium=${mediumDiff}, Hard=${hardDiff} (Points: ${leetcodePoints})`);
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

          // Also sync yesterday's contributions to catch any late night pushes made after 10 PM yesterday
          try {
            const yesterday = new Date(targetDateStr);
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const githubContributionsYesterday = await githubService.fetchActivityForDate(user.githubUsername, yesterdayStr);
            
            const githubPointsYesterday = githubContributionsYesterday > 0
              ? pointsConfig.github.activeBonus + (githubContributionsYesterday * pointsConfig.github.perContribution)
              : 0;

            // Check if yesterday's row exists
            const { data: yesterdayRows } = await supabaseAdmin
              .from('daily_activities')
              .select('*')
              .eq('user_id', user.id)
              .eq('date', yesterdayStr);

            const yesterdayRow = yesterdayRows && yesterdayRows.length > 0 ? yesterdayRows[0] : null;

            if (yesterdayRow) {
              // Row exists, recalculate points
              // Get baseline before yesterday
              const { data: baselineRows } = await supabaseAdmin
                .from('daily_activities')
                .select('leetcode_easy_accumulated, leetcode_medium_accumulated, leetcode_hard_accumulated')
                .eq('user_id', user.id)
                .lt('date', yesterdayStr)
                .order('date', { ascending: false })
                .limit(1);

              const baseline = baselineRows && baselineRows.length > 0 
                ? {
                    Easy: baselineRows[0].leetcode_easy_accumulated || 0,
                    Medium: baselineRows[0].leetcode_medium_accumulated || 0,
                    Hard: baselineRows[0].leetcode_hard_accumulated || 0
                  }
                : { Easy: 0, Medium: 0, Hard: 0 };

              const easyDiff = Math.max(0, (yesterdayRow.leetcode_easy_accumulated || 0) - baseline.Easy);
              const mediumDiff = Math.max(0, (yesterdayRow.leetcode_medium_accumulated || 0) - baseline.Medium);
              const hardDiff = Math.max(0, (yesterdayRow.leetcode_hard_accumulated || 0) - baseline.Hard);

              const leetcodePoints = 
                easyDiff * pointsConfig.leetcode.Easy +
                mediumDiff * pointsConfig.leetcode.Medium +
                hardDiff * pointsConfig.leetcode.Hard;

              const totalPointsYesterday = leetcodePoints + githubPointsYesterday;

              await supabaseAdmin
                .from('daily_activities')
                .update({ 
                  github_contributions_today: githubContributionsYesterday,
                  points_earned: totalPointsYesterday
                })
                .eq('user_id', user.id)
                .eq('date', yesterdayStr);
              
              console.log(`[Sync] [GitHub] Updated yesterday's (${yesterdayStr}) contributions for ${user.githubUsername} to ${githubContributionsYesterday} (Points: ${totalPointsYesterday})`);
            } else {
              // Row does not exist, create it with baseline stats
              const { data: baselineRows } = await supabaseAdmin
                .from('daily_activities')
                .select('leetcode_easy_accumulated, leetcode_medium_accumulated, leetcode_hard_accumulated')
                .eq('user_id', user.id)
                .lt('date', yesterdayStr)
                .order('date', { ascending: false })
                .limit(1);

              const baseline = baselineRows && baselineRows.length > 0 
                ? {
                    Easy: baselineRows[0].leetcode_easy_accumulated || 0,
                    Medium: baselineRows[0].leetcode_medium_accumulated || 0,
                    Hard: baselineRows[0].leetcode_hard_accumulated || 0
                  }
                : { 
                    Easy: user.leetcodeEasyTotal || 0, 
                    Medium: user.leetcodeMediumTotal || 0, 
                    Hard: user.leetcodeHardTotal || 0 
                  };

              await DailyActivity.upsert({
                userId: user.id,
                date: yesterdayStr,
                leetcodeSolvedToday: 0,
                githubContributionsToday: githubContributionsYesterday,
                pointsEarned: githubPointsYesterday,
                leetcodeEasyAccumulated: baseline.Easy,
                leetcodeMediumAccumulated: baseline.Medium,
                leetcodeHardAccumulated: baseline.Hard
              });
              console.log(`[Sync] [GitHub] Created missing daily_activity row for yesterday (${yesterdayStr}) for ${user.githubUsername} with ${githubContributionsYesterday} contributions (Points: ${githubPointsYesterday})`);
            }
          } catch (yesterdayErr) {
            console.error(`[Sync] [GitHub] Failed to update/create yesterday's contributions for ${user.githubUsername}:`, yesterdayErr);
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Sync] [GitHub] Failed to sync for user ${user.githubUsername}:`, errMsg);
        }
      }

      const totalPointsEarned = leetcodePoints + githubPoints;

      // Update user model totals in the database
      if (user.leetcodeUsername) {
        await User.update(user.id, {
          leetcodeEasyTotal: newEasyTotal,
          leetcodeMediumTotal: newMediumTotal,
          leetcodeHardTotal: newHardTotal
        });
      }

      // 3. Save/Upsert activity log with snapshots
      await DailyActivity.upsert({
        userId: user.id,
        date: targetDateStr,
        leetcodeSolvedToday,
        githubContributionsToday,
        pointsEarned: totalPointsEarned,
        leetcodeEasyAccumulated: newEasyTotal,
        leetcodeMediumAccumulated: newMediumTotal,
        leetcodeHardAccumulated: newHardTotal
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
