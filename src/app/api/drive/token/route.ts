import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Attempt to get the OAuth token
    const client = await clerkClient();
    let tokensResponse;
    try {
      tokensResponse = await client.users.getUserOauthAccessToken(userId, 'oauth_google');
    } catch (err) {
      console.error('Clerk error fetching token:', err);
      return NextResponse.json({ error: 'Failed to fetch Google OAuth token. Please ensure your Google account is connected.' }, { status: 403 });
    }

    // Handle both array returns (older clerk versions) and paginated { data } returns (newer clerk versions)
    const tokens = Array.isArray(tokensResponse) ? tokensResponse : tokensResponse?.data;
    const token = tokens?.[0]?.token;

    if (!token) {
      return NextResponse.json({ error: 'Google Drive not connected. Please connect your Google account in Settings.' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      token: token
    });
    
  } catch (error: any) {
    console.error('Drive token exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
