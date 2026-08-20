'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Clock, BookMarked, X } from 'lucide-react';
import { onToast, type Toast, type ToastKind } from '@/lib/notifications';

/** How long a toast stays before it leaves on its own. */
const LIFETIME_MS = 20_000;

const ICONS: Record<ToastKind, typeof CalendarDays> = {
  event: CalendarDays,
  block: Clock,
  course: BookMarked,
};

/**
 * The in-app half of a reminder.
 *
 * An OS notification only appears if the student granted the browser
 * permission, which most never do — so everything announced also lands here,
 * where nothing can suppress it. Slides in from the top right, sits for twenty
 * seconds, and slides back out when it expires or is closed.
 *
 * Deliberately opaque: a translucent panel over a busy workspace made the text
 * unreadable, so this paints a solid surface rather than frosted glass.
 */
export default function NotificationCenter() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    // Subscribing is not a state update, so nothing renders twice here.
    const unsubscribe = onToast((toast) => {
      // Newest on top, and never more than a screenful.
      setToasts((current) => [toast, ...current].slice(0, 4));
      setTimeout(() => dismiss(toast.id), LIFETIME_MS);
    });
    return unsubscribe;
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-5 z-[70] flex flex-col gap-2.5 w-[min(21rem,calc(100vw-2.5rem))] pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind] || CalendarDays;
          return (
            <motion.aside
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 380 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 380 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              role="status"
              aria-live="polite"
              className="layora-toast pointer-events-auto rounded-2xl border border-outline-variant shadow-2xl overflow-hidden"
            >
              {/* The whole card is the target — a reminder you cannot act on is
                  only half a reminder. The close button stops the click below. */}
              <div
                role="link"
                tabIndex={0}
                onClick={() => { router.push(toast.url); dismiss(toast.id); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(toast.url);
                    dismiss(toast.id);
                  }
                }}
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/5 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-on-surface break-words">{toast.title}</p>
                  {toast.body && (
                    <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed break-words">
                      {toast.body}
                    </p>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
                  aria-label="Dismiss this reminder"
                  className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-white/10 transition cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.aside>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
