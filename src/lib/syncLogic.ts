import { User, UserRow } from '@/lib/models/User';
import { DailyActivity } from '@/lib/models/DailyActivity';
import * as leetcodeService from '@/lib/leetcodeService';
import * as githubService from '@/lib/githubService';
import * as codechefService from '@/lib/codechefService';
import { pointsConfig } from '@/lib/points';
import { supabaseAdmin } from './supabaseAdmin';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SyncDetail {
  userId: string;
  name: string;
  success: boolean;
  leetcodeSolved?: number;
  githubContributions?: number;
  codechefSolved?: number;
  pointsEarned?: number;
  error?: string;
}

interface SyncStats {
  processed: number;
  successful: number;
  failed: number;
  details: SyncDetail[];
}

/* ── batching ──────────────────────────────────────────────────────
   Why this exists: the nightly job used to walk every linked student one
   at a time with a 500ms pause between each, plus three external API calls
   apiece. At the department's ~8 students that finishes in seconds. At 800
   it is fifteen minutes or more in a single request, and a serverless
   function is killed long before that — so some students would be synced,
   the rest silently skipped, and nobody would be told.

   So the work is now sliced: each call handles a page of students within a
   time budget and reports where to resume.
   ────────────────────────────────────────────────────────────────── */

/** Students started together. Deliberately small. */
const CONCURRENCY = 3;

/**
 * Pause between groups, not between students.
 *
 * The original 500ms gap existed to stay friendly to LeetCode, GitHub and
 * CodeChef. Three students in flight at once with the same gap is roughly
 * three times the throughput at three times the instantaneous rate — the
 * conservative end of what those services tolerate. If any of them starts
 * refusing requests, lower CONCURRENCY before raising this.
 */
const GROUP_GAP_MS = 600;

/** Students per call. Small enough that one page always fits in a budget. */
export const DEFAULT_SLICE_SIZE = 60;

/**
 * Time to keep starting new groups.
 *
 * Well under a serverless limit, because the budget is checked *between*
 * groups: whatever is already in flight still has to finish after the last
 * check, and three students' worth of external calls is the overshoot.
 */
export const DEFAULT_SLICE_BUDGET_MS = 40_000;

export interface SliceOptions {
  offset?: number;
  limit?: number;
  budgetMs?: number;
}

export interface SliceResult extends SyncStats {
  /** Where the next call resumes, or null once every student is done. */
  nextOffset: number | null;
}

/**
 * Syncs one page of linked students, then says where to pick up.
 *
 * Safe to re-run over a range already covered: the write behind syncUser is
 * an upsert keyed on (user_id, date), so an overlapping slice corrects a row
 * rather than adding points twice.
 */
export async function runSyncSlice(
  targetDateStr: string,
  opts: SliceOptions = {}
): Promise<SliceResult> {
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(1, opts.limit ?? DEFAULT_SLICE_SIZE);
  const budgetMs = opts.budgetMs ?? DEFAULT_SLICE_BUDGET_MS;
  const startedAt = Date.now();

  const users = await User.findLinkedUsers({ offset, limit });
  console.log(`[Sync] Slice at offset ${offset}: ${users.length} student(s) for ${targetDateStr}`);

  const stats: SyncStats = { processed: 0, successful: 0, failed: 0, details: [] };
  let consumed = 0;

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    // The budget is never checked before the first group, so every call makes
    // progress. Without that guarantee a tight budget would return the same
    // offset forever and the driver would loop until it gave up.
    if (i > 0) {
      if (Date.now() - startedAt >= budgetMs) {
        console.log(`[Sync] Budget spent after ${consumed} student(s); resuming at ${offset + consumed}`);
        break;
      }
      await sleep(GROUP_GAP_MS);
    }

    const group = users.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      // syncUser resolves its own failures, but a throw here would lose the
      // whole group's results, so it is belt-and-braces.
      group.map((user) =>
        syncUser(user, targetDateStr).catch((error: unknown) => ({
          userId: user.id,
          name: user.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as SyncDetail))
      )
    );

    for (const detail of results) {
      stats.processed++;
      if (detail.success) stats.successful++;
      else stats.failed++;
      stats.details.push(detail);
    }
    consumed += group.length;
  }

  // More work remains if the budget cut this slice short, or if the page came
  // back full — a full page means the next one may hold more.
  const more = consumed < users.length || users.length === limit;

  return { ...stats, nextOffset: more ? offset + consumed : null };
}

/**
 * Syncs activity statistics (LeetCode, GitHub) for a single user for a target date.
 */
