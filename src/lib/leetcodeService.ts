import axios from 'axios';

const difficultyCache: { [key: string]: string } = {};

interface LeetCodeQuestion {
  difficulty: string;
}

interface LeetCodeSubmission {
  titleSlug: string;
  timestamp: number;
}

interface LeetCodeResponse {
  data?: {
    matchedUser?: {
      username: string;
      submitStats?: {
        acSubmissionNum?: Array<{
          difficulty: string;
          count: number;
        }>;
      };
    };
    question?: LeetCodeQuestion;
    recentAcSubmissionList?: LeetCodeSubmission[];
  };
}

/**
 * Helper to query LeetCode GraphQL.
 */
async function queryLeetCode(query: string, variables: Record<string, unknown> = {}): Promise<LeetCodeResponse> {
  try {
    const response = await axios.post<LeetCodeResponse>(
      'https://leetcode.com/graphql',
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://leetcode.com'
        },
        timeout: 10000
      }
    );
    return response.data;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('LeetCode API call failed:', errMessage);
    throw new Error(`LeetCode service communication error: ${errMessage}`);
  }
}

/**
 * Checks if a LeetCode username is valid and has public stats.
 */
export async function validateUsername(username: string): Promise<boolean> {
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
 * Fetches total solves by difficulty for a user.
 */
export async function fetchTotalSolves(username: string): Promise<{ Easy: number; Medium: number; Hard: number }> {
  if (!username) throw new Error('LeetCode username is required');

  const query = `
    query userProblemsSolved($username: String!) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;

  const result = await queryLeetCode(query, { username });
  const stats = result?.data?.matchedUser?.submitStats?.acSubmissionNum || [];
  
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const stat of stats) {
    if (stat.difficulty === 'Easy') counts.Easy = stat.count;
    if (stat.difficulty === 'Medium') counts.Medium = stat.count;
    if (stat.difficulty === 'Hard') counts.Hard = stat.count;
  }

  return counts;
}

/**
 * Fetches difficulty for a problem slug (caches it in memory).
 */
async function getQuestionDifficulty(titleSlug: string): Promise<string> {
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

  return 'Easy';
}

interface DifficultyCounts {
  [key: string]: number;
  Easy: number;
  Medium: number;
  Hard: number;
}

/**
 * Fetches solved submissions counts on target date.
 */
export async function fetchActivityForDate(username: string, targetDateStr: string): Promise<DifficultyCounts> {
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

  const result = await queryLeetCode(query, { username, limit: 20 });
  const submissions = result?.data?.recentAcSubmissionList || [];

  // Filter down to the target date YYYY-MM-DD UTC
  const submissionsOnDate = submissions.filter((sub) => {
    const subDateStr = new Date(sub.timestamp * 1000).toISOString().split('T')[0];
    return subDateStr === targetDateStr;
  });

  // Deduplicate by titleSlug
  const uniqueSlugs = Array.from(new Set(submissionsOnDate.map((sub) => sub.titleSlug)));

  const difficultyCounts: DifficultyCounts = {
    Easy: 0,
    Medium: 0,
    Hard: 0
  };

  for (const titleSlug of uniqueSlugs) {
    try {
      const difficulty = await getQuestionDifficulty(titleSlug);
      if (difficultyCounts[difficulty] !== undefined) {
        difficultyCounts[difficulty]++;
      } else {
        difficultyCounts['Easy']++;
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.warn(`Could not fetch difficulty for problem: ${titleSlug}. Defaulting to Easy.`, errMessage);
      difficultyCounts['Easy']++;
    }
  }

  return difficultyCounts;
}
