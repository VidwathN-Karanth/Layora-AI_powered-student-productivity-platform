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

/**
 * Where the department is, used when the browser does not say.
 *
 * Google rejects a *recurring* timed event that has no `timeZone` — a plain
 * UTC instant is ambiguous once a rule repeats it across days, so it refuses
 * with "Missing time zone definition for start time". A one-off event would
 * have been accepted, which is why this only appeared here.
 */
const FALLBACK_TIME_ZONE = 'Asia/Kolkata';

/** Loose IANA shape check — "Region/City", or a plain zone like "UTC". */
const TIME_ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

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

/**
 * Wall-clock time with no offset, e.g. "2026-08-21T10:22:00".
 *
 * Deliberately not `toISOString()`: that converts to UTC, and a daily rule
 * anchored to a UTC instant drifts off the hour the student chose whenever the
 * offset changes. Google pairs this with `timeZone` and keeps 10:22 at 10:22.
 */
function wallClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
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

    // The browser knows where the student actually is; fall back to the
    // department's zone when it does not say.
    const timeZone = typeof body?.timeZone === 'string' && TIME_ZONE_PATTERN.test(body.timeZone)
      ? body.timeZone
      : FALLBACK_TIME_ZONE;

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
      if (!name) {
        skipped += 1;
        continue;
      }

      if (!course.reminderEnabled) {
        skipped += 1;
        skippedNames.push(`${name} — Daily Notification is off`);
        continue;
      }

      if (!time) {
        skipped += 1;
        skippedNames.push(`${name} — no reminder time set`);
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
            start: { dateTime: wallClock(start), timeZone },
            end: { dateTime: wallClock(end), timeZone },
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
        // Say what Google actually objected to. The usual answer is a missing
        // Calendar scope on the Google connection, which no amount of retrying
        // here will fix — and which the student can do nothing about unless
        // they are told.
        const raw = await response.text();
        let detail = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(raw);
          detail = parsed?.error?.message || detail;
        } catch {
          // Not JSON; the status is the best we have.
        }

        if (response.status === 401 || response.status === 403) {
          detail = 'Layora is not allowed to write to your Google Calendar. Sign out and back in with Google to grant calendar access.';
        }

        skipped += 1;
        skippedNames.push(`${name} — ${detail}`);
        console.error('Google Calendar course insert failed:', raw);
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
