/**
 * Device notifications.
 *
 * Layora used to email students — a daily course reminder and an inactivity
 * nudge, both sent from an SMTP account on the server. That is gone. Reminders
 * now surface on whatever device the student has the site open on, using the
 * browser's own Notification API, so nothing leaves the machine and there is no
 * mail credential to keep alive.
 *
 * Everything here is browser-only and defensive: a device that has no
 * Notification API, or a student who said no, simply gets nothing rather than
 * an error.
 */

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

/** Whether this browser can show notifications at all. */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionState(): NotificationPermissionState {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

/**
 * Asks for permission, returning the resulting state.
 *
 * Must be called from a user gesture — browsers ignore (or permanently deny)
 * a request that arrives on page load, which is why nothing here asks on its
 * own.
 */
export async function requestPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission as NotificationPermissionState;

  try {
    return (await Notification.requestPermission()) as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

export interface NotifyOptions {
  body?: string;
  /** Collapses repeats: a second notification with the same tag replaces the first. */
  tag?: string;
  /** Silent notifications still appear, they just make no sound. */
  silent?: boolean;
  /** Where clicking the notification should take the student. */
  url?: string;
}

/**
 * Shows one notification. Returns false when nothing was shown, so callers can
 * decide whether to fall back to something on-screen.
 */
export function notify(title: string, options: NotifyOptions = {}): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;

  try {
    const notification = new Notification(title, {
      body: options.body,
      tag: options.tag,
      silent: options.silent,
      icon: '/icon',
      badge: '/icon',
    });

    // A reminder you cannot act on is only half a reminder: clicking brings the
    // workspace forward and lands on the page the reminder is about.
    notification.onclick = () => {
      try {
        window.focus();
        if (options.url && window.location.pathname !== options.url) {
          window.location.href = options.url;
        }
      } catch {
        // Focus can be refused; the notification still closes below.
      }
      notification.close();
    };

    return true;
  } catch {
    // Some browsers throw when the page is not visible or the API is disabled.
    return false;
  }
}

/**
 * Remembers that a given notification already fired, keyed per day.
 *
 * Without this, every reload of the workspace would re-announce the same
 * events. `localStorage` is the right store: it is per-device, which is exactly
 * the scope of a device notification.
 */
const SEEN_PREFIX = 'layora-notified-';

export function alreadyNotified(key: string, day: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${SEEN_PREFIX}${day}-${key}`) === '1';
  } catch {
    return false;
  }
}

export function markNotified(key: string, day: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SEEN_PREFIX}${day}-${key}`, '1');
  } catch {
    // A full or disabled storage is not worth failing a reminder over.
  }
}

/**
 * Drops the bookkeeping for every day other than today.
 *
 * Called when the workspace opens, so the keys cannot accumulate one row per
 * notification per day for the life of the browser profile.
 */
export function pruneNotificationMarks(today: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(SEEN_PREFIX) && !key.startsWith(`${SEEN_PREFIX}${today}-`)) {
        stale.push(key);
      }
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing here is worth interrupting the page for.
  }
}

/** 'HH:MM' to minutes past midnight, or null when it is not a time. */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Whether a reminder set for `time` is due at `now`, within a short window.
 *
 * Useful when a late reminder would be noise — a timetable block that already
 * started, say. For anything that should still be delivered late, use
 * `hasReminderTimePassed`.
 */
export function isReminderDue(time: string | null | undefined, now: Date, windowMinutes = 5): boolean {
  const target = timeToMinutes(time);
  if (target === null) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  return current >= target && current < target + windowMinutes;
}

/**
 * Whether a reminder set for `time` is due at any point later today.
 *
 * A browser can only announce something while the site is actually open, so a
 * narrow window around the set time means a reminder is simply lost whenever
 * the student happens not to be looking — which is exactly what happened with
 * course reminders. Pairing this with the once-per-day mark means the reminder
 * is delivered the first time the workspace is open at or after its time, and
 * exactly once.
 */
export function hasReminderTimePassed(time: string | null | undefined, now: Date): boolean {
  const target = timeToMinutes(time);
  if (target === null) return false;

  return now.getHours() * 60 + now.getMinutes() >= target;
}

/* ────────────────────────────────────────────────────────────────
   In-app toasts

   An OS notification only appears once the student has granted the browser
   permission, and most never do. Everything announced here therefore goes to
   two places: the operating system when it is allowed, and an in-app toast
   which always works. `announce` is the single entry point, so no caller has
   to remember to do both.
   ──────────────────────────────────────────────────────────────── */

export type ToastKind = 'event' | 'block' | 'course';

