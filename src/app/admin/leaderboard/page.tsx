'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, RefreshCw, Trophy, X } from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { useAdmin } from '../AdminContext';
import { PanelEmpty, PanelError, PanelLoading, SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   The year's coding activity, ranked.

   Numbers come from the nightly sync of LeetCode, CodeChef and GitHub; this
   page only reads them. The drawer exists so a lecturer can get to a student's
   actual profiles rather than taking the count on trust.
   ──────────────────────────────────────────────────────────────── */

interface LeaderboardRow {
  userId: string;
  name: string | null;
  leetcodeUsername?: string | null;
  codechefUsername?: string | null;
  githubUsername?: string | null;
  linkedinUrl?: string | null;
  totalLeetcodeSolved: number;
  totalCodechefSolved?: number;
  totalGithubContributions: number;
  totalPoints: number;
}

type Range = 'today' | 'week' | 'all';

/** A handle or a full URL, both of which students type. */
function profileUrl(handle: string | null | undefined, base: string): string | null {
  const value = (handle || '').trim();
  if (!value) return null;
  return value.startsWith('http') ? value : `${base}${value}`;
}

const PROFILES = [
  { key: 'githubUsername' as const, label: '🐙 GitHub', base: 'https://github.com/', tone: 'bg-cyber-blue/10 hover:bg-cyber-blue/20 border-cyber-blue/25 hover:border-cyber-blue/50 text-cyber-blue' },
  { key: 'leetcodeUsername' as const, label: '💡 LeetCode', base: 'https://leetcode.com/u/', tone: 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/25 hover:border-yellow-500/50 text-yellow-500' },
  { key: 'codechefUsername' as const, label: '🍳 CodeChef', base: 'https://www.codechef.com/users/', tone: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/25 hover:border-orange-500/50 text-orange-500' },
  { key: 'linkedinUrl' as const, label: '🔗 LinkedIn', base: 'https://', tone: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/25 hover:border-blue-500/50 text-blue-400' },
];

const RANK_TONE = [
  'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
  'text-slate-300 border-slate-400/30 bg-slate-400/5',
  'text-amber-600 border-amber-600/30 bg-amber-600/5',
];

export default function AdminLeaderboardPage() {
  const { selectedCohort } = useAdmin();

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [range, setRange] = useState<Range>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // A drawer open over the previous year's list would outlive its row.
    setSelected(null);
    try {
      const data = await readJson<{ leaderboard?: LeaderboardRow[] }>(
        await apiFetch(`/api/admin/leaderboard?range=${range}&cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setRows(data.leaderboard || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load leaderboard data.'));
    } finally {
      setLoading(false);
    }
  }, [range, selectedCohort]);

  useSectionData(load);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Trophy}
        title="Activity Leaderboard"
        subtitle={`${selectedCohort} coding activity, recalculated on the nightly sync.`}
      >
        <div className="flex items-center gap-2">
          {(['today', 'week', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-bold tracking-wider transition cursor-pointer ${
                range === r
                  ? 'border-cyber-purple bg-cyber-purple/20 text-cyber-purple'
                  : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              {r === 'week' ? '7 Days' : r}
            </button>
          ))}
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyber-purple text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>
      </SectionHeader>

      <section className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <PanelLoading message="Compiling ranks…" accent="text-cyber-purple" />
        ) : error ? (
          <PanelError message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <PanelEmpty>No activity recorded for {selectedCohort} in this period.</PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                  <th className="p-4 font-normal text-center w-16">Rank</th>
                  <th className="p-4 font-normal">Student</th>
                  <th className="p-4 font-normal">Linked accounts</th>
                  <th className="p-4 font-normal text-right">LC solves</th>
                  <th className="p-4 font-normal text-right">CC solves</th>
                  <th className="p-4 font-normal text-right">GitHub</th>
                  <th className="p-4 font-normal text-right">Points</th>
                  <th className="p-4 font-normal text-center w-20">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((item, index) => (
                  <tr key={item.userId} className="hover:bg-white/3 transition group">
                    <td className="p-4 text-center font-black text-sm">
                      {index < 3 ? (
                        <span className={`inline-flex w-7 h-7 rounded-full border items-center justify-center font-extrabold ${RANK_TONE[index]}`}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-white/40">#{index + 1}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-cyber-purple shrink-0">
                          {item.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-bold text-white group-hover:text-cyber-purple transition truncate">
                            {item.name || 'Anonymous student'}
                          </span>
                          <span className="block text-[9px] text-white/30 truncate max-w-[150px]">{item.userId}</span>
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        {PROFILES.slice(0, 3).map(({ key, label, base, tone }) => {
                          const url = profileUrl(item[key], base);
                          return url ? (
                            <a
                              key={key}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition w-fit ${tone}`}
                            >
                              {label}: <strong className="text-white hover:underline">{item[key]}</strong>
                            </a>
                          ) : (
                            <span key={key} className="text-[9px] text-white/20 font-mono italic">
                              {label} not linked
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4 text-right font-black text-white text-sm">
                      {item.totalLeetcodeSolved} <span className="text-[10px] font-normal text-white/40">solved</span>
                    </td>
                    <td className="p-4 text-right font-black text-white text-sm">
                      {item.totalCodechefSolved || 0} <span className="text-[10px] font-normal text-white/40">solved</span>
                    </td>
                    <td className="p-4 text-right font-black text-white text-sm">
                      {item.totalGithubContributions} <span className="text-[10px] font-normal text-white/40">contribs</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="px-3 py-1 bg-cyber-purple/10 border border-cyber-purple/20 text-cyber-purple rounded-lg font-black text-sm">
                        {item.totalPoints} pts
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelected(item)}
                        className="p-1.5 rounded-lg border border-white/10 hover:border-cyber-blue text-white/60 hover:text-cyber-blue transition cursor-pointer"
                        title="Inspect accounts"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              role="dialog" aria-modal="true"
              className="glass-panel border border-cyber-purple/30 p-6 rounded-2xl max-w-md w-full relative z-10 bg-[#1E2126]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-lg bg-cyber-purple/15 border border-cyber-purple/35 flex items-center justify-center font-bold text-sm text-cyber-purple shrink-0">
                    {selected.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white truncate">{selected.name || 'Anonymous student'}</h3>
                    <p className="text-[10px] text-white/40 truncate">{selected.userId}</p>
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

              <div className="mt-6 space-y-4">
                <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Points summary</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">Points</div>
                      <div className="text-sm font-black text-cyber-purple mt-0.5">{selected.totalPoints}</div>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">LeetCode</div>
                      <div className="text-sm font-black text-yellow-500 mt-0.5">{selected.totalLeetcodeSolved}</div>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">GitHub</div>
                      <div className="text-sm font-black text-cyber-blue mt-0.5">{selected.totalGithubContributions}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Profiles</span>
                  {PROFILES.map(({ key, label, base, tone }) => {
                    const url = profileUrl(selected[key], base);
                    return url ? (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border font-bold text-xs transition ${tone}`}
                      >
                        <span>{label}</span>
                        <span className="text-white text-[10px] truncate max-w-[200px]">
                          {key === 'linkedinUrl' ? 'View profile' : selected[key]}
                        </span>
                      </a>
                    ) : (
                      <div key={key} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                        <span>{label}</span>
                        <span>Not linked</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
