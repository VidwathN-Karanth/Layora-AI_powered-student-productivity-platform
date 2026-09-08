'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Building2, Calendar, Clock, ExternalLink, Eye, Flame, RefreshCw,
  Search, Settings, Trash2, Users, X,
} from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { getPlatformDisplay } from '@/lib/courseUtils';
import CertificateGroups, { type InspectedCertificate } from '@/components/CertificateGroups';
import { useAdmin } from '../AdminContext';
import CertificatePreview from '../_components/CertificatePreview';
import { PanelEmpty, PanelError, PanelLoading, SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   Every student in one year, and what their workspace holds.

   The list is a roll call; the drawer is the drill-down. Only two things here
   change anything — the streak/hours override and the purge — and both sit
   behind a deliberate step.
   ──────────────────────────────────────────────────────────────── */

interface TelemetryUser {
  id: string;
  updated_at: string;
  state: {
    user?: {
      name?: string;
      email?: string;
      streakCount?: number;
      totalStudyHours?: number;
      isOnboarded?: boolean;
      freeBlocks?: { id: string; start: string; end: string; label?: string }[];
    };
    subjects?: { id: string; name: string; code: string; credits: number; difficulty: string; priority: string }[];
    tasks?: { id: string; title: string; status: string; deadline: string; estimatedMinutes: number; actualMinutesSpent: number; subjectName?: string }[];
    timetable?: { id: string; day: number; start: string; end: string; title: string; type: string; subjectCode?: string; completed?: boolean; details?: string }[];
    courses?: { id: string; name: string; platform: string; progress: number; weeklyGoal: number; deadline: string }[];
    websites?: { id: string; name: string; url: string; timeSpentGoal: number }[];
  };
}

const TABS = ['profile', 'subjects', 'tasks', 'courses', 'timetable', 'certificates'] as const;
type Tab = (typeof TABS)[number];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "3m ago" up to a day, then a real date. */
function formatLastSync(iso: string): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return formatDateTime(date);
}

