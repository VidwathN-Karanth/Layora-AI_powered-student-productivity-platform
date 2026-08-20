'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Trash, Users, User as UserIcon, Loader2, Repeat,
  RefreshCw, Check,
} from 'lucide-react';
import { apiFetch, readJson, errorMessage } from '@/lib/apiClient';
import { formatLongDate, formatMonthLabel } from '@/lib/dateFormat';
import {
  REPEAT_RULES, REPEAT_LABEL, expandByDate, type RepeatRule,
} from '@/lib/recurrence';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  /** The first occurrence. Repeats are expanded on the client, not stored. */
  eventDate: string;
  repeat?: RepeatRule | null;
  repeatUntil?: string | null;
  audience: string;
  createdBy: string;
  creatorName: string | null;
  isStaff: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Local calendar date as YYYY-MM-DD. Avoids the UTC shift toISOString causes. */
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The 6x7 grid for a month, Monday-first, padded with neighbouring days. */
function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // shift Sunday=0 to Monday=0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function EventsPage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<string>(todayKey);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repeat, setRepeat] = useState<RepeatRule>('none');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readJson<{ events: CalendarEvent[] }>(await apiFetch('/api/events'));
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load your calendar.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const grid = useMemo(() => buildGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  // One stored row can occupy many cells: a weekly seminar shows on all of its
  // Tuesdays without a row per week existing anywhere.
  const byDate = useMemo(
    () => expandByDate(events, toKey(grid[0]), toKey(grid[grid.length - 1])),
    [events, grid]
  );

  // The selected day can sit outside the drawn month, so expand it on its own.
  const selectedEvents = useMemo(
    () => expandByDate(events, selected, selected).get(selected) || [],
    [events, selected]
  );

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const data = await readJson<{ event: CalendarEvent }>(
        await apiFetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            eventDate: selected,
            repeat,
            repeatUntil: repeat === 'none' ? null : repeatUntil || null,
          }),
        })
      );
      setEvents((prev) => [...prev, data.event]);
      setTitle('');
      setDescription('');
      setRepeat('none');
      setRepeatUntil('');
      setShowForm(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not add the event.'));
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (event: CalendarEvent) => {
    // Deleting a series is not the same as deleting one day of it, so say which.
    const repeating = !!event.repeat && event.repeat !== 'none';
    const question = repeating
      ? `"${event.title}" repeats. Removing it deletes every occurrence, not just this day. Continue?`
      : 'Remove this event from your calendar?';
    if (!confirm(question)) return;
    const id = event.id;
    setError('');
    try {
      await readJson(await apiFetch(`/api/events?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(errorMessage(err, 'Could not remove the event.'));
    }
  };

  /** Pushes everything on this calendar into the student's own Google Calendar. */
  const syncToGoogle = async () => {
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const data = await readJson<{ syncedCount: number; skipped: number }>(
        await apiFetch('/api/calendar/events', { method: 'POST' })
      );
      setSyncMessage(
        data.syncedCount === 0
          ? 'Nothing to sync — there are no upcoming events.'
          : `Added ${data.syncedCount} event${data.syncedCount === 1 ? '' : 's'} to your Google Calendar.` +
            (data.skipped ? ` ${data.skipped} could not be added.` : '')
      );
      setTimeout(() => setSyncMessage(''), 6000);
    } catch (err) {
      setError(errorMessage(err, 'Could not sync to Google Calendar.'));
    } finally {
      setSyncing(false);
    }
  };

  const monthLabel = formatMonthLabel(cursor);
  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="space-y-6">
      <div className="border-b border-outline-variant pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Events
          </h2>
          <p className="text-xs text-outline font-mono mt-0.5">
            Your own reminders, plus anything the department has scheduled for you.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => { setSelected(todayKey); setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); }}
            className="px-3.5 py-2 rounded-xl border border-outline-variant bg-white/3 hover:border-primary text-xs font-mono text-outline hover:text-on-surface transition cursor-pointer"
          >
            Today
          </button>
          {/* Copies these entries into the student's own Google Calendar, which
              is what makes them show up in the Google Calendar app on a phone. */}
          <button
            onClick={syncToGoogle}
            disabled={syncing || events.length === 0}
            title="Add these events to your own Google Calendar"
            className="px-3.5 py-2 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs font-mono font-bold text-primary transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncing
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
              : <><CalendarDays className="w-3.5 h-3.5" /> Sync to Google Calendar</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/25 text-red-300 text-xs font-mono">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono flex items-center gap-2">
          <Check className="w-3.5 h-3.5 shrink-0" /> {syncMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---- Month grid ---- */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-outline-variant overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <span className="text-sm font-bold text-on-surface">{monthLabel}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="p-1.5 rounded-lg border border-outline-variant hover:border-primary text-outline hover:text-primary transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="p-1.5 rounded-lg border border-outline-variant hover:border-primary text-outline hover:text-primary transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center gap-2 text-xs font-mono text-outline">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading calendar...
            </div>
          ) : (
            <div className="p-3">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[9px] font-mono font-bold uppercase tracking-wider text-outline py-1.5">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {grid.map((day) => {
                  const key = toKey(day);
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const dayEvents = byDate.get(key) || [];
                  const isToday = key === todayKey;
                  const isSelected = key === selected;

                  return (
                    <button
                      key={key}
                      onClick={() => { setSelected(key); setShowForm(false); }}
                      /* Every cell carries its own surface, in both themes —
                         dark mode used to leave the grid as bare text on the
                         page with no day boxes at all. */
                      className={`min-h-[54px] sm:min-h-[84px] rounded-lg p-1 sm:p-1.5 flex flex-col items-stretch gap-1 border text-left transition cursor-pointer overflow-hidden ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-white/20 bg-surface-container hover:border-white/40 hover:bg-surface-container-high'
                      } ${inMonth ? '' : 'opacity-45'}`}
                    >
                      <span
                        className={`text-[11px] font-mono px-0.5 ${
                          isToday
                            ? 'font-black text-primary'
                            : isSelected
                              ? 'font-bold text-on-surface'
                              : 'text-on-surface-variant'
                        }`}
                      >
                        {day.getDate()}
                      </span>

                      {/* A 375px phone gives each cell about 47px, which truncates
                          a title to roughly six characters — worse than useless.
                          Dots there, titles from sm up; the day panel below always
                          spells them out in full. */}
                      {dayEvents.length > 0 && (
                        <span className="flex sm:hidden items-center justify-center gap-0.5 mt-auto pb-0.5">
                          {dayEvents.slice(0, 3).map((e) => (
                            <span
                              key={e.id}
                              className={`w-1.5 h-1.5 rounded-full ${e.isStaff ? 'bg-amber-400' : 'bg-primary'}`}
                            />
                          ))}
                        </span>
                      )}

                      <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                        {dayEvents.slice(0, 2).map((e) => (
                          <span
                            key={e.id}
                            title={e.title}
                            className={`block truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight ${
                              e.isStaff
                                ? 'bg-amber-400/15 text-amber-500 border-l-2 border-amber-400'
                                : 'bg-primary/15 text-primary border-l-2 border-primary'
                            }`}
                          >
                            {e.title}
                          </span>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[8px] font-mono text-outline px-1">
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 px-1 pt-3 mt-1 border-t border-outline-variant/50">
                <span className="flex items-center gap-1.5 text-[9px] font-mono text-outline">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Your event
                </span>
                <span className="flex items-center gap-1.5 text-[9px] font-mono text-outline">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Department
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ---- Selected day ---- */}
        <div className="glass-card rounded-2xl border border-outline-variant p-5 space-y-4">
          <div className="border-b border-outline-variant pb-2">
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">
              {formatLongDate(selected)}
            </h3>
            <p className="text-[9px] font-mono text-outline mt-0.5">
              {selectedEvents.length === 0
                ? 'Nothing scheduled'
                : `${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="space-y-2.5">
            {selectedEvents.map((e) => (
              <div
                key={e.id}
                className={`p-3 rounded-xl border ${
                  e.isStaff
                    ? 'border-amber-500/25 bg-amber-950/15'
                    : 'border-outline-variant bg-white/3'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-on-surface break-words">{e.title}</p>
                    {e.description && (
                      <p className="text-[10px] text-outline mt-1 leading-relaxed break-words">{e.description}</p>
                    )}
                  </div>
                  {!e.isStaff && (
                    <button
                      onClick={() => removeEvent(e)}
                      aria-label="Remove event"
                      className="p-1 rounded text-outline hover:text-red-400 transition cursor-pointer shrink-0"
                    >
                      <Trash className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-wider text-outline">
                    {e.isStaff ? <Users className="w-2.5 h-2.5" /> : <UserIcon className="w-2.5 h-2.5" />}
                    {e.isStaff ? `Department · ${e.audience}` : 'Personal'}
                  </span>
                  {e.repeat && e.repeat !== 'none' && (
                    <span className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-wider text-primary">
                      <Repeat className="w-2.5 h-2.5" />
                      {REPEAT_LABEL[e.repeat]}
                      {e.repeatUntil ? ` until ${e.repeatUntil}` : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showForm ? (
            <form onSubmit={addEvent} className="space-y-2.5 pt-1">
              <input
                autoFocus
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                placeholder="What is happening?"
                maxLength={120}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              <textarea
                value={description}
                onChange={(ev) => setDescription(ev.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                maxLength={500}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[9px] font-mono text-outline mb-1">Repeat</span>
                  <select
                    value={repeat}
                    onChange={(ev) => setRepeat(ev.target.value as RepeatRule)}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {REPEAT_RULES.map((r) => (
                      <option key={r} value={r}>{REPEAT_LABEL[r]}</option>
                    ))}
                  </select>
                </label>
                {repeat !== 'none' && (
                  <label className="block">
                    <span className="block text-[9px] font-mono text-outline mb-1">Until (optional)</span>
                    <input
                      type="date"
                      lang="en-GB"
                      value={repeatUntil}
                      min={selected}
                      onChange={(ev) => setRepeatUntil(ev.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-[11px] text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    />
                  </label>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="bg-primary hover:bg-primary/90 text-white rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false); setTitle(''); setDescription('');
                    setRepeat('none'); setRepeatUntil('');
                  }}
                  className="border border-outline-variant hover:border-outline text-outline hover:text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 border border-dashed border-outline-variant hover:border-primary text-outline hover:text-primary rounded-xl py-2.5 text-xs font-mono transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add an event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
