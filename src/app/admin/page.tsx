'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award, CalendarDays, ChevronRight, Download, ExternalLink, FileText, Globe,
  MoreVertical, Plus, RefreshCw, Trash2, Users,
} from 'lucide-react';

import { useStore } from '@/store/useStore';
import { apiFetch, apiJson, errorMessage, readJson } from '@/lib/apiClient';
import { formatDate, formatLongDate, toDateKey } from '@/lib/dateFormat';
import { occursOn, type RepeatRule } from '@/lib/recurrence';
import { useAdmin } from './AdminContext';
import { useSectionData } from './_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   The console's front page.

   Same shape as a student's dashboard — a greeting, a row of counts, what is
   on today, and the quick launchers — because staff open this the same way a
   student opens theirs: to see where things stand before deciding what to do.
   The counts are links; nothing here is a dead end.
   ──────────────────────────────────────────────────────────────── */

interface StaffEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  repeat?: RepeatRule | null;
  repeatUntil?: string | null;
  audience: string;
}

/** One page of the paged department sync. */
interface SyncPage {
  success?: boolean;
  error?: string;
  done?: boolean;
  nextOffset?: number;
  stats?: { successful?: number; failed?: number };
}

interface Counts {
  students: number | null;
  resumes: number | null;
  certificates: number | null;
  resources: number | null;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const { selectedCohort, adminName } = useAdmin();

