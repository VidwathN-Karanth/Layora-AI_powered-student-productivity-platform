import { NextResponse } from 'next/server';
import { User } from '@/lib/models/User';
import * as leetcodeService from '@/lib/leetcodeService';
import * as githubService from '@/lib/githubService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  
  try {
    const { leetcodeUsername, githubUsername } = await request.json();

    // 1. Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: `User with ID "${userId}" not found.` },
        { status: 404 }
      );
    }

    const updates: {
      leetcodeUsername?: string | null;
      githubUsername?: string | null;
    } = {};

    // 2. Validate LeetCode username
    if (leetcodeUsername !== undefined && leetcodeUsername !== null && leetcodeUsername !== '') {
      try {
        await leetcodeService.validateUsername(leetcodeUsername);
        updates.leetcodeUsername = leetcodeUsername;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `LeetCode validation failed: ${errMsg}` },
          { status: 400 }
        );
      }
    } else if (leetcodeUsername === null || leetcodeUsername === '') {
      updates.leetcodeUsername = null;
    }

    // 3. Validate GitHub username
    if (githubUsername !== undefined && githubUsername !== null && githubUsername !== '') {
      try {
        await githubService.validateUsername(githubUsername);
        updates.githubUsername = githubUsername;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: `GitHub validation failed: ${errMsg}` },
          { status: 400 }
        );
      }
    } else if (githubUsername === null || githubUsername === '') {
      updates.githubUsername = null;
    }

    // 4. If no updates are specified, return existing user
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(user);
    }

    // 5. Update user credentials in database
    const updatedUser = await User.update(userId, updates);
    return NextResponse.json(updatedUser);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`API Error linking accounts for user ${userId}:`, errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
