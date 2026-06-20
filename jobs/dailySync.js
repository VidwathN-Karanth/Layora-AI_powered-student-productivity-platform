const cron = require('node-cron');
const User = require('../models/User');
const DailyActivity = require('../models/DailyActivity');
const leetcodeService = require('../services/leetcodeService');
const githubService = require('../services/githubService');
const pointsConfig = require('../config/points');

// Helper to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs the sync job for all linked users for a specific target date (YYYY-MM-DD).
 * Loops through each user with a delay, catches errors per user, and returns execution summary stats.
 */
async function runSyncForDate(targetDateStr) {
  console.log(`[Sync] Beginning sync for date: ${targetDateStr}`);
  
  // Fetch all users who have linked at least one platform
  const linkedUsers = await User.findLinkedUsers();
  console.log(`[Sync] Found ${linkedUsers.length} users with linked accounts.`);

  const stats = {
    processed: 0,
    successful: 0,
    failed: 0,
    details: []
  };

  for (const user of linkedUsers) {
    stats.processed++;
    
    // Add a 500ms delay between users to avoid rate-limiting external APIs
    if (stats.processed > 1) {
      await sleep(500);
    }

    try {
      console.log(`[Sync] Processing user ${user.name} (ID: ${user.id})...`);
      
      let leetcodeSolvedToday = 0;
      let leetcodePoints = 0;
      let githubContributionsToday = 0;
      let githubPoints = 0;

      // 1. Fetch LeetCode Activity
      if (user.leetcodeUsername) {
        try {
          const lcActivity = await leetcodeService.fetchActivityForDate(user.leetcodeUsername, targetDateStr);
          
          leetcodeSolvedToday = (lcActivity.Easy || 0) + (lcActivity.Medium || 0) + (lcActivity.Hard || 0);
          
          // Calculate points based on difficulty config
          leetcodePoints = 
            (lcActivity.Easy || 0) * pointsConfig.leetcode.Easy +
            (lcActivity.Medium || 0) * pointsConfig.leetcode.Medium +
            (lcActivity.Hard || 0) * pointsConfig.leetcode.Hard;

          console.log(`[Sync] [LeetCode] User ${user.leetcodeUsername} solved: Easy=${lcActivity.Easy}, Medium=${lcActivity.Medium}, Hard=${lcActivity.Hard} (Points: ${leetcodePoints})`);
        } catch (err) {
          console.error(`[Sync] [LeetCode] Failed to sync for user ${user.leetcodeUsername}:`, err.message);
          // Don't throw: continue, but we can treat LeetCode as 0 solved or partially record github if available
        }
      }

      // 2. Fetch GitHub Activity
      if (user.githubUsername) {
        try {
          githubContributionsToday = await githubService.fetchActivityForDate(user.githubUsername, targetDateStr);
          
          // Calculate points: flat bonus + perContribution
          if (githubContributionsToday > 0) {
            githubPoints = pointsConfig.github.activeBonus + (githubContributionsToday * pointsConfig.github.perContribution);
          } else {
            githubPoints = 0;
          }

          console.log(`[Sync] [GitHub] User ${user.githubUsername} made ${githubContributionsToday} contributions (Points: ${githubPoints})`);
        } catch (err) {
          console.error(`[Sync] [GitHub] Failed to sync for user ${user.githubUsername}:`, err.message);
        }
      }

      const totalPointsEarned = leetcodePoints + githubPoints;

      // 3. Upsert Daily Activity Record
      const activityRecord = await DailyActivity.upsert({
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
      
      console.log(`[Sync] User ${user.name} sync complete. Record ID: ${activityRecord.id}. Points: ${totalPointsEarned}`);

    } catch (error) {
      stats.failed++;
      stats.details.push({
        userId: user.id,
        name: user.name,
        success: false,
        error: error.message
      });
      console.error(`[Sync] Failed to process user ${user.name}:`, error.message);
    }
  }

  console.log(`[Sync] Sync finished for date ${targetDateStr}. Processed: ${stats.processed}, Successful: ${stats.successful}, Failed: ${stats.failed}`);
  return stats;
}

// 4. Register the node-cron Job
// Cron pattern: '5 0 * * *' (5 minutes past midnight daily)
cron.schedule('5 0 * * *', async () => {
  console.log('[Cron] Initiating daily UTC activity sync job...');
  try {
    // Yesterday in UTC
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log(`[Cron] Syncing data for target date (yesterday): ${yesterdayStr}`);
    await runSyncForDate(yesterdayStr);
    console.log('[Cron] Daily UTC activity sync job completed.');
  } catch (error) {
    console.error('[Cron] Daily UTC activity sync job encountered a critical error:', error);
  }
}, {
  scheduled: true,
  timezone: 'Etc/UTC' // Ensure cron triggers at midnight UTC
});

module.exports = {
  runSyncForDate
};
