import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const client = await clerkClient();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch OAuth Access Token from Clerk
    const tokenResponse = await client.users.getUserOauthAccessToken(
      userId,
      'oauth_google'
    );

    const googleToken = tokenResponse.data[0]?.token;

    if (!googleToken) {
      return NextResponse.json(
        { error: 'Google authentication token not found. Please ensure you are logged in using Google and have authorized calendar scopes.' },
        { status: 400 }
      );
    }

    // 2. Parse request payload
    const body = await request.json();
    const { scope, day } = body; // scope: 'day' | 'week', day: 0-6

    if (!scope || (scope === 'day' && typeof day !== 'number')) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    // 3. List events containing "Synced from Layora Student Planner"
    const listUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=Synced+from+Layora+Student+Planner&maxResults=250`;
    const listResponse = await fetch(listUrl, {
      headers: {
        'Authorization': `Bearer ${googleToken}`,
        'Accept': 'application/json'
      }
    });

    if (!listResponse.ok) {
      const errText = await listResponse.text();
      console.error('Failed to list calendar events from Google API:', errText);
      return NextResponse.json({ error: 'Failed to fetch calendar events from Google' }, { status: 502 });
    }

    const data = await listResponse.json();
    const events = data.items || [];

    // Days code converter
    const daysMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const targetDayStr = `BYDAY=${daysMap[day]}`;

    // Filter events to delete
    const targetEvents = events.filter((evt: any) => {
      // Safety check: ensure description or summary confirms it was created by Layora
      const isLayoraEvent = (evt.description && evt.description.includes('Synced from Layora Student Planner')) ||
                            (evt.summary && evt.summary.includes('Synced from Layora Student Planner'));
      
      if (!isLayoraEvent) return false;

      if (scope === 'week') return true;

      // If scope is 'day', check if it is tagged with [Day: X] or has a matching recurrence rule
      if (scope === 'day') {
        const hasDayFlag = evt.description && evt.description.includes(`[Day: ${day}]`);
        if (hasDayFlag) return true;

        if (evt.recurrence && Array.isArray(evt.recurrence)) {
          return evt.recurrence.some((rule: string) => rule.includes(targetDayStr));
        }
      }

      return false;
    });

    // 4. Delete each target event
    let deletedCount = 0;
    for (const evt of targetEvents) {
      const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${evt.id}`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${googleToken}`
        }
      });

      if (deleteResponse.ok) {
        deletedCount++;
      } else {
        console.error(`Failed to delete event ID ${evt.id} from Google Calendar`);
      }
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (error: any) {
    console.error('Calendar deletion error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error during calendar deletion' }, { status: 500 });
  }
}