export interface Toast {
  id: string;
  title: string;
  body?: string;
  kind: ToastKind;
  /** Where clicking the toast goes. */
  url: string;
}

/** The page each kind of reminder is about. */
export const KIND_DESTINATION: Record<ToastKind, string> = {
  event: '/dashboard/events/',
  block: '/dashboard/planner/',
  course: '/dashboard/courses/',
};

type ToastListener = (toast: Toast) => void;

const toastListeners = new Set<ToastListener>();

/** Subscribes to toasts. Returns an unsubscribe function. */
export function onToast(listener: ToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export interface Announcement {
  title: string;
  body?: string;
  /** Collapses repeats in the OS notification centre. */
  tag?: string;
  kind?: ToastKind;
  /** Overrides the page a click opens; defaults to the one for `kind`. */
  url?: string;
}

/**
 * Announces one thing on every channel available.
 *
 * Always shows the in-app toast; additionally raises an OS notification when
 * the browser has granted permission. Returns true if the OS one went out, so
 * callers can tell the two apart when they care.
 */
export function announce({ title, body, tag, kind = 'event', url }: Announcement): boolean {
  const destination = url || KIND_DESTINATION[kind];

  const toast: Toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    kind,
    url: destination,
  };
  toastListeners.forEach((listener) => listener(toast));

  return notify(title, { body, tag, url: destination });
}

/** Just enough of an event for the agenda line. */
export interface AgendaEntry {
  title: string;
  isStaff?: boolean;
}

/**
 * The "what's on today" announcement, including the empty case.
 *
 * An empty day still gets an announcement: silence is ambiguous — it reads
 * equally as "nothing scheduled" and "reminders are broken" — and the whole
 * point of announcing on every open is that the student knows where they stand.
 */
export function agendaAnnouncement(entries: AgendaEntry[]): { title: string; body: string } {
  if (entries.length === 0) {
    return { title: 'Nothing on today', body: 'No events on your calendar for today.' };
  }

  return {
    title: entries.length === 1 ? 'You have an event today' : `${entries.length} events today`,
    body: entries.map((e) => `${e.title}${e.isStaff ? ' (department)' : ''}`).join(' · '),
  };
}

/** The shape the agent needs from a course to decide about its reminder. */
export interface CourseReminderInput {
  id: string;
  name: string;
  platform?: string;
  progress?: number;
  reminderEnabled?: boolean;
  reminderTime?: string;
}

/** Matches the fallback the course card displays when no time was ever saved. */
export const DEFAULT_COURSE_REMINDER_TIME = '09:00';

export interface DueReminder {
  key: string;
  title: string;
  body: string;
}

/**
 * Which course reminders should be announced right now.
 *
 * Pulled out of the component so the decision can be tested directly — this
 * logic has been wrong twice, and reasoning about it inside an effect was how
 * both bugs survived.
 *
 * `isMarked` reports whether a key has already been announced today.
 */
export function dueCourseReminders(
  courses: CourseReminderInput[],
  now: Date,
  isMarked: (key: string) => boolean
): DueReminder[] {
  const due: DueReminder[] = [];

  for (const course of courses || []) {
    if (!course.reminderEnabled) continue;

    const time = course.reminderTime || DEFAULT_COURSE_REMINDER_TIME;
    if (!hasReminderTimePassed(time, now)) continue;

    const key = `course-${course.id}`;
    if (isMarked(key)) continue;

    const where = course.platform ? ` on ${course.platform}` : '';
    const progress = `${course.progress || 0}% done`;

    due.push({
      key,
      title: `Course: ${course.name}`,
      body: isReminderDue(time, now)
        ? `Time for your session${where} · ${progress}`
        : `Your ${time} session is still waiting${where} · ${progress}`,
    });
  }

  return due;
}

/**
 * Forgets every "already announced" mark for today.
 *
 * Reminders fire once a day by design, which makes them awkward to test: once
 * one has gone out there is no way to see it again until tomorrow. The test
 * button in Settings calls this first so a real reminder can fire again.
 */
export function clearTodaysNotificationMarks(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(SEEN_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing here is worth interrupting the page for.
  }
}

/**
 * Forgets the mark for one key, so that reminder can fire again today.
 *
 * Editing a reminder's time is a statement that it should happen at the new
 * time — but the once-per-day mark would suppress it if the old time had
 * already passed. Clearing the mark on edit is what makes a newly-set time
 * take effect straight away rather than tomorrow.
 */
export function clearNotificationMark(key: string, day: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${SEEN_PREFIX}${day}-${key}`);
  } catch {
    // Nothing here is worth interrupting the page for.
  }
}