  const [counts, setCounts] = useState<Counts>({
    students: null, resumes: null, certificates: null, resources: null,
  });
  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [syncResult, setSyncResult] = useState('');
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);

  const todayKey = toDateKey(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const cohortParam = `cohort=${encodeURIComponent(selectedCohort)}`;

    // Five requests at once, each settled on its own: one failing panel must
    // not blank the other four, and a rejection simply leaves that tile as "—".
    // apiJson rather than an awaited apiFetch — awaiting inside the array
    // literal would have run them one after another.
    const [students, resumes, certificates, resources, calendar] = await Promise.allSettled([
      apiJson<unknown[]>(`/api/admin/users?${cohortParam}`),
      apiJson<{ resumes?: unknown[] }>(`/api/admin/resumes?${cohortParam}`),
      apiJson<{ uploaders?: { count: number }[] }>(`/api/admin/certificates/overview?${cohortParam}`),
      apiJson<{ resources?: unknown[] }>(`/api/resources/global?${cohortParam}`),
      apiJson<{ events?: StaffEvent[] }>(`/api/admin/events?${cohortParam}`),
    ]);

    setCounts({
      students: students.status === 'fulfilled' ? (students.value || []).length : null,
      resumes: resumes.status === 'fulfilled' ? (resumes.value.resumes || []).length : null,
      certificates: certificates.status === 'fulfilled'
        ? (certificates.value.uploaders || []).reduce((sum, u) => sum + (u.count || 0), 0)
        : null,
      resources: resources.status === 'fulfilled' ? (resources.value.resources || []).length : null,
    });

    setEvents(calendar.status === 'fulfilled' ? calendar.value.events || [] : []);

    if (students.status === 'rejected') {
      setError(errorMessage(students.reason, 'Could not load this year’s students.'));
    }
    setLoading(false);
  }, [selectedCohort]);

  useSectionData(load);

  /**
   * Pulls fresh LeetCode, CodeChef and GitHub activity for every student.
   *
   * The route syncs one page per call and says where to resume, because the
   * whole department does not fit inside a single serverless request.
   */
  const handleSystemSync = async () => {
    setIsSyncing(true);
    setSyncResult('');
    setSyncProgress('');
    setError('');

    try {
      let offset: number | null = 0;
      let synced = 0;
      let failed = 0;
      // A ceiling so a server that never reports done cannot spin forever.
      const MAX_PAGES = 200;

      for (let page = 0; page < MAX_PAGES && offset !== null; page++) {
        // Annotated rather than inferred: `offset` is both written from this
        // result and read in the request body, and TypeScript reads that round
        // trip as a circular initializer without an explicit type here.
        const data: SyncPage = await readJson<SyncPage>(
          await apiFetch('/api/admin/sync-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offset }),
          })
        );

        if (!data.success) throw new Error(data.error || 'Failed to trigger the global sync.');

        synced += data.stats?.successful ?? 0;
        failed += data.stats?.failed ?? 0;
        offset = data.done ? null : (data.nextOffset ?? null);

        if (offset !== null) setSyncProgress(`Synced ${synced} student(s)… still going`);
      }

      if (offset !== null) throw new Error('Sync did not finish — stopped after too many batches.');

      setSyncResult(
        failed > 0
          ? `Sync complete. ${synced} synced, ${failed} failed.`
          : `Sync complete. ${synced} student${synced === 1 ? '' : 's'} updated.`
      );
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Failed to trigger the global activity sync.'));
    } finally {
      setSyncProgress('');
      setIsSyncing(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    setError('');
    try {
      const data = await readJson<Record<string, unknown>[]>(
        await apiFetch(`/api/admin/export-users?cohort=${encodeURIComponent(selectedCohort)}`)
      );

      const headers = [
        'Name', 'Email', 'LinkedIn URL', 'LeetCode URL', 'GitHub URL', 'CodeChef URL',
        'LeetCode Easy Solves', 'LeetCode Medium Solves', 'LeetCode Hard Solves',
        'LeetCode Total Solves', 'CodeChef Solves', 'GitHub Commits',
      ];

      // Spreadsheets treat a bare URL as text; HYPERLINK makes it clickable.
      const wrapLink = (url: string) => (url ? `=HYPERLINK("${url}", "${url}")` : '');
      const profileUrl = (handle: unknown, base: string) => {
        const value = typeof handle === 'string' ? handle.trim() : '';
        if (!value) return '';
        return value.startsWith('http') ? value : `${base}${value}`;
      };

      const rows = data.map((user) => {
        const num = (key: string) => Number(user[key]) || 0;
        return [
          user.name || '',
          user.email || '',
          wrapLink(typeof user.linkedinUrl === 'string' ? user.linkedinUrl : ''),
          wrapLink(profileUrl(user.leetcodeUsername, 'https://leetcode.com/u/')),
          wrapLink(profileUrl(user.githubUsername, 'https://github.com/')),
          wrapLink(profileUrl(user.codechefUsername, 'https://www.codechef.com/users/')),
          num('leetcodeEasyTotal'),
          num('leetcodeMediumTotal'),
          num('leetcodeHardTotal'),
          num('leetcodeEasyTotal') + num('leetcodeMediumTotal') + num('leetcodeHardTotal'),
          num('codechefSolvedTotal'),
          num('githubContributions'),
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
      });

      const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `layora_${selectedCohort.toLowerCase().replace(/\s+/g, '_')}_stats_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate the CSV export.'));
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const todays = events.filter((e) => occursOn(e, todayKey));
  const upcoming = events
    .filter((e) => e.eventDate > todayKey)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, 4);

  const tiles = [
    { label: 'Students', value: counts.students, unit: 'synced', icon: Users, accent: 'text-cyber-purple', path: '/admin/students' },
    { label: 'CVs uploaded', value: counts.resumes, unit: 'resumes', icon: FileText, accent: 'text-sky-400', path: '/admin/resumes' },
    { label: 'Certificates', value: counts.certificates, unit: 'uploaded', icon: Award, accent: 'text-amber-400', path: '/admin/certificates' },
    { label: 'Shared files', value: counts.resources, unit: 'in the library', icon: Globe, accent: 'text-emerald-400', path: '/admin/global-resources' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Welcome back, <span className="text-primary">{adminName}</span>
          </h1>
          <p className="text-xs font-mono text-white/40 mt-1">
            CSE Department · viewing {selectedCohort} · {formatLongDate(new Date())}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSystemSync}
            disabled={isSyncing}
            title="Pull fresh LeetCode, CodeChef and GitHub activity for every student"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/20 hover:from-cyber-purple/30 hover:to-cyber-blue/30 border border-cyber-purple/30 hover:border-cyber-blue text-white/90 hover:text-cyber-blue transition cursor-pointer text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            GLOBAL SYNC
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={isDownloadingCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 hover:border-emerald-400 text-white/90 hover:text-emerald-400 transition cursor-pointer text-xs disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${isDownloadingCsv ? 'animate-pulse' : ''}`} />
            EXPORT CSV
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyber-blue text-white/70 hover:text-white transition cursor-pointer text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            RELOAD
          </button>
        </div>
      </div>

      {syncProgress && (
        <p className="font-mono text-[11px] text-white/50">{syncProgress}</p>
      )}
      {syncResult && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono">
          {syncResult}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/25 text-red-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Roll count for the selected year */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(({ label, value, unit, icon: Icon, accent, path }) => (
          <button
            key={label}
            onClick={() => router.push(path)}
            className="glass-card rounded-2xl p-5 text-left border border-outline-variant hover:border-primary/40 transition cursor-pointer flex flex-col justify-between min-h-[110px]"
          >
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{label}</div>
            <div className={`text-3xl font-black mt-2 flex items-baseline gap-1 ${accent}`}>
              {value === null ? '—' : value}
              <span className="text-xs text-white/40 font-normal">{unit}</span>
            </div>
            <div className="text-[10px] text-white/50 mt-1 border-t border-white/5 pt-2 flex items-center gap-1.5">
              <Icon className={`w-3 h-3 ${accent}`} /> {selectedCohort}
            </div>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- Today and next, from the department calendar --- */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-xs font-bold tracking-wide text-white uppercase flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-primary" /> On today
              </h3>
              <button
                onClick={() => router.push('/admin/events')}
                className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                Full calendar <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-white/40 font-mono text-center py-6">Loading the calendar…</p>
            ) : todays.length === 0 ? (
              <p className="text-xs text-white/40 font-mono text-center py-6">
                Nothing scheduled for {selectedCohort} today.
              </p>
            ) : (
              <div className="space-y-2.5">
                {todays.map((e) => (
                  <div key={e.id} className="p-3 rounded-xl border border-amber-500/25 bg-amber-950/15">
                    <p className="text-xs font-bold text-white">{e.title}</p>
                    {e.description && (
                      <p className="text-[10px] text-white/50 mt-1 leading-relaxed">{e.description}</p>
                    )}
                    <span className="mt-2 inline-block text-[8px] font-mono font-bold uppercase tracking-wider text-white/40">
                      Department · {e.audience}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold tracking-wide text-white uppercase border-b border-white/10 pb-2">
              Coming up
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-white/40 font-mono text-center py-6">
                Nothing else on the {selectedCohort} calendar.
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 p-2.5 rounded-xl border border-white/5 bg-white/2">
                    <span className="font-mono text-[10px] text-primary font-bold w-24 shrink-0">
                      {formatDate(e.eventDate)}
                    </span>
                    <span className="border-l border-white/10 pl-4 min-w-0 flex-1">
                      <span className="block font-mono font-semibold text-xs text-white truncate">{e.title}</span>
                      <span className="block text-[10px] text-white/45 truncate">{e.audience}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- Quick launchers, exactly as a student has them --- */}
        <QuickLaunchers />
      </div>
    </div>
  );
}

/**
 * The staff member's own quick launchers.
 *
 * The same store slice the student dashboard writes, which is what makes these
 * show up in the browser extension's popup: the extension reads `websites` out
 * of the workspace blob and does not care whether its owner is staff.
 */
function QuickLaunchers() {
  const websites = useStore((s) => s.websites);
  const addWebsite = useStore((s) => s.addWebsite);
  const removeWebsite = useStore((s) => s.removeWebsite);

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const add = () => {
    if (!name.trim() || !url.trim()) {
      setFormError('Both a name and a link are needed.');
      return;
    }
    const withScheme = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    try {
      new URL(withScheme);
    } catch {
      setFormError('That does not look like a web address.');
      return;
    }

    addWebsite({ name: name.trim(), url: withScheme, timeSpentGoal: 0 });
    setName('');
    setUrl('');
    setFormError('');
    setIsAdding(false);
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 self-start">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <h3 className="text-xs font-bold tracking-wide text-white uppercase flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-primary" /> Quick Launchers
        </h3>
        <button
          onClick={() => { setIsAdding(!isAdding); setFormError(''); }}
          className="p-1 hover:bg-white/10 rounded-lg text-primary transition cursor-pointer"
          title="Add a launcher"
          aria-label="Add a launcher"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3 bg-white/5 border border-white/10 rounded-xl p-3.5"
          >
            <div>
              <label htmlFor="ql-name" className="block text-[9px] font-mono text-white/50 mb-1 uppercase tracking-wider">Name</label>
              <input
                id="ql-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Department drive"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-cyber-blue"
              />
            </div>
            <div>
              <label htmlFor="ql-url" className="block text-[9px] font-mono text-white/50 mb-1 uppercase tracking-wider">URL</label>
              <input
                id="ql-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-cyber-blue"
              />
            </div>
            {formError && <p className="text-[10px] text-red-400 font-mono">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setIsAdding(false); setFormError(''); }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg px-2.5 py-1 text-[10px] font-mono transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={add}
                className="bg-cyber-blue/20 hover:bg-cyber-blue/40 border border-cyber-blue text-cyber-blue rounded-lg px-3 py-1 text-[10px] font-mono font-bold transition cursor-pointer"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex flex-wrap gap-2 max-h-[260px] pr-1 content-start ${menuFor ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {websites.length === 0 ? (
          <p className="text-xs text-white/40 font-mono text-center py-6 w-full">
            No launchers yet. They also show up in the browser extension.
          </p>
        ) : (
          websites.map((site) => {
            let domain = site.url;
            try {
              domain = new URL(/^https?:\/\//i.test(site.url) ? site.url : `https://${site.url}`).hostname;
            } catch {
              // Keep the raw value; the favicon simply will not resolve.
            }

            return (
              <div
                key={site.id}
                title={site.url}
                className="relative flex items-center gap-2 pl-1.5 pr-1 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyber-blue/40 transition group max-w-[11rem]"
              >
                <a
                  href={/^https?:\/\//i.test(site.url) ? site.url : `https://${site.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-w-0"
                >
                  <span className="w-6 h-6 rounded-full bg-black/45 border border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                      alt=""
                      className="w-4 h-4 object-contain"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  </span>
                  <span className="text-[11px] font-mono font-bold text-white group-hover:text-cyber-blue transition truncate">
                    {site.name}
                  </span>
                </a>

                {/* Delete lives behind this menu rather than sitting in the
                    open: a stray click on a bin icon is enough to lose one. */}
                <button
                  onClick={() => setMenuFor((current) => (current === site.id ? null : site.id))}
                  aria-haspopup="menu"
                  aria-expanded={menuFor === site.id}
                  aria-label={`Options for ${site.name}`}
                  className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
                >
                  <MoreVertical className="w-3 h-3" />
                </button>

                {menuFor === site.id && (
                  <div role="menu" className="absolute right-0 top-full mt-1 z-30 w-40 rounded-xl border border-white/12 bg-[#1E2126] p-1 shadow-xl">
                    <a
                      href={/^https?:\/\//i.test(site.url) ? site.url : `https://${site.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMenuFor(null)}
                      className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-white/70 hover:bg-white/10 hover:text-white transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Open
                    </a>
                    <button
                      onClick={() => { removeWebsite(site.id); setMenuFor(null); }}
                      className="w-full flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-red-400 hover:bg-red-950/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
