'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { 
  Trophy, Award, TrendingUp, Calendar, RefreshCw,
  AlertTriangle, Terminal, GitBranch, ShieldAlert
} from 'lucide-react';

interface RangeStats {
  commits: number;
  solves: number;
  points: number;
}

interface UserStats {
  today: RangeStats;
  yesterday: RangeStats;
  week: RangeStats;
  month: RangeStats;
  allTime: RangeStats & { leetcodeUsername: string | null; githubUsername: string | null };
}

export default function LeaderboardPage() {
  const store = useStore();
  const { user: clerkUser } = useUser();

  // Stats States
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Leaderboard States
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardRange, setLeaderboardRange] = useState<'today' | 'week' | 'all'>('all');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');

  const isAdmin = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase() === 'vidwathkaranth@gmail.com' || 
                  store.user?.email?.toLowerCase() === 'vidwathkaranth@gmail.com';

  const fetchUserStats = async () => {
    const targetUserId = clerkUser?.id || store.user?.email || 'test_user';
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/users/${targetUserId}/activity-stats`);
      if (res.ok) {
        const data = await res.json();
        setUserStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch user activity stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchLeaderboard = async (range: 'today' | 'week' | 'all') => {
    setLoadingLeaderboard(true);
    setLeaderboardError('');
    try {
      const res = await fetch(`/api/admin/leaderboard?range=${range}`);
      if (!res.ok) {
        throw new Error('Failed to fetch leaderboard data.');
      }
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
      setLeaderboardError('Could not load leaderboard data.');
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    fetchUserStats();
  }, [clerkUser?.id]);

  useEffect(() => {
    fetchLeaderboard(leaderboardRange);
  }, [leaderboardRange]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-outline-variant pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">🏆 Global Scoreboard</h2>
          <p className="text-xs text-outline font-mono mt-0.5">Compare study progress, coding accomplishments, and contribution streaks.</p>
        </div>
      </div>

      {/* --- PERSONALIZED USER STATS BLOCK --- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {loadingStats ? (
          <div className="col-span-full bg-white/2 border border-outline-variant rounded-2xl p-8 text-center flex flex-col items-center gap-2 text-xs text-outline font-mono">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            Compiling your personal activity records...
          </div>
        ) : userStats ? (
          <>
            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between min-h-[100px] border border-primary/25 bg-primary/5">
              <div className="text-[9px] text-primary font-bold uppercase tracking-wider flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> All-Time Points
              </div>
              <div className="text-2xl font-black text-white mt-1.5">{userStats.allTime.points} <span className="text-[10px] font-normal text-outline">pts</span></div>
              <div className="text-[9px] text-outline border-t border-outline-variant/30 pt-1.5 mt-1.5">
                {userStats.allTime.solves} Solves | {userStats.allTime.commits} Commits
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between min-h-[100px] border border-outline-variant/30">
              <div className="text-[9px] text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Today
              </div>
              <div className="text-xl font-black text-white mt-1.5">+{userStats.today.points} <span className="text-[9px] font-normal text-outline">pts</span></div>
              <div className="text-[9px] text-outline border-t border-outline-variant/30 pt-1.5 mt-1.5 flex flex-col gap-0.5">
                <span>💡 Solves: <strong>{userStats.today.solves}</strong></span>
                <span>🐙 Commits: <strong>{userStats.today.commits}</strong></span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between min-h-[100px] border border-outline-variant/30">
              <div className="text-[9px] text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-400" /> Yesterday
              </div>
              <div className="text-xl font-black text-white mt-1.5">+{userStats.yesterday.points} <span className="text-[9px] font-normal text-outline">pts</span></div>
              <div className="text-[9px] text-outline border-t border-outline-variant/30 pt-1.5 mt-1.5 flex flex-col gap-0.5">
                <span>💡 Solves: <strong>{userStats.yesterday.solves}</strong></span>
                <span>🐙 Commits: <strong>{userStats.yesterday.commits}</strong></span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between min-h-[100px] border border-outline-variant/30">
              <div className="text-[9px] text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Last 7 Days
              </div>
              <div className="text-xl font-black text-white mt-1.5">+{userStats.week.points} <span className="text-[9px] font-normal text-outline">pts</span></div>
              <div className="text-[9px] text-outline border-t border-outline-variant/30 pt-1.5 mt-1.5 flex flex-col gap-0.5">
                <span>💡 Solves: <strong>{userStats.week.solves}</strong></span>
                <span>🐙 Commits: <strong>{userStats.week.commits}</strong></span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between min-h-[100px] border border-outline-variant/30">
              <div className="text-[9px] text-outline font-bold uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" /> Last 30 Days
              </div>
              <div className="text-xl font-black text-white mt-1.5">+{userStats.month.points} <span className="text-[9px] font-normal text-outline">pts</span></div>
              <div className="text-[9px] text-outline border-t border-outline-variant/30 pt-1.5 mt-1.5 flex flex-col gap-0.5">
                <span>💡 Solves: <strong>{userStats.month.solves}</strong></span>
                <span>🐙 Commits: <strong>{userStats.month.commits}</strong></span>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-full bg-white/2 border border-outline-variant rounded-2xl p-6 text-center text-xs text-outline font-mono">
            No linked GitHub/LeetCode account stats available. Sync your accounts in settings to track your progress.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* --- LEADERBOARD DISPLAY PANEL --- */}
        <div className="xl:col-span-2 glass-card rounded-2xl border border-outline-variant overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant bg-white/3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono font-bold tracking-wider text-primary uppercase">Global Leaderboard</span>
              {!isAdmin && (
                <span className="text-[8px] border border-outline-variant text-outline bg-white/2 px-1.5 py-0.5 rounded font-mono font-normal uppercase">
                  🔒 Privacy Mode Active
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5">
              {(['today', 'week', 'all'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setLeaderboardRange(r)}
                  className={`px-2.5 py-1 rounded-lg border text-[9px] uppercase font-bold tracking-wider transition cursor-pointer ${
                    leaderboardRange === r
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant bg-white/3 text-outline hover:text-on-surface'
                  }`}
                >
                  {r === 'week' ? '7 Days' : r}
                </button>
              ))}
            </div>
          </div>

          {loadingLeaderboard ? (
            <div className="p-12 text-center text-outline text-xs flex flex-col items-center gap-3 font-mono">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              Compiling rankings...
            </div>
          ) : leaderboardError ? (
            <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2 font-mono">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>{leaderboardError}</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-12 text-center text-outline text-xs font-mono">
              No activity entries registered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-outline-variant bg-white/2 text-outline font-bold uppercase tracking-wider">
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Student</th>
                    {isAdmin && (
                      <>
                        <th className="p-3 text-right">Solves</th>
                        <th className="p-3 text-right">Commits</th>
                      </>
                    )}
                    <th className="p-3 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {leaderboard.map((item, index) => {
                    const isSelf = item.userId === (clerkUser?.id || store.user?.email);
                    const isTopThree = index < 3;
                    const medalColors = [
                      'text-yellow-400 bg-yellow-500/5 border-yellow-500/20', 
                      'text-slate-300 bg-slate-400/5 border-slate-400/20', 
                      'text-amber-600 bg-amber-600/5 border-amber-600/20'
                    ];
                    
                    return (
                      <tr key={item.userId} className={`hover:bg-white/2 transition ${isSelf ? 'bg-primary/5 text-primary border-l-2 border-l-primary' : ''}`}>
                        <td className="p-3 text-center font-bold">
                          {isTopThree ? (
                            <span className={`inline-flex w-6 h-6 rounded-full border items-center justify-center font-extrabold ${medalColors[index]}`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="text-outline">#{index + 1}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div>
                            <span className={`font-bold ${isSelf ? 'text-primary' : 'text-on-surface'}`}>{item.name}</span>
                            {isSelf && <span className="ml-1 text-[8px] bg-primary/10 text-primary border border-primary/20 px-1 py-px rounded uppercase">You</span>}
                            

                          </div>
                        </td>
                        
                        {/* Privacy Check: Detailed solves/commits columns only rendered for Admin */}
                        {isAdmin && (
                          <>
                            <td className="p-3 text-right font-bold text-on-surface">
                              {item.totalLeetcodeSolved}
                            </td>
                            <td className="p-3 text-right font-bold text-on-surface">
                              {item.totalGithubContributions}
                            </td>
                          </>
                        )}
                        
                        <td className="p-3 text-right">
                          <span className="font-black text-glow text-primary">
                            {item.totalPoints} pts
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* --- POINTS RULES CARD --- */}
        <div className="glass-card rounded-2xl p-5 border border-outline-variant space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <Award className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Points Allotment Rules</h3>
          </div>

          <div className="space-y-4 text-[10px] font-mono text-outline leading-relaxed">
            <p>Points are computed automatically by querying public activity records and mapped daily in your ledger.</p>
            
            <div className="space-y-2 border-t border-outline-variant/30 pt-3">
              <h4 className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-yellow-500" /> LeetCode Solves (Cumulative)
              </h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Easy solves: <strong className="text-on-surface">10 pts each</strong></li>
                <li>Medium solves: <strong className="text-on-surface">20 pts each</strong></li>
                <li>Hard solves: <strong className="text-on-surface">30 pts each</strong></li>
              </ul>
            </div>

            <div className="space-y-2 border-t border-outline-variant/30 pt-3">
              <h4 className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" /> GitHub Contributions
              </h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Contributions tracked and displayed: <strong className="text-on-surface">Yes</strong></li>
                <li>Points awarded: <strong className="text-on-surface">0 pts</strong></li>
              </ul>
            </div>

            <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/20 text-[9px] mt-2">
              ℹ️ <strong>System Sync Schedule</strong>: All public profile syncs run daily at <strong>10:00 PM IST (16:30 UTC)</strong>. Only accepts accepted (AC) problem submissions and contributions from public GitHub repositories.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
