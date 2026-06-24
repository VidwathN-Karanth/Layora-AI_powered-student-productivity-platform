import axios from 'axios';

/**
 * Helper to fetch HTML from CodeChef user profile.
 */
async function fetchProfileHtml(username: string): Promise<string> {
  const normalizedUsername = username.trim();
  const url = `https://www.codechef.com/users/${normalizedUsername}`;

  try {
    const response = await axios.get<string>(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    return response.data;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CodeChef Service] HTTP request failed for user ${username}:`, errMessage);
    throw new Error(`CodeChef communication error: ${errMessage}`);
  }
}

/**
 * Checks if a CodeChef username is valid and contains solved statistics.
 */
export async function validateUsername(username: string): Promise<boolean> {
  if (!username) throw new Error('CodeChef username is required');

  const html = await fetchProfileHtml(username);
  const match = html.match(/Total Problems Solved:\s*(\d+)/i);
  
  if (!match) {
    throw new Error(`CodeChef profile for username "${username}" not found or solve statistics are unavailable.`);
  }

  return true;
}

/**
 * Fetches the total solves count for a user.
 */
export async function fetchTotalSolves(username: string): Promise<number> {
  if (!username) throw new Error('CodeChef username is required');

  try {
    const html = await fetchProfileHtml(username);
    const match = html.match(/Total Problems Solved:\s*(\d+)/i);
    
    if (match) {
      return parseInt(match[1], 10);
    }
    
    return 0;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CodeChef Service] Failed to retrieve total solves for user ${username}:`, errMessage);
    throw new Error(`CodeChef retrieval failed: ${errMessage}`);
  }
}
