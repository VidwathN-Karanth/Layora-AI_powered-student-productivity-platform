'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, X, Users, User as UserIcon } from 'lucide-react';
import { apiFetch, readJson } from '@/lib/apiClient';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  audience: string;
  isStaff: boolean;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dismissed state is per-day, so the reminder returns tomorrow but not today. */
const dismissKey = (day: string) => `layora-events-dismissed-${day}`;

/**
 * A quiet reminder of what is on today, shown once per day when the workspace
 * is opened. Slides in from the right; dismissing it keeps it gone until
 * tomorrow.
 */
export default function TodayEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const day = todayKey();

    if (typeof window !== 'undefined' && window.localStorage.getItem(dismissKey(day))) {
      return;
    }

    (async () => {
      try {
        const data = await readJson<{ events: CalendarEvent[] }>(await apiFetch('/api/events'));
        if (cancelled) return;

        const todays = (data.events || []).filter((e) => e.eventDate === day);
        if (todays.length === 0) return;

        setEvents(todays);
        // Let the workspace paint first so the toast reads as an arrival.
        setTimeout(() => { if (!cancelled) setVisible(true); }, 900);
      } catch {
        // A reminder is not worth surfacing an error for.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(dismissKey(todayKey()), '1');
    } catch {
      // Private mode or blocked storage — it just reappears next load.
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          role="status"
          aria-live="polite"
          className="fixed top-20 right-5 z-[60] w-[min(21rem,calc(100vw-2.5rem))] glass-panel border border-primary/25 rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-start gap-3 p-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-on-surface">
                {events.length === 1 ? 'You have an event today' : `${events.length} events today`}
              </p>

              <ul className="mt-2 space-y-2">
                {events.slice(0, 3).map((e) => (
                  <li key={e.id} className="min-w-0">
                    <p className="text-[11px] font-semibold text-on-surface truncate">{e.title}</p>
                    <span className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-wider text-outline">
                      {e.isStaff ? <Users className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                      {e.isStaff ? 'Department' : 'Personal'}
                    </span>
                  </li>
                ))}
              </ul>

              {events.length > 3 && (
                <p className="mt-2 text-[9px] font-mono text-outline">
                  +{events.length - 3} more on your calendar
                </p>
              )}
            </div>

            <button
              onClick={dismiss}
              aria-label="Dismiss today's events"
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