export default function AdminStudentsPage() {
  const { selectedCohort } = useAdmin();

  const [users, setUsers] = useState<TelemetryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState<TelemetryUser | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [certificates, setCertificates] = useState<InspectedCertificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [preview, setPreview] = useState<InspectedCertificate | null>(null);

  const [editStreak, setEditStreak] = useState(0);
  const [editHours, setEditHours] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<TelemetryUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // A drawer or a confirmation left open over the previous year would be
    // acting on a student who is no longer in the list behind it. The search
    // box is deliberately left alone: reloading, or looking for the same name
    // in another year, is not a reason to clear what was typed.
    setSelected(null);
    setConfirmDelete(null);
    try {
      const rows = await readJson<{ id: string; state?: TelemetryUser['state']; updated_at?: string }[]>(
        await apiFetch(`/api/admin/users?cohort=${encodeURIComponent(selectedCohort)}`)
      );

      const mapped: TelemetryUser[] = (rows || []).map((row) => ({
        id: row.id,
        state: row.state || {},
        updated_at: row.updated_at || '',
      }));
      mapped.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setUsers(mapped);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this year’s students.'));
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useSectionData(load);

  /**
   * Opens the inspector on one student.
   *
   * The override fields are seeded here rather than in an effect watching
   * `selected`: they are editable, so they cannot simply be derived from the
   * student, and seeding them at the moment of the click is both the React
   * team's advice for this shape and one render fewer than syncing after.
   */
  const inspect = (user: TelemetryUser, startTab: Tab = 'profile') => {
    setSelected(user);
    setTab(startTab);
    setEditStreak(user.state.user?.streakCount || 0);
    setEditHours(user.state.user?.totalStudyHours || 0);
    setSaveNote('');
  };

  useEffect(() => {
    if (!selected || tab !== 'certificates') return;
    let cancelled = false;

    (async () => {
      setLoadingCerts(true);
      try {
        const data = await readJson<InspectedCertificate[]>(
          await apiFetch(`/api/admin/certificates?userId=${encodeURIComponent(selected.id)}`)
        );
        if (!cancelled) setCertificates(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCertificates([]);
      } finally {
        if (!cancelled) setLoadingCerts(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selected, tab]);

  const saveOverride = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveNote('');
    try {
      const state = {
        ...selected.state,
        user: {
          ...(selected.state.user || {}),
          streakCount: Number(editStreak),
          totalStudyHours: Number(editHours),
        },
      };

      await readJson(await apiFetch(`/api/admin/users/${encodeURIComponent(selected.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      }));

      setSelected({ ...selected, state });
      setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, state } : u)));
      setSaveNote('Saved.');
    } catch (err) {
      setSaveNote(errorMessage(err, 'Could not save the override.'));
    } finally {
      setSaving(false);
    }
  };

  const purge = async (user: TelemetryUser) => {
    setConfirmDelete(null);
    try {
      await readJson(await apiFetch(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' }));
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (selected?.id === user.id) setSelected(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete that record.'));
      load();
    }
  };

  const filtered = users.filter((u) => {
    const needle = query.toLowerCase();
    return (
      (u.state.user?.name || '').toLowerCase().includes(needle) ||
      (u.state.user?.email || '').toLowerCase().includes(needle) ||
      u.id.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Users}
        title="Student Nodes"
        subtitle={`Every ${selectedCohort} workspace that has synced, newest first.`}
      >
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email or UUID…"
            aria-label="Search students"
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyber-blue"
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyber-blue text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>
      </SectionHeader>

      <section className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <PanelLoading message="Fetching workspace data…" />
        ) : error ? (
          <PanelError message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <PanelEmpty>
            {users.length === 0
              ? `No ${selectedCohort} student has synced a workspace yet.`
              : 'No student matches that search.'}
          </PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                  <th className="p-4 font-normal">Student</th>
                  <th className="p-4 font-normal">Status</th>
                  <th className="p-4 font-normal">Streak</th>
                  <th className="p-4 font-normal text-right">Study time</th>
                  <th className="p-4 font-normal text-center">Subjects</th>
                  <th className="p-4 font-normal text-center">Tasks done</th>
                  <th className="p-4 font-normal">Last sync</th>
                  <th className="p-4 font-normal text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((u) => {
                  const profile = u.state.user || {};
                  const tasks = u.state.tasks || [];
                  const done = tasks.filter((t) => t.status === 'completed').length;

                  return (
                    <tr key={u.id} className="hover:bg-white/3 transition group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-cyber-blue shrink-0">
                            {profile.name?.charAt(0).toUpperCase() || 'U'}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-bold text-white group-hover:text-cyber-blue transition truncate">
                              {profile.name || 'Anonymous student'}
                            </span>
                            <span className="block text-[10px] text-white/40 truncate">
                              {profile.email || 'No email synced'}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {profile.isOnboarded ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-semibold">ONBOARDED</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-semibold">ONBOARDING</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-bold text-white">{profile.streakCount || 0}d</span>
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-white">
                        {profile.totalStudyHours?.toFixed(1) || '0.0'}h
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 bg-white/5 rounded border border-white/10 font-bold">
                          {u.state.subjects?.length || 0}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          tasks.length > 0 && done === tasks.length
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : 'bg-white/5 border border-white/10 text-white/70'
                        }`}>
                          {done} / {tasks.length}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="block font-medium text-white/70">{formatLastSync(u.updated_at)}</span>
                        <span className="block text-[9px] text-white/30 truncate max-w-[120px]">{u.id}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => inspect(u)}
                            className="p-1.5 rounded-lg border border-white/10 hover:border-cyber-blue text-white/60 hover:text-cyber-blue transition cursor-pointer"
                            title="Inspect"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(u)}
                            className="p-1.5 rounded-lg border border-white/10 hover:border-rose-400 text-white/60 hover:text-rose-400 transition cursor-pointer"
                            title="Purge synced state"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Purge confirmation --- */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              role="dialog" aria-modal="true"
              className="glass-panel border border-red-500/30 p-6 rounded-2xl max-w-sm w-full relative z-10 bg-[#1E2126]"
            >
              <div className="flex items-center gap-3 text-red-400">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-base font-black tracking-wider uppercase">Purge sync data</h3>
              </div>
              <p className="text-xs text-white/60 font-mono mt-3 leading-relaxed">
                This deletes the synced workspace of{' '}
                <span className="text-red-400 font-semibold">
                  {confirmDelete.state.user?.name || confirmDelete.id}
                </span>
                . Their tasks, timetable and courses are removed from the database.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  ABORT
                </button>
                <button
                  onClick={() => purge(confirmDelete)}
                  className="px-4 py-2 bg-red-950/45 hover:bg-red-900 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  CONFIRM PURGE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Student inspector --- */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[60] flex items-center justify-end">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-screen bg-[#1A1D22]/95 border-l border-white/10 flex flex-col z-10 shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 bg-white/2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-lg bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue font-bold text-lg shrink-0">
                    {selected.state.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white truncate">
                      {selected.state.user?.name || 'Anonymous student'}
                    </h3>
                    <p className="text-[10px] text-white/40 truncate">
                      {selected.state.user?.email || selected.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex border-b border-white/5 bg-black/40 overflow-x-auto shrink-0 scrollbar-none">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-3 text-[10px] font-bold tracking-wider uppercase border-b-2 whitespace-nowrap transition cursor-pointer ${
                      tab === t
                        ? 'border-cyber-blue text-cyber-blue bg-white/2'
                        : 'border-transparent text-white/40 hover:text-white/80'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {tab === 'profile' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/2 border border-white/5 rounded-xl p-4">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyber-purple" /> Free study slots
                        </div>
                        <div className="mt-2 text-xs font-bold text-white">
                          {selected.state.user?.freeBlocks?.length || 0} blocks
                        </div>
                      </div>
                      <div className="bg-white/2 border border-white/5 rounded-xl p-4">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-cyber-blue" /> Onboarded
                        </div>
                        <div className="mt-2 text-xs font-bold text-white">
                          {selected.state.user?.isOnboarded ? 'Yes' : 'Not yet'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-500" /> Quick launchers
                      </div>
                      {selected.state.websites && selected.state.websites.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selected.state.websites.map((w) => (
                            <div key={w.id || w.name} className="p-2 border border-white/5 rounded-lg bg-black/40 flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-white truncate">{w.name}</span>
                              <span className="text-[10px] text-white/40 shrink-0">{w.timeSpentGoal}m goal</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30">No launchers saved.</p>
                      )}
                    </div>

                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyber-blue" /> Free time blocks
                      </div>
                      {selected.state.user?.freeBlocks && selected.state.user.freeBlocks.length > 0 ? (
                        <div className="space-y-1.5">
                          {selected.state.user.freeBlocks.map((fb, idx) => (
                            <div key={fb.id || idx} className="p-2.5 border border-white/5 rounded-lg bg-black/40 flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{fb.label || `Free block ${idx + 1}`}</span>
                              <span className="font-mono text-cyber-blue">{fb.start} – {fb.end}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30">No free time slots set.</p>
                      )}
                    </div>

                    <div className="bg-white/2 border border-cyber-purple/20 rounded-xl p-4 space-y-4">
                      <div className="text-[10px] text-cyber-purple font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5" /> Telemetry override
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor="edit-streak" className="text-[10px] text-white/50 font-mono uppercase">Streak (days)</label>
                          <input
                            id="edit-streak"
                            type="number"
                            value={editStreak}
                            onChange={(e) => setEditStreak(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyber-purple"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="edit-hours" className="text-[10px] text-white/50 font-mono uppercase">Study hours</label>
                          <input
                            id="edit-hours"
                            type="number"
                            step="0.1"
                            value={editHours}
                            onChange={(e) => setEditHours(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyber-purple"
                          />
                        </div>
                      </div>
                      <button
                        onClick={saveOverride}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 border border-cyber-purple/30 hover:border-cyber-purple bg-cyber-purple/10 hover:bg-cyber-purple/25 text-cyber-purple hover:text-white py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        {saving ? 'SAVING…' : 'WRITE OVERRIDE'}
                      </button>
                      {saveNote && <p className="text-[10px] font-mono text-white/50 text-center">{saveNote}</p>}
                    </div>
                  </div>
                )}

                {tab === 'subjects' && (
                  (selected.state.subjects?.length ?? 0) > 0 ? (
                    <div className="space-y-2">
                      {selected.state.subjects!.map((sub) => (
                        <div key={sub.id} className="p-4 border border-white/5 rounded-xl bg-white/2 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs truncate">{sub.name}</span>
                              <span className="text-[10px] font-mono bg-cyber-blue/15 text-cyber-blue px-1.5 py-0.5 rounded border border-cyber-blue/20 shrink-0">{sub.code}</span>
                            </div>
                            <div className="text-[10px] text-white/40 mt-1 font-mono">
                              Difficulty: {sub.difficulty} · Credits: {sub.credits}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                            sub.priority === 'High'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : sub.priority === 'Medium'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {sub.priority.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : <PanelEmpty>No subjects configured.</PanelEmpty>
                )}

                {tab === 'tasks' && (
                  (selected.state.tasks?.length ?? 0) > 0 ? (
                    <div className="space-y-2">
                      {selected.state.tasks!.map((task) => (
                        <div key={task.id} className="p-3 border border-white/5 rounded-xl bg-white/2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className={`text-xs font-bold text-white truncate ${task.status === 'completed' ? 'line-through text-white/40' : ''}`}>
                              {task.title}
                            </h4>
                            <div className="text-[9px] text-white/40 mt-1 font-mono truncate">
                              {task.subjectName || 'General'} · due {formatDate(task.deadline)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[10px] text-white/50 font-mono">
                              {task.actualMinutesSpent} / {task.estimatedMinutes}m
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              task.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                : task.status === 'in_progress'
                                  ? 'bg-cyber-blue/15 text-cyber-blue border border-cyber-blue/25'
                                  : 'bg-white/5 border border-white/10 text-white/50'
                            }`}>
                              {task.status.toUpperCase().replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <PanelEmpty>No tasks registered.</PanelEmpty>
                )}

                {tab === 'courses' && (
                  (selected.state.courses?.length ?? 0) > 0 ? (
                    <div className="space-y-3">
                      {selected.state.courses!.map((course) => (
                        <div key={course.id} className="p-4 border border-white/5 rounded-xl bg-white/2 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{course.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-white/40 font-mono truncate">
                                  {getPlatformDisplay(course.platform)} · due {formatDate(course.deadline)}
                                </span>
                                {course.platform?.startsWith('http') && (
                                  <a
                                    href={course.platform}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[9px] text-cyber-blue hover:underline flex items-center gap-0.5 shrink-0"
                                  >
                                    Visit <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-cyber-blue font-bold font-mono shrink-0">{course.progress}%</span>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill bg-cyber-blue" style={{ width: `${course.progress}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <PanelEmpty>No online courses enrolled.</PanelEmpty>
                )}

                {tab === 'timetable' && (
                  (selected.state.timetable?.length ?? 0) > 0 ? (
                    <div className="space-y-2">
                      {selected.state.timetable!.map((block) => (
                        <div key={block.id} className="p-3 border border-white/5 rounded-xl bg-white/2 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white truncate">{block.title}</span>
                              <span className="text-[9px] bg-white/5 px-1 rounded text-white/40 font-mono uppercase shrink-0">{block.type}</span>
                            </div>
                            <div className="text-[10px] text-white/40 mt-1 font-mono">
                              {DAYS[block.day]} · {block.start} – {block.end}
                              {block.subjectCode ? ` (${block.subjectCode})` : ''}
                            </div>
                          </div>
                          {block.completed && (
                            <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold shrink-0">
                              COMPLETED
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <PanelEmpty>No weekly schedule yet.</PanelEmpty>
                )}

                {tab === 'certificates' && (
                  loadingCerts ? (
                    <PanelLoading message="Fetching certificates…" />
                  ) : certificates.length === 0 ? (
                    <PanelEmpty>No certificates uploaded by this student.</PanelEmpty>
                  ) : (
                    <CertificateGroups certificates={certificates} onPreview={setPreview} accent="blue" />
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CertificatePreview certificate={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
