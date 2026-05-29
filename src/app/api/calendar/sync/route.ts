import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { blocks, activeDay } = body;

    if (!blocks || !Array.isArray(blocks)) {
      return NextResponse.json({ error: 'Invalid payload: blocks array required' }, { status: 400 });
    }

    // Get the Google OAuth token
    const client = await clerkClient();
    let tokensResponse;
    try {
      tokensResponse = await client.users.getUserOauthAccessToken(userId, 'oauth_google');
    } catch (err) {
      console.error('Clerk error fetching token for Calendar:', err);
      return NextResponse.json({ error: 'Failed to fetch Google token.' }, { status: 403 });
    }

    const tokens = Array.isArray(tokensResponse) ? tokensResponse : tokensResponse?.data;
    const token = tokens?.[0]?.token;

    if (!token) {
      return NextResponse.json({ error: 'Google Account not connected.' }, { status: 403 });
    }

    // Calculate the target Date based on activeDay (0=Sun, 1=Mon, etc) and current week
    const now = new Date();
    const currentDay = now.getDay();
    const diff = activeDay - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const date = String(targetDate.getDate()).padStart(2, '0');

    // Create events sequentially to avoid rate limits (or use Promise.all)
    const results = [];
    
    for (const block of blocks) {
      // block.start and block.end are in "HH:MM" format
      const startDateTime = `${year}-${month}-${date}T${block.start}:00`;
      const endDateTime = `${year}-${month}-${date}T${block.end}:00`;

      const eventPayload = {
        summary: `Layora: ${block.title}`,
        description: `${block.details}\nType: ${block.type}\nSubject: ${block.subjectCode || 'N/A'}`,
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        colorId: block.type === 'study' ? '9' : block.type === 'class' ? '1' : '10', // Blueberry, Lavender, Basil
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create calendar event:', errorData);
        if (response.status === 401 || response.status === 403) {
           return NextResponse.json({ error: 'Calendar API error: Insufficient permissions. Did you add https://www.googleapis.com/auth/calendar.events to Clerk?' }, { status: 403 });
        }
        throw new Error('Google Calendar API Error');
      }

      const data = await response.json();
      results.push(data);
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.length} events`,
      results
    });
    
  } catch (error: any) {
    console.error('Calendar sync exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
