'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

interface Props {
  /** Describes what the panel explains, for screen readers. */
  label: string;
  children: ReactNode;
  /** Which edge the panel hangs from. Defaults to the right. */
  align?: 'left' | 'right';
  /** Panel width, as a Tailwind class. */
  widthClass?: string;
}

/**
 * The ⓘ button and the panel it opens.
 *
 * Shared rather than repeated per card so every one of them behaves the same
 * way: clicking anywhere else on the page closes it, as does Escape. Requiring
 * a second click on the ⓘ itself is the behaviour people least expect from a
 * popover — they click away and assume it has gone.
 *
 * Uses `pointerdown` rather than `click` so the panel is already gone by the
 * time whatever was clicked underneath reacts.
 */
export default function InfoPopover({ label, children, align = 'right', widthClass = 'w-72' }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`transition p-0.5 focus:outline-none cursor-pointer ${
          open ? 'text-primary' : 'text-outline hover:text-primary'
        }`}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} ${widthClass} bg-surface-container-high border border-outline-variant rounded-xl shadow-lg z-30 p-3.5`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
