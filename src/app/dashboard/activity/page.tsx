'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  ChevronLeft, ChevronRight, Timer, CheckSquare, CalendarRange, Flame,
  TrendingUp, TrendingDown, Minus, Terminal, GitBranch, Award,
} from 'lucide-react';

import { useStore } from '@/store/useStore';
import { apiFetch } from '@/lib/apiClient';
import { formatLongDate } from '@/lib/dateFormat';
import { dayKey } from '@/lib/pomodoro';
import {
  buildWeek, weeklyTrend, subjectBreakdown, changePercent, totalsFor,
  formatMinutes, formatWeekLabel, type WeekSummary,
} from '@/lib/activityReport';

/* ────────────────────────────────────────────────────────────────
   Your week, from what you actually did.

   Every number on this page comes from this student's own logs —
   the focus sessions the Zen timer wrote, the tasks and blocks
   ticked off, and the coding activity synced overnight. Nothing is
   estimated and nothing is borrowed from anyone else's account.
   ──────────────────────────────────────────────────────────────── */

interface RangeStats { commits: number; solves: number; points: number }
interface CodingStats {
  today: RangeStats;
  week: RangeStats;
  month: RangeStats;
  allTime: RangeStats;
}

interface Certificate { id: string; name: string; created_at: string }

/** A metric card's delta: which way, by how much, against what. */
function Delta({ value, against }: { value: number | null; against: string }) {
  if (value === null) {
    return <span className="text-[10px] font-mono text-outline">nothing to compare</span>;
  }
  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono text-outline">
        <Minus className="w-3 h-3" /> same as {against}
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-mono ${up ? 'text-emerald-400' : 'text-amber-400'}`}>
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}{value}% vs {against}
    </span>
  );
}

function Metric({
  icon: Icon, label, value, sub, delta, against,
}: {
  icon: typeof Timer; label: string; value: string; sub?: string;
  delta?: number | null; against?: string;
}) {
  return (
    <div className="glass-card rounded-2xl border border-outline-variant p-5">
      <div className="flex items-center gap-2 text-outline">
        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-on-surface">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] font-mono text-on-surface-variant">{sub}</div>}
      {delta !== undefined && (
        <div className="mt-3"><Delta value={delta} against={against || 'last week'} /></div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const store = useStore();
  const { user: clerkUser } = useUser();

  const [weeksAgo, setWeeksAgo] = useState(0);
  const [coding, setCoding] = useState<CodingStats | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // `today` is captured once per render pass so every panel on the page agrees
  // on where the week boundary is, even across a midnight tick.
  const today = useMemo(() => new Date(), []);
  const todayKey = dayKey(today);

  const week: WeekSummary = useMemo(
    () => buildWeek(weeksAgo, store.pomodoroLog, store.activityLog, today),
    [weeksAgo, store.pomodoroLog, store.activityLog, today]
  );
  const previous: WeekSummary = useMemo(
    () => buildWeek(weeksAgo + 1, store.pomodoroLog, store.activityLog, today),
    [weeksAgo, store.pomodoroLog, store.activityLog, today]
  );
  const trend = useMemo(
    () => weeklyTrend(8, store.pomodoroLog, store.activityLog, today),
    [store.pomodoroLog, store.activityLog, today]
  );
  const subjects = useMemo(
    () => subjectBreakdown(week.range, store.activityLog),
    [week.range, store.activityLog]
  );

  const todayPoint = week.series.find((d) => d.date === todayKey) || null;
  const isThisWeek = weeksAgo === 0;

  /**
   * Comparing a half-finished week against a whole one makes every number look
   * like a decline, which is both useless and discouraging. So the current week
   * is measured against the same stretch of the previous one — Monday to today.
   */
  const elapsedDays = week.series.filter((d) => d.elapsed).length;
  const baseline = useMemo(
    () => (isThisWeek && elapsedDays < 7 ? totalsFor(previous.series.slice(0, elapsedDays)) : previous.totals),
    [isThisWeek, elapsedDays, previous]
  );
  const against = isThisWeek && elapsedDays < 7 ? 'the same point last week' : 'last week';

  useEffect(() => {
    const userId = clerkUser?.id;
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch(`/api/users/${userId}/activity-stats`);
        if (res.ok && !cancelled) setCoding(await res.json());
      } catch {
        // The coding panel simply stays quiet; the rest of the page is local.
      }
    })();

    (async () => {
      try {
        const res = await apiFetch('/api/user/certificates');
        if (res.ok && !cancelled) setCertificates(await res.json());
      } catch {
        /* same — an optional panel */
      }
    })();

    return () => { cancelled = true; };
  }, [clerkUser?.id]);

  const certificatesThisWeek = certificates.filter((c) => {
    const key = (c.created_at || '').slice(0, 10);
    return key >= week.range.start && key <= week.range.end;
  }).length;

  const peakMinutes = Math.max(60, ...week.series.map((d) => d.focusMinutes));
  const trendPeak = Math.max(60, ...trend.map((w) => w.totals.focusMinutes));

  const openThisWeek = store.tasks.filter(
    (t) => t.status !== 'completed' && t.deadline >= week.range.start && t.deadline <= week.range.end
  );

  return (
    <div className="space-y-6">
      {/* ── Header: which week, and how to move between them ── */}
      <div className="border-b border-outline-variant pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">📈 Activity</h2>
          <p className="text-xs text-outline font-mono mt-0.5">
            {isThisWeek ? 'This week' : `${week.range.weeksAgo} week${week.range.weeksAgo > 1 ? 's' : ''} ago`}
            {' · '}{formatWeekLabel(week.range)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeeksAgo((w) => Math.min(w + 1, 15))}
            aria-label="Previous week"
            className="p-2 rounded-lg border border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeeksAgo(0)}
            disabled={isThisWeek}
            className="px-3 py-1.5 rounded-lg border border-outline-variant text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant hover:border-primary hover:text-primary transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            This week
          </button>
          <button
            onClick={() => setWeeksAgo((w) => Math.max(0, w - 1))}
            disabled={isThisWeek}
            aria-label="Next week"
            className="p-2 rounded-lg border border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Today, when looking at the current week ── */}
      {isThisWeek && todayPoint && (
        <div className="glass-card rounded-2xl border border-outline-variant p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <div className="shrink-0">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Today</div>
            <div className="text-xs font-mono text-outline mt-0.5">{formatLongDate(today)}</div>
          </div>
          {todayPoint.focusMinutes === 0 && todayPoint.tasksCompleted === 0 && todayPoint.blocksCompleted === 0 ? (
            <p className="text-xs text-outline font-mono">
              Nothing recorded yet today — start a Zen session or tick a task off.
            </p>
          ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <span className="font-mono">
              <b className="text-on-surface">{formatMinutes(todayPoint.focusMinutes)}</b>
              <span className="text-outline"> focused</span>
            </span>
            <span className="font-mono">
              <b className="text-on-surface">{todayPoint.sessions}</b>
              <span className="text-outline"> Zen session{todayPoint.sessions === 1 ? '' : 's'}</span>
            </span>
            <span className="font-mono">
              <b className="text-on-surface">{todayPoint.tasksCompleted}</b>
              <span className="text-outline"> task{todayPoint.tasksCompleted === 1 ? '' : 's'} done</span>
            </span>
            <span className="font-mono">
              <b className="text-on-surface">{todayPoint.blocksCompleted}</b>
              <span className="text-outline"> block{todayPoint.blocksCompleted === 1 ? '' : 's'} ticked</span>
            </span>
          </div>
          )}
        </div>
      )}

      {/* ── The week in five numbers ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric
          icon={Timer}
          label="Focus time"
          value={formatMinutes(week.totals.focusMinutes)}
          sub={`${week.totals.sessions} session${week.totals.sessions === 1 ? '' : 's'} in Zen mode`}
          delta={changePercent(week.totals.focusMinutes, baseline.focusMinutes)}
          against={against}
        />
        <Metric
          icon={CheckSquare}
          label="Tasks done"
          value={String(week.totals.tasksCompleted)}
          sub={week.totals.taskMinutes > 0 ? `${formatMinutes(week.totals.taskMinutes)} logged against them` : 'No time logged yet'}
          delta={changePercent(week.totals.tasksCompleted, baseline.tasksCompleted)}
          against={against}
        />
        <Metric
          icon={CalendarRange}
          label="Blocks ticked"
          value={String(week.totals.blocksCompleted)}
          sub="From your weekly planner"
          delta={changePercent(week.totals.blocksCompleted, baseline.blocksCompleted)}
          against={against}
        />
        <Metric
          icon={Flame}
          label="Active days"
          value={`${week.totals.activeDays}/7`}
          sub={
            week.totals.bestDay
              ? `Best: ${week.totals.bestDay.weekday}, ${formatMinutes(week.totals.bestDay.focusMinutes)}`
              : 'Nothing recorded yet'
          }
          delta={changePercent(week.totals.activeDays, baseline.activeDays)}
          against={against}
        />
        <Metric
          icon={Award}
          label="Streak"
          value={`${store.user?.streakCount ?? 0}d`}
          sub={
            week.totals.averageSessionMinutes
              ? `Avg session ${week.totals.averageSessionMinutes}m`
              : 'Start a Zen session to build it'
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Day by day ── */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-outline-variant p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
              Day by day
            </h3>
            <span className="text-[10px] font-mono text-outline">focus minutes · tasks</span>
          </div>

          <div className="mt-6 flex items-end justify-between gap-2 sm:gap-4 h-44">
            {week.series.map((d) => {
              const height = d.focusMinutes > 0 ? Math.max(6, (d.focusMinutes / peakMinutes) * 100) : 0;
              const isToday = d.date === todayKey;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {d.focusMinutes > 0 ? formatMinutes(d.focusMinutes) : ''}
                  </span>
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      title={`${d.weekday}: ${formatMinutes(d.focusMinutes)}, ${d.tasksCompleted} task(s)`}
                      style={{ height: `${height}%` }}
                      className={`w-full max-w-[42px] rounded-t-lg transition-all ${
                        d.focusMinutes > 0
                          ? isToday ? 'bg-primary' : 'bg-primary/45'
                          : d.elapsed ? 'bg-outline-variant/40 h-[2px]' : 'bg-transparent'
                      }`}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-[10px] font-mono font-bold ${isToday ? 'text-primary' : 'text-outline'}`}>
                      {d.weekday}
                    </span>
                    <span className="flex gap-0.5 h-2" aria-label={`${d.tasksCompleted} tasks completed`}>
                      {Array.from({ length: Math.min(d.tasksCompleted, 5) }).map((_, i) => (
                        <span key={i} className="w-1 h-1 rounded-full bg-emerald-400" />
                      ))}
                      {d.tasksCompleted > 5 && (
                        <span className="text-[8px] font-mono text-emerald-400 leading-none">+{d.tasksCompleted - 5}</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Where the time went ── */}
        <div className="glass-card rounded-2xl border border-outline-variant p-5">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
            Where the time went
          </h3>

          {subjects.length === 0 ? (
            <p className="mt-6 text-xs text-outline leading-relaxed">
              No time logged against a subject this week. Start a task timer and the split appears here.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {subjects.slice(0, 6).map((s) => (
                <div key={s.subject}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-semibold text-on-surface truncate">{s.subject}</span>
                    <span className="font-mono text-outline shrink-0">{formatMinutes(s.minutes)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Eight weeks of focus ── */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-outline-variant p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
              Last 8 weeks
            </h3>
            <span className="text-[10px] font-mono text-outline">focus time per week</span>
          </div>

          <div className="mt-6 flex items-end justify-between gap-2 sm:gap-3 h-32">
            {trend.map((w) => {
              const height = w.totals.focusMinutes > 0 ? Math.max(6, (w.totals.focusMinutes / trendPeak) * 100) : 0;
              const selected = w.range.weeksAgo === weeksAgo;
              return (
                <button
                  key={w.range.start}
                  onClick={() => setWeeksAgo(w.range.weeksAgo)}
                  title={`${formatWeekLabel(w.range)} — ${formatMinutes(w.totals.focusMinutes)}`}
                  className="flex-1 flex flex-col items-center justify-end gap-2 h-full cursor-pointer group"
                >
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      style={{ height: `${height}%` }}
                      className={`w-full max-w-[36px] rounded-t-md transition-all ${
                        selected ? 'bg-primary' : 'bg-primary/30 group-hover:bg-primary/60'
                      } ${height === 0 ? 'h-[2px] bg-outline-variant/40' : ''}`}
                    />
                  </div>
                  <span className={`text-[9px] font-mono ${selected ? 'text-primary font-bold' : 'text-outline'}`}>
                    {w.range.weeksAgo === 0 ? 'now' : `-${w.range.weeksAgo}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Coding, from the nightly sync ── */}
        <div className="glass-card rounded-2xl border border-outline-variant p-5">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
            Coding this week
          </h3>

          {!coding ? (
            <p className="mt-6 text-xs text-outline leading-relaxed">
              Connect LeetCode, GitHub or CodeChef in Settings and the nightly sync fills this in.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <Terminal className="w-3.5 h-3.5 text-primary" /> Problems solved
                </span>
                <b className="font-mono text-on-surface">{coding.week.solves}</b>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <GitBranch className="w-3.5 h-3.5 text-primary" /> Contributions
                </span>
                <b className="font-mono text-on-surface">{coding.week.commits}</b>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-outline-variant pt-4">
                <span className="text-on-surface-variant">Points earned</span>
                <b className="font-mono text-primary">{coding.week.points} pts</b>
              </div>
              {certificatesThisWeek > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">Certificates added</span>
                  <b className="font-mono text-on-surface">{certificatesThisWeek}</b>
                </div>
              )}
              <p className="text-[10px] font-mono text-outline leading-relaxed pt-1">
                Synced nightly at 10 PM IST from your public profiles.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── What is still open, when the week is the current one ── */}
      {isThisWeek && openThisWeek.length > 0 && (
        <div className="glass-card rounded-2xl border border-outline-variant p-5">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
            Still open this week
          </h3>
          <ul className="mt-4 divide-y divide-outline-variant/40">
            {openThisWeek.slice(0, 6).map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-on-surface truncate">{t.title}</div>
                  <div className="font-mono text-outline text-[10px] mt-0.5">{t.subjectName}</div>
                </div>
                <span className="font-mono text-outline shrink-0">
                  {t.actualMinutesSpent > 0
                    ? `${formatMinutes(t.actualMinutesSpent)} of ${formatMinutes(t.estimatedMinutes)}`
                    : formatMinutes(t.estimatedMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── The honest footnote ── */}
      <p className="text-[10px] font-mono text-outline leading-relaxed">
        Everything here is yours alone — nobody else sees it, and it is built from your own focus
        sessions, tasks and blocks. History is kept for the last four months.
      </p>
    </div>
  );
}
