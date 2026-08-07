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

    // 2. Parse request payload (timetable blocks)
    const body = await request.json();
    const { timetable } = body;

    if (!timetable || !Array.isArray(timetable)) {
      return NextResponse.json({ error: 'Missing or invalid timetable data' }, { status: 400 });
    }

    // Days converter (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const daysMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    function getNextDateForDay(dayOfWeek: number, timeStr: string): Date {
      const now = new Date();
      const resultDate = new Date();
      const [hours, minutes] = timeStr.split(':').map(Number);
      resultDate.setHours(hours, minutes, 0, 0);
      
      const currentDay = now.getDay();
      let distance = dayOfWeek - currentDay;
      if (distance < 0 || (distance === 0 && now.getTime() > resultDate.getTime())) {
        distance += 7;
      }
      resultDate.setDate(now.getDate() + distance);
      return resultDate;
    }

    // 3. Sync each block to Google Calendar primary calendar using plain fetch requests
    const syncResults = [];
    for (const block of timetable) {
      const startDateTime = getNextDateForDay(block.day, block.start);
      const endDateTime = getNextDateForDay(block.day, block.end);
      const byDay = daysMap[block.day];

      const eventData = {
        summary: block.title,
        description: `${block.details || ''} (Synced from Layora Student Planner)`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'UTC'
        },
        recurrence: [
          `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`
        ]
      };

      // Call Google Calendar API Events Insert endpoint
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to sync event to Google Calendar:', errorData);
        // Continue syncing other events but log failure
      } else {
        syncResults.push(block.id);
      }
    }

    return NextResponse.json({ success: true, syncedCount: syncResults.length });
  } catch (error: any) {
    console.error('Calendar sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error during calendar sync' }, { status: 500 });
  }
}
