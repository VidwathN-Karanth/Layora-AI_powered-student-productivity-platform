const axios = require('axios');

/**
 * Helper to query GitHub GraphQL API.
 * Requires GITHUB_TOKEN environment variable.
 */
async function queryGitHub(query, variables = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not configured');
  }

  try {
    const response = await axios.post(
      'https://api.github.com/graphql',
      {
        query,
        variables
      },
      {
        headers: {
          'Authorization': `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Layora-Backend'
        },
        timeout: 10000 // 10s timeout
      }
    );

    // GitHub returns errors array in GraphQL response if query is invalid or entity not found
    if (response.data.errors) {
      const errorMsg = response.data.errors.map(err => err.message).join(', ');
      throw new Error(`GitHub GraphQL Error: ${errorMsg}`);
    }

    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.errors) {
      const errorMsg = error.response.data.errors.map(err => err.message).join(', ');
      throw new Error(`GitHub service error: ${errorMsg}`);
    }
    throw new Error(`GitHub service communication error: ${error.message}`);
  }
}

/**
 * Validates whether a GitHub username exists.
 * Throws a descriptive error if user cannot be found or is private.
 */
async function validateUsername(username) {
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
  } catch (error) {
    // Clarify error message for missing user
    if (error.message.includes('Could not resolve to a User')) {
      throw new Error(`GitHub profile for username "${username}" does not exist.`);
    }
    throw error;
  }
}

/**
 * Fetches the public contribution count for a GitHub user on a target date (UTC).
 * Returns the number of contributions.
 */
async function fetchActivityForDate(username, targetDateStr) {
  // Validate targetDateStr (format: 'YYYY-MM-DD')
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

  // Flatten the weeks to get all contribution days
  const allDays = [];
  for (const week of weeks) {
    if (week.contributionDays) {
      allDays.push(...week.contributionDays);
    }
  }

  // Find the entry matching the target date
  // NOTE: This only reflects what's already visible on the user's public contribution graph.
  // Private repository activity won't show up unless the user has opted to make private contributions visible in their GitHub settings.
  const targetDay = allDays.find(day => day.date === targetDateStr);
  
  if (!targetDay) {
    console.warn(`No GitHub contribution entry found for date ${targetDateStr} on user ${username}. Returning 0.`);
    return 0;
  }

  return targetDay.contributionCount;
}

module.exports = {
  validateUsername,
  fetchActivityForDate
};
