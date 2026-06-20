import { supabaseAdmin } from '../supabaseAdmin';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  leetcodeUsername: string | null;
  githubUsername: string | null;
  createdAt: string;
}

interface DatabaseUserRow {
  id: string;
  name: string;
  email: string;
  leetcode_username: string | null;
  github_username: string | null;
  created_at: string;
}

/**
 * Maps database snake_case row to camelCase JS object.
 */
function mapUserRow(row: DatabaseUserRow | null | undefined): UserRow | null {
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

export class User {
  /**
   * Creates a user profile in Supabase.
   */
  static async create({ 
    id, 
    name, 
    email, 
    leetcodeUsername = null, 
    githubUsername = null 
  }: { 
    id?: string; 
    name: string; 
    email: string; 
    leetcodeUsername?: string | null; 
    githubUsername?: string | null; 
  }): Promise<UserRow | null> {
    const userId = id || `usr_${Math.random().toString(36).substring(2, 11)}`;
    const { data, error } = await supabaseAdmin
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

    return mapUserRow(data as DatabaseUserRow);
  }

  /**
   * Finds a user profile by ID.
   */
  static async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No user found
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }

    return mapUserRow(data as DatabaseUserRow);
  }

  /**
   * Updates user linking credentials.
   */
  static async update(
    id: string, 
    updates: { 
      name?: string; 
      email?: string; 
      leetcodeUsername?: string | null; 
      githubUsername?: string | null; 
    }
  ): Promise<UserRow | null> {
    const dbUpdates: {
      name?: string;
      email?: string;
      leetcode_username?: string | null;
      github_username?: string | null;
    } = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.leetcodeUsername !== undefined) dbUpdates.leetcode_username = updates.leetcodeUsername;
    if (updates.githubUsername !== undefined) dbUpdates.github_username = updates.githubUsername;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return mapUserRow(data as DatabaseUserRow);
  }

  /**
   * Finds all users with at least one profile linked.
   */
  static async findLinkedUsers(): Promise<UserRow[]> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .or('leetcode_username.not.is.null,github_username.not.is.null');

    if (error) {
      throw new Error(`Failed to retrieve linked users: ${error.message}`);
    }

    return (data || []).map((row) => mapUserRow(row as DatabaseUserRow)).filter((u): u is UserRow => u !== null);
  }

  /**
   * Finds all users in the system.
   */
  static async findAll(): Promise<UserRow[]> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*');

    if (error) {
      throw new Error(`Failed to retrieve all users: ${error.message}`);
    }

    return (data || []).map((row) => mapUserRow(row as DatabaseUserRow)).filter((u): u is UserRow => u !== null);
  }
}
