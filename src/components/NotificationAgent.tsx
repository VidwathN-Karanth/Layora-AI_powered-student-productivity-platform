'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { apiFetch, readJson } from '@/lib/apiClient';
import { occursOn, type RepeatRule } from '@/lib/recurrence';
import { toDateKey } from '@/lib/dateFormat';
import {
  alreadyNotified, isReminderDue, markNotified, notify, pruneNotificationMarks, timeToMinutes,
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

/** How often the timetable and course reminders are re-checked. */
const TICK_MS = 60_000;

/** A block announces itself this many minutes before it starts. */
const LEAD_MINUTES = 5;

/**
 * Turns the day's schedule into device notifications.
 *
 * This replaces the email reminders Layora used to send from the server. It
 * runs wherever the student has the workspace open — laptop, phone, whichever —
 * and never talks to an outside service.
 *
 * Three things are announced:
 *   1. Today's events, once, when the workspace opens.
 *   2. Each timetable block, shortly before it starts.
 *   3. Each course reminder, at the time the student set on it.
 *
 * Every one is marked as sent for the day, so reloading the page does not
 * re-announce anything. Renders nothing.
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

  // 1. Today's events, announced once when the workspace opens.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const day = toDateKey(new Date());

    pruneNotificationMarks(day);

    (async () => {
      if (alreadyNotified('events', day)) return;

      try {
        const data = await readJson<{ events: CalendarEvent[] }>(await apiFetch('/api/events'));
        if (cancelled) return;

        // A repeating entry is stored once, so match occurrences rather than
        // the stored start date.
        const todays = (data.events || []).filter((e) => occursOn(e, day));
        if (todays.length === 0) return;

        const shown = notify(
          todays.length === 1 ? 'Today: ' + todays[0].title : `${todays.length} events today`,
          {
            body: todays.map((e) => e.title).join(' · '),
            tag: `layora-events-${day}`,
          }
        );
        if (shown) markNotified('events', day);
      } catch {
        // A reminder is not worth surfacing an error for.
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  // 2 & 3. Timetable blocks and course reminders, checked once a minute.
  useEffect(() => {
    if (!enabled) return;

    const check = () => {
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

        const label = block.type === 'break' ? block.title : `Starting soon: ${block.title}`;
        if (notify(label, {
          body: `${block.start} – ${block.end}${block.details ? ` · ${block.details}` : ''}`,
          tag: key,
        })) {
          markNotified(key, day);
        }
      }

      for (const course of coursesRef.current || []) {
        if (!course.reminderEnabled) continue;
        if (!isReminderDue(course.reminderTime, now)) continue;

        const key = `course-${course.id}`;
        if (alreadyNotified(key, day)) continue;

        if (notify(`Course: ${course.name}`, {
          body: `Time for your session on ${course.platform || 'this course'} · ${course.progress || 0}% done`,
          tag: key,
        })) {
          markNotified(key, day);
        }
      }
    };

    check();
    const id = setInterval(check, TICK_MS);
    return () => clearInterval(id);
  }, [enabled]);

  return null;
}
