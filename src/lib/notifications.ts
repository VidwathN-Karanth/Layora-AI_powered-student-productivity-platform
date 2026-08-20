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
}

/**
 * Shows one notification. Returns false when nothing was shown, so callers can
 * decide whether to fall back to something on-screen.
 */
export function notify(title: string, options: NotifyOptions = {}): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;

  try {
    new Notification(title, {
      body: options.body,
      tag: options.tag,
      silent: options.silent,
      icon: '/icon',
      badge: '/icon',
    });
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
 * Whether a reminder set for `time` is due at `now`.
 *
 * The window matters: a reminder is checked on a timer, so an exact equality
 * test would miss it whenever a tick lands either side of the minute. Firing
 * for a few minutes after the time, combined with the once-per-day mark above,
 * means it arrives once and is not missed.
 */
export function isReminderDue(time: string | null | undefined, now: Date, windowMinutes = 5): boolean {
  const target = timeToMinutes(time);
  if (target === null) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  return current >= target && current < target + windowMinutes;
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
}

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
}

/**
 * Announces one thing on every channel available.
 *
 * Always shows the in-app toast; additionally raises an OS notification when
 * the browser has granted permission. Returns true if the OS one went out, so
 * callers can tell the two apart when they care.
 */
export function announce({ title, body, tag, kind = 'event' }: Announcement): boolean {
  const toast: Toast = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    kind,
  };
  toastListeners.forEach((listener) => listener(toast));

  return notify(title, { body, tag });
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
