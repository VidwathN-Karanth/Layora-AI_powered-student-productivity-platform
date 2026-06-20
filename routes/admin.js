const express = require('express');
const router = express.Router();
const DailyActivity = require('../models/DailyActivity');
const { runSyncForDate } = require('../jobs/dailySync');

/**
 * POST /api/admin/sync-now
 * Manually triggers the activity sync job.
 * Body: { date } (optional, YYYY-MM-DD override date. Defaults to yesterday UTC).
 */
router.post('/admin/sync-now', async (req, res) => {
  const { date } = req.body;
  let targetDate = date;

  if (targetDate) {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Expected YYYY-MM-DD.' 
      });
    }
  } else {
    // Default to yesterday (UTC day that just ended)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  try {
    const stats = await runSyncForDate(targetDate);
    return res.json({
      success: true,
      message: `Manually triggered sync completed for date: ${targetDate}`,
      stats
    });
  } catch (error) {
    console.error(`Manual sync failed for date ${targetDate}:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/leaderboard
 * Fetches the points leaderboard.
 * Query params: ?range=today|week|all (defaults to all)
 */
router.get('/admin/leaderboard', async (req, res) => {
  const { range = 'all' } = req.query;

  // Validate range parameter
  const validRanges = ['today', 'week', 'all'];
  if (!validRanges.includes(range)) {
    return res.status(400).json({ 
      error: `Invalid range parameter "${range}". Valid options are: today, week, all.` 
    });
  }

  try {
    const leaderboard = await DailyActivity.getLeaderboard(range);
    return res.json(leaderboard);
  } catch (error) {
    console.error(`Failed to fetch leaderboard for range "${range}":`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