export async function syncUser(user: UserRow, targetDateStr: string): Promise<SyncDetail> {
  try {
    console.log(`[Sync] Processing user ${user.name} (ID: ${user.id})...`);
    
    let leetcodeSolvedToday = 0;
    let leetcodePoints = 0;
    let githubContributionsToday = 0;
    let githubPoints = 0;
    let codechefSolvedToday = 0;
    let codechefPoints = 0;

    let newEasyTotal = user.leetcodeEasyTotal || 0;
    let newMediumTotal = user.leetcodeMediumTotal || 0;
    let newHardTotal = user.leetcodeHardTotal || 0;
    let newCodechefTotal = user.codechefSolvedTotal || 0;

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

    // 1.5. CodeChef Sync (Cumulative Solves)
    if (user.codechefUsername) {
      try {
        const total = await codechefService.fetchTotalSolves(user.codechefUsername);
        newCodechefTotal = total;

        // Retrieve the closest baseline snapshot before targetDateStr
        const { data: baselineRows } = await supabaseAdmin
          .from('daily_activities')
          .select('codechef_solved_accumulated')
          .eq('user_id', user.id)
          .lt('date', targetDateStr)
          .order('date', { ascending: false })
          .limit(1);

        const baselineCodechef = baselineRows && baselineRows.length > 0 
          ? (baselineRows[0].codechef_solved_accumulated || 0)
          : 0;

        codechefSolvedToday = Math.max(0, newCodechefTotal - baselineCodechef);
        codechefPoints = codechefSolvedToday * pointsConfig.codechef.perSolve;

        console.log(`[Sync] [CodeChef] User ${user.codechefUsername} solved diff: ${codechefSolvedToday} (Points: ${codechefPoints})`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Sync] [CodeChef] Failed to sync for user ${user.codechefUsername}:`, errMsg);
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
              .select('leetcode_easy_accumulated, leetcode_medium_accumulated, leetcode_hard_accumulated, codechef_solved_accumulated')
              .eq('user_id', user.id)
              .lt('date', yesterdayStr)
              .order('date', { ascending: false })
              .limit(1);

            const baseline = baselineRows && baselineRows.length > 0 
              ? {
                  Easy: baselineRows[0].leetcode_easy_accumulated || 0,
                  Medium: baselineRows[0].leetcode_medium_accumulated || 0,
                  Hard: baselineRows[0].leetcode_hard_accumulated || 0,
                  Codechef: baselineRows[0].codechef_solved_accumulated || 0
                }
              : { Easy: 0, Medium: 0, Hard: 0, Codechef: 0 };

            const easyDiff = Math.max(0, (yesterdayRow.leetcode_easy_accumulated || 0) - baseline.Easy);
            const mediumDiff = Math.max(0, (yesterdayRow.leetcode_medium_accumulated || 0) - baseline.Medium);
            const hardDiff = Math.max(0, (yesterdayRow.leetcode_hard_accumulated || 0) - baseline.Hard);
            const codechefDiff = Math.max(0, (yesterdayRow.codechef_solved_accumulated || 0) - baseline.Codechef);

            const leetcodePoints = 
              easyDiff * pointsConfig.leetcode.Easy +
              mediumDiff * pointsConfig.leetcode.Medium +
              hardDiff * pointsConfig.leetcode.Hard;

            const codechefPointsYesterday = codechefDiff * pointsConfig.codechef.perSolve;

            const totalPointsYesterday = leetcodePoints + githubPointsYesterday + codechefPointsYesterday;

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
              .select('leetcode_easy_accumulated, leetcode_medium_accumulated, leetcode_hard_accumulated, codechef_solved_accumulated')
              .eq('user_id', user.id)
              .lt('date', yesterdayStr)
              .order('date', { ascending: false })
              .limit(1);

            const baseline = baselineRows && baselineRows.length > 0 
              ? {
                  Easy: baselineRows[0].leetcode_easy_accumulated || 0,
                  Medium: baselineRows[0].leetcode_medium_accumulated || 0,
                  Hard: baselineRows[0].leetcode_hard_accumulated || 0,
                  Codechef: baselineRows[0].codechef_solved_accumulated || 0
                }
              : { 
                  Easy: user.leetcodeEasyTotal || 0, 
                  Medium: user.leetcodeMediumTotal || 0, 
                  Hard: user.leetcodeHardTotal || 0,
                  Codechef: user.codechefSolvedTotal || 0
                };

            await DailyActivity.upsert({
              userId: user.id,
              date: yesterdayStr,
              leetcodeSolvedToday: 0,
              githubContributionsToday: githubContributionsYesterday,
              codechefSolvedToday: 0,
              pointsEarned: githubPointsYesterday,
              leetcodeEasyAccumulated: baseline.Easy,
              leetcodeMediumAccumulated: baseline.Medium,
              leetcodeHardAccumulated: baseline.Hard,
              codechefSolvedAccumulated: baseline.Codechef
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

    const totalPointsEarned = leetcodePoints + githubPoints + codechefPoints;

    // Update user model totals in the database
    if (user.leetcodeUsername || user.codechefUsername) {
      await User.update(user.id, {
        leetcodeEasyTotal: newEasyTotal,
        leetcodeMediumTotal: newMediumTotal,
        leetcodeHardTotal: newHardTotal,
        codechefSolvedTotal: newCodechefTotal
      });
    }

    // 3. Save/Upsert activity log with snapshots
    await DailyActivity.upsert({
      userId: user.id,
      date: targetDateStr,
      leetcodeSolvedToday,
      githubContributionsToday,
      codechefSolvedToday,
      pointsEarned: totalPointsEarned,
      leetcodeEasyAccumulated: newEasyTotal,
      leetcodeMediumAccumulated: newMediumTotal,
      leetcodeHardAccumulated: newHardTotal,
      codechefSolvedAccumulated: newCodechefTotal
    });

    return {
      userId: user.id,
      name: user.name,
      success: true,
      leetcodeSolved: leetcodeSolvedToday,
      githubContributions: githubContributionsToday,
      codechefSolved: codechefSolvedToday,
      pointsEarned: totalPointsEarned
    };

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Sync] Failed to process user ${user.name}:`, errMsg);
    return {
      userId: user.id,
      name: user.name,
      success: false,
      error: errMsg
    };
  }
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

    const detail = await syncUser(user, targetDateStr);
    if (detail.success) {
      stats.successful++;
    } else {
      stats.failed++;
    }
    stats.details.push(detail);
  }

  return stats;
}
