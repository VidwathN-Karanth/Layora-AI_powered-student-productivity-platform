const supabase = require('../config/supabase');

function checkDb() {
  if (!supabase) {
    throw new Error('Database is unconfigured. Please check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.');
  }
}

/**
 * Maps database snake_case user row to camelCase JS object
 */
function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    leetcodeUsername: row.leetcode_username,
    githubUsername: row.github_username,
    createdAt: row.created_at
  };
}

class User {
  /**
   * Creates a new user in the Supabase 'users' table.
   * If no ID is provided, a random unique string is generated.
   */
  static async create({ id, name, email, leetcodeUsername = null, githubUsername = null }) {
    checkDb();
    const userId = id || `usr_${Math.random().toString(36).substring(2, 11)}`;
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        name,
        email,
        leetcode_username: leetcodeUsername,
        github_username: githubUsername
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return mapUserRow(data);
  }

  /**
   * Finds a user by ID.
   */
  static async findById(id) {
    checkDb();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }

    return mapUserRow(data);
  }

  /**
   * Updates a user's details, such as leetcodeUsername and githubUsername.
   * Handles partial updates.
   */
  static async update(id, updates) {
    checkDb();
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    
    // Allow explicitly setting to null or providing a value
    if (updates.leetcodeUsername !== undefined) {
      dbUpdates.leetcode_username = updates.leetcodeUsername;
    }
    if (updates.githubUsername !== undefined) {
      dbUpdates.github_username = updates.githubUsername;
    }

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return mapUserRow(data);
  }

  /**
   * Retrieves all users who have linked at least one public platform (LeetCode or GitHub).
   */
  static async findLinkedUsers() {
    checkDb();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or('leetcode_username.not.is.null,github_username.not.is.null');

    if (error) {
      throw new Error(`Failed to retrieve linked users: ${error.message}`);
    }

    return data.map(mapUserRow);
  }

  /**
   * Retrieves all users in the system (useful for compiling leaderboard zeros).
   */
  static async findAll() {
    checkDb();
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      throw new Error(`Failed to retrieve all users: ${error.message}`);
    }

    return data.map(mapUserRow);
  }
}

module.exports = User;
