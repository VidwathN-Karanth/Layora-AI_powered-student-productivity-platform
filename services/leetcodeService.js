const axios = require('axios');

// In-memory cache for problem difficulty (titleSlug -> difficulty)
const difficultyCache = {};

/**
 * Helper to execute a GraphQL query against LeetCode.
 * Wraps calls in try/catch and handles exceptions gracefully per user.
 */
async function queryLeetCode(query, variables = {}) {
  try {
    const response = await axios.post(
      'https://leetcode.com/graphql',
      {
        query,
        variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://leetcode.com'
        },
        timeout: 10000 // 10s timeout
      }
    );
    return response.data;
  } catch (error) {
    console.error('LeetCode API call failed:', error.message);
    throw new Error(`LeetCode service communication error: ${error.message}`);
  }
}

/**
 * Validates whether a LeetCode username exists and is public.
 * Throws a descriptive error if not found.
 */
async function validateUsername(username) {
  if (!username) throw new Error('LeetCode username is required');

  const query = `
    query matchedUser($username: String!) {
      matchedUser(username: $username) {
        username
      }
    }
  `;

  const result = await queryLeetCode(query, { username });
  if (!result || !result.data || !result.data.matchedUser) {
    throw new Error(`LeetCode profile for username "${username}" not found or submission stats are private.`);
  }

  return true;
}

/**
 * Fetches the question difficulty for a given titleSlug.
 * Uses an in-memory cache to prevent redundant API hits across users or repeat problems.
 */
async function getQuestionDifficulty(titleSlug) {
  if (difficultyCache[titleSlug]) {
    return difficultyCache[titleSlug];
  }

  const query = `
    query questionDifficulty($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        difficulty
      }
    }
  `;

  const result = await queryLeetCode(query, { titleSlug });
  const difficulty = result?.data?.question?.difficulty;

  if (difficulty) {
    difficultyCache[titleSlug] = difficulty;
    return difficulty;
  }

  return 'Easy'; // Safe fallback
}

/**
 * Fetches LeetCode problems solved by a user on a target date (UTC).
 * Returns an object with the counts of solved problems by difficulty: { Easy: X, Medium: Y, Hard: Z }.
 */
async function fetchActivityForDate(username, targetDateStr) {
  // Validate targetDateStr (format: 'YYYY-MM-DD')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
    throw new Error(`Invalid date format: ${targetDateStr}. Expected YYYY-MM-DD.`);
  }

  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        titleSlug
        timestamp
      }
    }
  `;

  // KNOWN LIMITATION: recentAcSubmissionList is capped at 20.
  // If a user solves 20+ problems in a single day, anything past the most recent 20 won't be counted.
  const result = await queryLeetCode(query, { username, limit: 20 });
  const submissions = result?.data?.recentAcSubmissionList || [];

  // Filter submissions by date (convert unix timestamp to YYYY-MM-DD UTC date string)
  const submissionsOnDate = submissions.filter(sub => {
    const subDateStr = new Date(sub.timestamp * 1000).toISOString().split('T')[0];
    return subDateStr === targetDateStr;
  });

  // Deduplicate by titleSlug (a problem solved twice in one day should only count once)
  const uniqueSlugs = [...new Set(submissionsOnDate.map(sub => sub.titleSlug))];

  const difficultyCounts = {
    Easy: 0,
    Medium: 0,
    Hard: 0
  };

  // Fetch difficulties for unique problems solved that day
  for (const titleSlug of uniqueSlugs) {
    try {
      const difficulty = await getQuestionDifficulty(titleSlug);
      if (difficultyCounts[difficulty] !== undefined) {
        difficultyCounts[difficulty]++;
      } else {
        // Fallback for unexpected difficulty values
        difficultyCounts['Easy']++;
      }
    } catch (err) {
      console.warn(`Could not fetch difficulty for problem: ${titleSlug}. Defaulting to Easy.`, err.message);
      difficultyCounts['Easy']++;
    }
  }

  return difficultyCounts;
}

module.exports = {
  validateUsername,
  fetchActivityForDate
};
