'use client';

import { useCallback, useState } from 'react';
import { RefreshCw, ScrollText } from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/dateFormat';
import { PanelEmpty, PanelError, PanelLoading, SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   Who opened the console, and what they changed.

   Its own section rather than an overlay, because unlike everything else in
   here the trail is about admins and is not scoped to a year — an overlay
   floating above a year selector that did not apply to it read as a bug.
   ──────────────────────────────────────────────────────────────── */

/** How each action reads, and how loud it looks. Anything unlisted falls back
 *  to its raw key in neutral grey — a new action type shows up as itself
 *  rather than disappearing. */
const ACTION_LABEL: Record<string, string> = {
  'admin.access': 'Sign-in',
  'event.create': 'Event added',
  'event.delete': 'Event deleted',
  'student.update': 'Student edited',
  'student.delete': 'Student deleted',
  'library.create': 'File shared',
  'library.delete': 'File removed',
  'users.export': 'Data export',
  'resumes.export': 'CVs downloaded',
  'stats.sync': 'Stats sync',
};

const ACTION_TONE: Record<string, string> = {
  'admin.access': 'bg-white/5 border-white/10 text-white/50',
  'event.create': 'bg-violet-500/10 border-violet-500/30 text-violet-300',
  'library.create': 'bg-violet-500/10 border-violet-500/30 text-violet-300',
  'event.delete': 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  'library.delete': 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  'student.delete': 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  'student.update': 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  'users.export': 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  'resumes.export': 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  'stats.sync': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  default: 'bg-white/5 border-white/10 text-white/50',
};

/** One line of the trail. The summary arrives already written — this renders
 *  it, it does not compose it. */
interface AdminLogEntry {
  id: string;
  actorEmail: string;
  actorName: string | null;
  action: string;
  summary: string;
  target: string | null;
  cohort: string | null;
  createdAt: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readJson<{ logs?: AdminLogEntry[]; retentionDays?: number }>(
        await apiFetch('/api/admin/logs')
      );
      setLogs(data.logs || []);
      if (data.retentionDays) setRetentionDays(data.retentionDays);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the activity log.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useSectionData(load);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={ScrollText}
        title="Activity Log"
        subtitle={`${logs.length} entries · kept for ${retentionDays} days`}
      >
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-violet-400 text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </SectionHeader>

      <section className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <PanelLoading message="Loading the activity log…" accent="text-violet-300" />
        ) : error ? (
          <PanelError message={error} onRetry={load} />
        ) : logs.length === 0 ? (
          <PanelEmpty>
            Nothing recorded yet.
            <br />
            Console sign-ins, events, student edits and library changes appear here.
          </PanelEmpty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                    <th className="p-4 font-normal w-52">When</th>
                    <th className="p-4 font-normal w-64">Admin</th>
                    <th className="p-4 font-normal w-36">Action</th>
                    <th className="p-4 font-normal">What happened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/3 transition align-top">
                      <td className="p-4 text-white/50 font-mono text-[10px] whitespace-nowrap">
                        {formatDateTime(entry.createdAt, { hour12: true })}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-white truncate max-w-[220px]">
                          {entry.actorName || entry.actorEmail.split('@')[0]}
                        </div>
                        <div className="text-white/40 font-mono text-[10px] truncate max-w-[220px]">
                          {entry.actorEmail}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-0.5 rounded border font-mono text-[9px] uppercase tracking-wider whitespace-nowrap ${
                          ACTION_TONE[entry.action] || ACTION_TONE.default
                        }`}>
                          {ACTION_LABEL[entry.action] || entry.action}
                        </span>
                      </td>
                      <td className="p-4 text-white/70 leading-relaxed">
                        {entry.summary}
                        {entry.cohort && (
                          <span className="ml-2 text-white/35 font-mono text-[10px]">· {entry.cohort}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-white/5 p-4 text-[10px] font-mono text-white/30">
              Kept for {retentionDays} days. Anything older is deleted automatically on the nightly run.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
