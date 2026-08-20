import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireStudent } from '@/lib/authz';

/**
 * Puts a daily study reminder for each course into the student's own Google
 * Calendar, repeating until the course deadline.
 *
 * This exists because a browser notification can only fire while Layora is
 * open in a tab. Google Calendar has no such limit: once the event is in their
 * calendar, the Calendar app reminds them on their phone with Layora closed.
 *
 * A real `RRULE` is used rather than one event per day, so a six-month course
 * is one calendar entry the student can edit or delete in one action, and
 * Google — not us — decides when to fire it.
 *
 * The courses arrive in the request body because they live in the client's
 * synced state, not in a table the server can read. That is safe here: the
 * only thing this writes to is the caller's own calendar.
 */

const TIME_PATTERN = /^\d{1,2}:\d{2}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** How long the reminder blocks out in the calendar. */
const DURATION_MINUTES = 30;

/** Guard against a runaway payload. */
const MAX_COURSES = 50;

interface CoursePayload {
  id?: string;
  name?: string;
  platform?: string;
  reminderEnabled?: boolean;
  reminderTime?: string;
  deadline?: string;
}

/** 'YYYY-MM-DD' + 'HH:MM' to a local Date. */
function at(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** RRULE's UNTIL is UTC and inclusive to the end of that day. */
function untilStamp(deadline: string): string {
  const [y, m, d] = deadline.split('-').map(Number);
  return `${new Date(Date.UTC(y, m - 1, d, 23, 59, 59)).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

export async function POST(request: Request) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const client = await clerkClient();
    const tokenResponse = await client.users.getUserOauthAccessToken(guard.requester.userId, 'oauth_google');
    const googleToken = tokenResponse.data[0]?.token;

    if (!googleToken) {
      return NextResponse.json(
        { error: 'Google account not connected. Sign in with Google to sync your calendar.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const courses: CoursePayload[] = Array.isArray(body?.courses) ? body.courses.slice(0, MAX_COURSES) : [];

    const todayKey = toDateKey(new Date());
    let synced = 0;
    let skipped = 0;
    const skippedNames: string[] = [];

    for (const course of courses) {
      const name = typeof course.name === 'string' ? course.name.trim() : '';
      const time = typeof course.reminderTime === 'string' && TIME_PATTERN.test(course.reminderTime)
        ? course.reminderTime
        : null;
      const deadline = typeof course.deadline === 'string' && DATE_PATTERN.test(course.deadline)
        ? course.deadline
        : null;

      // Only courses the student actually asked to be reminded about.
      if (!course.reminderEnabled || !name || !time) {
        skipped += 1;
        if (name) skippedNames.push(name);
        continue;
      }

      // A deadline already in the past would produce a series with no
      // occurrences, so say so rather than writing a dead event.
      if (!deadline || deadline < todayKey) {
        skipped += 1;
        skippedNames.push(`${name} (deadline passed)`);
        continue;
      }

      // Start today if the deadline is still ahead; Google expands the rest.
      const start = at(todayKey, time);
      const end = new Date(start.getTime() + DURATION_MINUTES * 60_000);

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `Study: ${name}`,
            description:
              `Daily study reminder${course.platform ? ` · ${course.platform}` : ''}\n\n(Synced from Layora)`,
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
            recurrence: [`RRULE:FREQ=DAILY;UNTIL=${untilStamp(deadline)}`],
            reminders: {
              useDefault: false,
              // At the moment it starts — the point is the reminder itself.
              overrides: [{ method: 'popup', minutes: 0 }],
            },
          }),
        }
      );

      if (response.ok) {
        synced += 1;
      } else {
        skipped += 1;
        skippedNames.push(name);
        console.error('Google Calendar course insert failed:', await response.text());
      }
    }

    return NextResponse.json({ success: true, syncedCount: synced, skipped, skippedNames });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Course calendar sync failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
