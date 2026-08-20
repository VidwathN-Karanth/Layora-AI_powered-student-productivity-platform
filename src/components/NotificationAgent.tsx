'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { apiFetch, readJson } from '@/lib/apiClient';
import { occursOn, type RepeatRule } from '@/lib/recurrence';
import { toDateKey } from '@/lib/dateFormat';
import {
  agendaAnnouncement, alreadyNotified, announce, dueCourseReminders,
  markNotified, pruneNotificationMarks, requestPermissionOnFirstRun, timeToMinutes,
} from '@/lib/notifications';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  repeat?: RepeatRule | null;
  repeatUntil?: string | null;
  isStaff: boolean;
}

/**
 * How often the timetable and course reminders are re-checked.
 *
 * Fifteen seconds rather than a minute: a student who sets a reminder for two
 * minutes' time is watching the clock, and a minute of dead air reads as
 * broken. The work per tick is a scan of two small arrays.
 */
const TICK_MS = 15_000;

/** A block announces itself this many minutes before it starts. */
const LEAD_MINUTES = 5;

/**
 * Turns the day's schedule into reminders.
 *
 * This replaces the email reminders Layora used to send from the server. Each
 * reminder goes out on two channels at once via `announce`: an in-app toast,
 * which always works, and an OS notification when the browser has been given
 * permission. Nothing talks to an outside service.
 *
 * Three things are announced:
 *   1. Today's agenda, every time the workspace is opened — including a plain
 *      "nothing on today" so silence is never ambiguous.
 *   2. Each timetable block, shortly before it starts.
 *   3. Each course reminder — at its time, or on the next open after it if the
 *      workspace was closed then.
 *
 * Blocks and courses are marked as sent for the day, so a reload does not
 * repeat them. Renders nothing.
 */
export default function NotificationAgent() {
  // The master switch in Settings gates everything; the planner has its own
  // switch on top of it, scoped to timetable blocks alone.
  const enabled = useStore((s) => s.notificationsEnabled);
  const plannerEnabled = useStore((s) => s.plannerNotificationsEnabled);
  const timetable = useStore((s) => s.timetable);
  const courses = useStore((s) => s.courses);

  // Read through refs inside the interval so the timer is not torn down and
  // rebuilt every time the timetable changes.
  const timetableRef = useRef(timetable);
  const coursesRef = useRef(courses);
  const plannerRef = useRef(plannerEnabled);
  useEffect(() => { timetableRef.current = timetable; }, [timetable]);
  useEffect(() => { coursesRef.current = courses; }, [courses]);
  useEffect(() => { plannerRef.current = plannerEnabled; }, [plannerEnabled]);

  // 0. A brand-new student is asked for desktop permission once, on their
  //    first visit. Chrome prompts on load; Firefox and Safari refuse without a
  //    gesture, and for those the toast below points at the switch in Settings.
  //    Runs in a timeout so nothing is set synchronously during the effect.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const id = setTimeout(async () => {
      const { state, asked } = await requestPermissionOnFirstRun();
      if (cancelled || asked || state !== 'default') return;

      // The browser would not even show the prompt, so ask in-app instead.
      announce({
        title: 'Turn on desktop reminders',
        body: 'Open Settings to let Layora notify you on this device.',
        tag: 'layora-permission-nudge',
        url: '/dashboard/settings/',
      });
    }, 1500);

    return () => { cancelled = true; clearTimeout(id); };
  }, [enabled]);

  // 1. Today's agenda, announced every time the workspace is opened.
  //
  // Deliberately not once-per-day: a student opening the site at nine and again
  // at four should be told both times. It is one announcement per page load,
  // and the dashboard layout does not remount as you move between pages, so
  // navigating around does not repeat it.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const day = toDateKey(new Date());

    // Still prunes: block and course marks below are per-day.
    pruneNotificationMarks(day);

    (async () => {
      try {
        const data = await readJson<{ events: CalendarEvent[] }>(await apiFetch('/api/events'));
        if (cancelled) return;

        // A repeating entry is stored once, so match occurrences rather than
        // the stored start date.
        const todays = (data.events || []).filter((e) => occursOn(e, day));

        // Let the workspace paint first, so the toast reads as an arrival
        // rather than part of the page load.
        setTimeout(() => {
          if (cancelled) return;
          // Handles the empty day too — see agendaAnnouncement.
          announce({ ...agendaAnnouncement(todays), tag: `layora-events-${day}`, kind: 'event' });
        }, 900);
      } catch {
        // A reminder is not worth surfacing an error for.
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  // 2 & 3. Timetable blocks and course reminders.
  const check = useCallback(() => {
    {
      const now = new Date();
      const day = toDateKey(now);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Timetable blocks answer to the planner's own switch as well.
      for (const block of (plannerRef.current ? timetableRef.current || [] : [])) {
        if (block.day !== now.getDay() || block.completed) continue;

        const start = timeToMinutes(block.start);
        if (start === null) continue;

        // Fires in the few minutes before the block starts, so a tick landing
        // either side of the exact minute still catches it.
        const lead = start - LEAD_MINUTES;
        if (nowMinutes < lead || nowMinutes >= start) continue;

        const key = `block-${block.id}`;
        if (alreadyNotified(key, day)) continue;

        announce({
          title: block.type === 'break' ? block.title : `Starting soon: ${block.title}`,
          body: `${block.start} – ${block.end}${block.details ? ` · ${block.details}` : ''}`,
          tag: key,
          kind: 'block',
        });
        markNotified(key, day);
      }

      // The decision lives in dueCourseReminders so it can be tested directly.
      for (const reminder of dueCourseReminders(coursesRef.current || [], now, (key) => alreadyNotified(key, day))) {
        announce({ title: reminder.title, body: reminder.body, tag: reminder.key, kind: 'course' });
        markNotified(reminder.key, day);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    check();
    const id = setInterval(check, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, check]);

  // Editing a reminder re-checks straight away instead of waiting for the next
  // tick, so a time set for a minute from now behaves the way it reads.
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(check, 0);
    return () => clearTimeout(id);
  }, [enabled, courses, check]);

  return null;
}
