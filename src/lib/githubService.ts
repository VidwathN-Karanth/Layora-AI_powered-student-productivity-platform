import axios from 'axios';

interface GitHubValidationError {
  message: string;
}

interface GitHubUserResponse {
  data?: {
    user?: {
      login: string;
      contributionsCollection?: {
        contributionCalendar?: {
          weeks?: Array<{
            contributionDays?: Array<{
              date: string;
              contributionCount: number;
            }>;
          }>;
        };
      };
    };
  };
  errors?: GitHubValidationError[];
}

interface AxiosErrorLike {
  message: string;
  response?: {
    data?: {
      errors?: GitHubValidationError[];
    };
  };
}

/**
 * Helper to query GitHub GraphQL API.
 */
async function queryGitHub(query: string, variables: Record<string, unknown> = {}): Promise<GitHubUserResponse> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not configured');
  }

  try {
    const response = await axios.post<GitHubUserResponse>(
      'https://api.github.com/graphql',
      { query, variables },
      {
        headers: {
          'Authorization': `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Layora-Backend'
        },
        timeout: 10000
      }
    );

    if (response.data.errors) {
      const errorMsg = response.data.errors.map((err) => err.message).join(', ');
      throw new Error(`GitHub GraphQL Error: ${errorMsg}`);
    }

    return response.data;
  } catch (error: unknown) {
    const axiosErr = error as AxiosErrorLike;
    if (axiosErr.response?.data?.errors) {
      const errorMsg = axiosErr.response.data.errors.map((err) => err.message).join(', ');
      throw new Error(`GitHub service error: ${errorMsg}`);
    }
    const errMessage = axiosErr.message || (error instanceof Error ? error.message : String(error));
    throw new Error(`GitHub service communication error: ${errMessage}`);
  }
}

/**
 * Validates if a GitHub username exists.
 */
export async function validateUsername(username: string): Promise<boolean> {
  if (!username) throw new Error('GitHub username is required');

  const query = `
    query validateUser($login: String!) {
      user(login: $login) {
        login
      }
    }
  `;

  try {
    const result = await queryGitHub(query, { login: username });
    if (!result || !result.data || !result.data.user) {
      throw new Error(`GitHub user "${username}" not found.`);
    }
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message && err.message.includes('Could not resolve to a User')) {
      throw new Error(`GitHub profile for username "${username}" does not exist.`);
    }
    throw error;
  }
}

interface ContributionDay {
  date: string;
  contributionCount: number;
}

/**
 * Fetches contribution calendar count on the target date.
 */
export async function fetchActivityForDate(username: string, targetDateStr: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
    throw new Error(`Invalid date format: ${targetDateStr}. Expected YYYY-MM-DD.`);
  }

  const query = `
    query getContributions($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const result = await queryGitHub(query, { login: username });
  const weeks = result?.data?.user?.contributionsCollection?.contributionCalendar?.weeks || [];

  const allDays: ContributionDay[] = [];
  for (const week of weeks) {
    if (week.contributionDays) {
      allDays.push(...week.contributionDays);
    }
  }

  const targetDay = allDays.find((day) => day.date === targetDateStr);
  if (!targetDay) {
    return 0;
  }

  return targetDay.contributionCount || 0;
}
