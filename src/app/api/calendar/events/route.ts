import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { Event } from '@/lib/models/Event';
import { requireStudent } from '@/lib/authz';
import { occurrencesInRange, toKey } from '@/lib/recurrence';

/**
 * Pushes the student's Layora calendar into their own Google Calendar.
 *
 * All-day entries, because a Layora event carries a date and no time. A
 * repeating entry is one row here, so its occurrences are expanded first and
 * pushed as separate all-day events — Google's own recurrence rules would be
 * neater, but expanding keeps one source of truth for what "every month on the
 * 31st" means rather than having two engines that could disagree.
 *
 * Bounded to the next `HORIZON_DAYS` so an open-ended weekly entry cannot
 * write thousands of events into someone's calendar.
 */

const HORIZON_DAYS = 120;
const MAX_EVENTS = 200;

export async function POST() {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  const { userId, cohort } = guard.requester;

  try {
    const client = await clerkClient();
    const tokenResponse = await client.users.getUserOauthAccessToken(userId, 'oauth_google');
    const googleToken = tokenResponse.data[0]?.token;

    if (!googleToken) {
      return NextResponse.json(
        { error: 'Google account not connected. Sign in with Google to sync your calendar.' },
        { status: 403 }
      );
    }

    const events = await Event.findForStudent(userId, cohort);

    const today = new Date();
    const from = toKey(today);
    const to = toKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + HORIZON_DAYS));

    // Flatten every entry into the individual days it actually falls on.
    const occurrences: { date: string; title: string; description: string | null }[] = [];
    for (const event of events) {
      for (const date of occurrencesInRange(event, from, to)) {
        occurrences.push({ date, title: event.title, description: event.description });
        if (occurrences.length >= MAX_EVENTS) break;
      }
      if (occurrences.length >= MAX_EVENTS) break;
    }

    if (occurrences.length === 0) {
      return NextResponse.json({ success: true, syncedCount: 0, skipped: 0 });
    }

    let synced = 0;
    let skipped = 0;

    for (const occurrence of occurrences) {
      // Google's all-day format: `end.date` is exclusive, so it is the day after.
      const [y, m, d] = occurrence.date.split('-').map(Number);
      const endDate = new Date(y, m - 1, d + 1);
      const endKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: occurrence.title,
            description: `${occurrence.description || ''}\n\n(Synced from Layora)`.trim(),
            start: { date: occurrence.date },
            end: { date: endKey },
          }),
        }
      );

      if (response.ok) {
        synced += 1;
      } else {
        // One rejected event should not abandon the rest of the calendar.
        skipped += 1;
        console.error('Google Calendar insert failed:', await response.text());
      }
    }

    return NextResponse.json({ success: true, syncedCount: synced, skipped });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Event calendar sync failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
