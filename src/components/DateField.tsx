'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { parseTypedDate } from '@/lib/dateFormat';

interface Props {
  /** ISO 'YYYY-MM-DD', the format everything stores. */
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  className?: string;
  min?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** ISO to what the student reads. */
function toDisplay(iso: string): string {
  if (!ISO.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * A date field that actually reads dd/mm/yyyy.
 *
 * `<input type="date">` renders in the *browser's* locale and ignores the
 * `lang` attribute in Chrome, so a student with a US profile sees mm/dd/yyyy
 * however the page is marked up. This shows a plain text field in dd/mm/yyyy —
 * which is also typable — and keeps a hidden native input purely to open the
 * platform date picker, so nothing is lost by not using it directly.
 */
export default function DateField({ value, onChange, id, className = '', min }: Props) {
  const [text, setText] = useState(() => toDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Follow the value when something else changes it (opening an edit modal).
  // Deferred by a tick so nothing is set synchronously during the effect.
  useEffect(() => {
    const id = setTimeout(() => setText(toDisplay(value)), 0);
    return () => clearTimeout(id);
  }, [value]);

  const commit = (raw: string) => {
    const iso = parseTypedDate(raw);
    if (iso) {
      setInvalid(false);
      onChange(iso);
    } else {
      setInvalid(raw.trim() !== '');
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    // showPicker is the supported way in; clicking is the old fallback.
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* fall through */ }
    }
    el.click();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
        onBlur={(e) => commit(e.target.value)}
        aria-invalid={invalid}
        className={`w-full bg-surface-container border rounded-lg pl-2.5 pr-9 py-1.5 text-xs text-on-surface focus:outline-none ${
          invalid ? 'border-red-500 focus:border-red-500' : 'border-outline-variant focus:border-primary'
        }`}
      />

      <button
        type="button"
        onClick={openPicker}
        aria-label="Open the date picker"
        title="Pick a date"
        className="absolute right-1.5 p-1.5 rounded-md text-outline hover:text-primary hover:bg-white/5 transition cursor-pointer"
      >
        <CalendarDays className="w-3.5 h-3.5" />
      </button>

      {/* Present only to summon the platform picker. */}
      <input
        ref={pickerRef}
        type="date"
        value={ISO.test(value) ? value : ''}
        min={min}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        className="absolute right-2 w-0 h-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}
