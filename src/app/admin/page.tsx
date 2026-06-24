'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useStore } from '@/store/useStore';
import { 
  Users, Clock, Flame, BookOpen, Search, ArrowLeft, 
  Trash2, Settings, Activity, Calendar, ListTodo, 
  CheckCircle2, Building2, LogOut, X, FileText, Globe, RefreshCw, Eye, Sparkles, AlertTriangle, ExternalLink, Download
} from 'lucide-react';
import { getPlatformDisplay } from '@/lib/courseUtils';

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
      wakeTime?: string;
      sleepTime?: string;
      collegeStart?: string;
      collegeEnd?: string;
      freeBlocks?: { id: string; start: string; end: string; label?: string }[];
    };
    subjects?: { id: string; name: string; code: string; credits: number; difficulty: string; priority: string }[];
    tasks?: { id: string; title: string; status: string; deadline: string; estimatedMinutes: number; actualMinutesSpent: number; subjectName?: string }[];
    timetable?: { id: string; day: number; start: string; end: string; title: string; type: string; subjectCode?: string; completed?: boolean }[];
    courses?: { id: string; name: string; platform: string; progress: number; weeklyGoal: number; deadline: string }[];
    websites?: { id: string; name: string; url: string; timeSpentGoal: number }[];
    chatHistory?: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }[];
  };
}

export default function AdminPage() {
  const router = useRouter();
  const { isLoaded: isUserLoaded, user } = useUser();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  
  const [authorized, setAuthorized] = useState(false);
  const [usersList, setUsersList] = useState<TelemetryUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<TelemetryUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'subjects' | 'tasks' | 'courses' | 'timetable' | 'certificates' | 'chat'>('profile');
  const [inspectedCerts, setInspectedCerts] = useState<any[]>([]);
  const [loadingInspectedCerts, setLoadingInspectedCerts] = useState(false);
  const [activeCertPreview, setActiveCertPreview] = useState<any | null>(null);
  const [editStreak, setEditStreak] = useState<number>(0);
  const [editHours, setEditHours] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSyncingSystem, setIsSyncingSystem] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);

  // Leaderboard States & Handlers
  const [adminView, setAdminView] = useState<'nodes' | 'leaderboard'>('nodes');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardRange, setLeaderboardRange] = useState<'today' | 'week' | 'all'>('all');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');
  const [selectedLeaderboardUser, setSelectedLeaderboardUser] = useState<any | null>(null);

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
    } catch (err: any) {
      console.error(err);
      setLeaderboardError('Could not load leaderboard data. Please verify your database connection or if the endpoint is deployed.');
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleSystemSync = async () => {
    setIsSyncingSystem(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        throw new Error('System sync request failed');
      }
      const data = await res.json();
      if (data.success) {
        alert('Global activity sync completed successfully!');
        await Promise.all([
          fetchTelemetry(),
          fetchLeaderboard(leaderboardRange)
        ]);
      } else {
        throw new Error(data.error || 'Failed to trigger global sync');
      }
    } catch (err: any) {
      console.error("Global sync failed:", err);
      setErrorMsg(err.message || 'Failed to trigger global activity sync.');
    } finally {
      setIsSyncingSystem(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsDownloadingCsv(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/export-users');
      if (!res.ok) {
        throw new Error('Failed to fetch export data');
      }
      const data = await res.json();
      
      const csvHeaders = [
        'Name',
        'Email',
        'LinkedIn URL',
        'LeetCode URL',
        'GitHub URL',
        'CodeChef URL',
        'LeetCode Easy Solves',
        'LeetCode Medium Solves',
        'LeetCode Hard Solves',
        'LeetCode Total Solves',
        'CodeChef Solves',
        'GitHub Commits'
      ];

      const csvRows = data.map((user: any) => {
        const leetcodeUrl = user.leetcodeUsername
          ? (user.leetcodeUsername.trim().startsWith('http')
              ? user.leetcodeUsername.trim()
              : `https://leetcode.com/u/${user.leetcodeUsername.trim()}`)
          : '';

        const githubUrl = user.githubUsername
          ? (user.githubUsername.trim().startsWith('http')
              ? user.githubUsername.trim()
              : `https://github.com/${user.githubUsername.trim()}`)
          : '';

        const codechefUrl = user.codechefUsername
          ? (user.codechefUsername.trim().startsWith('http')
              ? user.codechefUsername.trim()
              : `https://www.codechef.com/users/${user.codechefUsername.trim()}`)
          : '';

        return [
          user.name || '',
          user.email || '',
          user.linkedinUrl || '',
          leetcodeUrl,
          githubUrl,
          codechefUrl,
          user.leetcodeEasyTotal || 0,
          user.leetcodeMediumTotal || 0,
          user.leetcodeHardTotal || 0,
          (user.leetcodeEasyTotal || 0) + (user.leetcodeMediumTotal || 0) + (user.leetcodeHardTotal || 0),
          user.codechefSolvedTotal || 0,
          user.githubContributions || 0
        ].map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(',');
      });

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `layora_users_stats_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("CSV Download failed:", err);
      setErrorMsg(err.message || 'Failed to generate and download CSV export.');
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  useEffect(() => {
    if (authorized && adminView === 'leaderboard') {
      fetchLeaderboard(leaderboardRange);
    }
  }, [authorized, adminView, leaderboardRange]);

  useEffect(() => {
    if (selectedUser) {
      setEditStreak(selectedUser.state.user?.streakCount || 0);
      setEditHours(selectedUser.state.user?.totalStudyHours || 0);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUser && activeTab === 'certificates') {
      const fetchUserCerts = async () => {
        setLoadingInspectedCerts(true);
        try {
          const res = await fetch(`/api/admin/certificates?userId=${selectedUser.id}`);
          if (res.ok) {
            const data = await res.json();
            setInspectedCerts(data);
          } else {
            setInspectedCerts([]);
          }
        } catch (err) {
          console.error('Failed to load user certificates for admin:', err);
          setInspectedCerts([]);
        } finally {
          setLoadingInspectedCerts(false);
        }
      };
      fetchUserCerts();
    }
  }, [selectedUser, activeTab]);

  // Verify Admin Access
  useEffect(() => {
    if (!isUserLoaded || !isAuthLoaded) return;

    if (isSignedIn) {
      const email = user?.primaryEmailAddress?.emailAddress || '';
      if (email.toLowerCase() === 'vidwathkaranth@gmail.com') {
        setAuthorized(true);
        fetchTelemetry();
      } else {
        router.replace('/dashboard');
      }
    } else {
      router.replace('/login');
    }
  }, [isUserLoaded, isAuthLoaded, isSignedIn, user, router]);

  // Fetch Supabase user states
  const fetchTelemetry = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLocalMode(true);
      setErrorMsg('');
      setLoadingData(true);
      try {
        const registeredUsers = useStore.getState().registeredUsers || [];
        const fetched: TelemetryUser[] = registeredUsers.map((u: any) => ({
          id: u.email,
          updated_at: u.lastActiveDate ? new Date(u.lastActiveDate).toISOString() : new Date().toISOString(),
          state: {
            user: {
              name: u.name,
              email: u.email,
              streakCount: u.streakCount,
              totalStudyHours: u.totalStudyHours,
              isOnboarded: u.isOnboarded,
              wakeTime: u.wakeTime,
              sleepTime: u.sleepTime,
              collegeStart: u.collegeStart,
              collegeEnd: u.collegeEnd,
              freeBlocks: u.freeBlocks || []
            },
            subjects: u.subjects || [],
            tasks: u.tasks || [],
            timetable: u.timetable || [],
            courses: u.courses || [],
            websites: u.websites || [],
            chatHistory: u.chatHistory || []
          }
        }));

        // Sort by last active / updated time descending
        fetched.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setUsersList(fetched);
      } catch (err: any) {
        console.error("Failed to load local telemetry:", err);
        setErrorMsg("Failed to load local storage telemetry data.");
      } finally {
        setLoadingData(false);
      }
      return;
    }

    try {
      setLoadingData(true);
      setIsLocalMode(false);
      setErrorMsg('');
      const { data, error } = await supabase
        .from('user_states')
        .select('*');

      if (error) throw error;

      const fetched: TelemetryUser[] = (data || []).map((row: any) => ({
        id: row.id,
        state: row.state || {},
        updated_at: row.updated_at || '',
      }));

      // Sort by last active / updated time descending
      fetched.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setUsersList(fetched);
    } catch (err: any) {
      console.error("Failed to load telemetry:", err);
      setErrorMsg(err.message || "Failed to sync user database states from Supabase.");
    } finally {
      setLoadingData(false);
    }
  };

  // Delete User Sync Record
  const handleDeleteRecord = async (userId: string) => {
    setShowDeleteConfirm(null);
    try {
      setLoadingData(true);
      if (isSupabaseConfigured && supabase) {
        // 1. Delete from user_states
        const { error: stateError } = await supabase
          .from('user_states')
          .delete()
          .eq('id', userId);
        if (stateError) throw stateError;

        // 2. Delete from daily_activities
        const { error: activityError } = await supabase
          .from('daily_activities')
          .delete()
          .eq('user_id', userId);
        if (activityError) throw activityError;

        // 3. Delete from users
        const { error: userError } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);
        if (userError) throw userError;
      } else {
        // Local mode delete
        const registeredUsers = useStore.getState().registeredUsers || [];
        const updated = registeredUsers.filter((u) => u.email !== userId);
        useStore.getState().setFullState({ registeredUsers: updated });
      }

      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
    } catch (err: any) {
      console.error("Failed to delete user state:", err);
      alert("Error deleting user state: " + err.message);
      // Re-fetch telemetry to restore list consistency on failure
      fetchTelemetry();
    } finally {
      setLoadingData(false);
    }
  };

  // Update User Telemetry Stats (Streak & Hours override)
  const handleUpdateUserStats = async () => {
    if (!selectedUser) return;
    try {
      setIsSavingEdit(true);
      
      const updatedUser = {
        ...(selectedUser.state.user || {}),
        streakCount: Number(editStreak),
        totalStudyHours: Number(editHours)
      };

      const updatedState = {
        ...selectedUser.state,
        user: updatedUser
      };

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('user_states')
          .upsert({
            id: selectedUser.id,
            state: updatedState,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      } else {
        // Local mode update
        const registeredUsers = useStore.getState().registeredUsers || [];
        const updated = registeredUsers.map((u) => {
          if (u.email === selectedUser.id) {
            return {
              ...u,
              streakCount: Number(editStreak),
              totalStudyHours: Number(editHours)
            };
          }
          return u;
        });
        useStore.getState().setFullState({ registeredUsers: updated });
      }

      // Update local state list so it updates instantly in the UI table
      setUsersList((prev) => 
        prev.map((u) => 
          u.id === selectedUser.id 
            ? { ...u, state: updatedState, updated_at: new Date().toISOString() } 
            : u
        )
      );

      // Update currently active inspected user
      setSelectedUser({
        ...selectedUser,
        state: updatedState,
        updated_at: new Date().toISOString()
      });

      alert("Node telemetry updated successfully!");
    } catch (err: any) {
      console.error("Failed to update user stats:", err);
      alert("Error updating node telemetry: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Compute overall metrics
  const totalUsers = usersList.length;
  const totalStudyHours = parseFloat(usersList.reduce((acc, u) => acc + (u.state.user?.totalStudyHours || 0), 0).toFixed(1));
  const maxStreak = usersList.reduce((acc, u) => Math.max(acc, u.state.user?.streakCount || 0), 0);
  const totalTasks = usersList.reduce((acc, u) => acc + (u.state.tasks?.length || 0), 0);
  const totalCompletedTasks = usersList.reduce((acc, u) => acc + (u.state.tasks?.filter(t => t.status === 'completed').length || 0), 0);
  const completionRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0;
  const totalAiQueries = usersList.reduce((acc, u) => acc + (u.state.chatHistory?.filter(m => m.role === 'user').length || 0), 0);
  const totalAiTokens = usersList.reduce((acc, u) => acc + Math.round((u.state.chatHistory?.reduce((sum, m) => sum + (m.content?.length || 0), 0) || 0) / 4), 0);

  // Filter user list by search query
  const filteredUsers = usersList.filter((u) => {
    const name = (u.state.user?.name || '').toLowerCase();
    const email = (u.state.user?.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query) || u.id.toLowerCase().includes(query);
  });

  const formatLastSync = (isoString: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden cyber-grid">
        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border border-cyber-purple/50 animate-ping"></div>
            <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-cyber-purple to-cyber-blue flex items-center justify-center shadow-lg shadow-cyber-purple/20">
              <span className="text-black font-mono font-bold text-2xl tracking-tighter">🔒</span>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue font-mono">
              LAYORA BACKEND
            </h1>
            <p className="text-xs text-white/60 font-mono mt-1">
              Authenticating credentials & firewall rules...
            </p>
          </div>
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyber-purple to-cyber-blue w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
          </div>
        </div>
        <style jsx global>{`
          @keyframes loading-bar {
            0% { left: -33%; width: 33%; }
            50% { width: 50%; }
            100% { left: 100%; width: 33%; }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070709] text-white p-4 md:p-8 relative overflow-x-hidden cyber-grid font-mono">
      {/* Background Neon Orbs */}
      <div className="absolute w-[600px] h-[600px] bg-cyber-purple/10 -top-[20%] -left-[10%] rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute w-[600px] h-[600px] bg-cyber-blue/10 -bottom-[20%] -right-[10%] rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Header Terminal */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue text-glow-cyan">
              ADMIN CONTROL CENTER
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSystemSync}
              disabled={isSyncingSystem}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/20 hover:from-cyber-purple/30 hover:to-cyber-blue/30 border border-cyber-purple/30 hover:border-cyber-blue text-white/90 hover:text-cyber-blue transition cursor-pointer text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSystem ? 'animate-spin' : ''}`} />
              TRIGGER GLOBAL SYNC
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={isDownloadingCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 hover:border-emerald-400 text-white/90 hover:text-emerald-400 transition cursor-pointer text-xs disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingCsv ? 'animate-pulse' : ''}`} />
              EXPORT USERS CSV
            </button>
            <button
              onClick={fetchTelemetry}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyber-blue text-white/70 hover:text-white transition cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              RELOAD DATA
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/20 hover:from-cyber-purple/30 hover:to-cyber-blue/30 border border-white/15 hover:border-cyber-blue text-white transition cursor-pointer text-xs shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              BACK TO APP
            </button>
          </div>
        </header>

        {isLocalMode && (
          <div className="p-4 rounded-xl border border-cyber-purple/35 bg-cyber-purple/5 text-cyber-purple text-xs flex items-center justify-between gap-3 shadow-lg shadow-cyber-purple/5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-cyber-purple animate-pulse shadow-glow"></span>
              <span className="font-bold tracking-wide uppercase">LOCAL SYSTEM MODE: OFFLINE TELEMETRY ACTIVE</span>
              <span className="text-[10px] text-white/50 lowercase">({usersList.length} client storage nodes loaded)</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-cyber-purple/20 text-[10px] font-bold uppercase tracking-wider border border-cyber-purple/35">ZUSTAND SYNC</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl border border-red-500/25 bg-red-950/15 text-red-300 text-xs flex items-center gap-3 shadow-lg shadow-red-500/5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-bold">SYSTEM FAILURE:</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Status Metrics Row */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-panel p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Telemetry States</div>
            <div className="text-3xl font-black text-cyber-purple mt-2 flex items-baseline gap-1 text-glow-purple">
              {totalUsers} <span className="text-xs text-white/40 font-normal">nodes</span>
            </div>
            <div className="text-[10px] text-white/50 mt-1 border-t border-white/5 pt-2 flex items-center gap-1.5">
              <Users className="w-3 h-3 text-cyber-purple" /> Active synced student profiles
            </div>
          </div>

          <div className="glass-panel p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Total Focus Time</div>
            <div className="text-3xl font-black text-cyber-blue mt-2 flex items-baseline gap-1 text-glow-cyan">
              {totalStudyHours} <span className="text-xs text-white/40 font-normal">hrs</span>
            </div>
            <div className="text-[10px] text-white/50 mt-1 border-t border-white/5 pt-2 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-cyber-blue" /> Cumulative academic hours
            </div>
          </div>

          <div className="glass-panel p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Apex User Streak</div>
            <div className="text-3xl font-black text-amber-400 mt-2 flex items-baseline gap-1 text-shadow-glow">
              {maxStreak} <span className="text-xs text-white/40 font-normal">days</span>
            </div>
            <div className="text-[10px] text-white/50 mt-1 border-t border-white/5 pt-2 flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-amber-500 animate-pulse" /> Peak system consistency
            </div>
          </div>

          <div className="glass-panel p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Task Completion</div>
            <div className="text-3xl font-black text-emerald-400 mt-2 flex items-baseline gap-1">
              {completionRate}% <span className="text-xs text-white/40 font-normal">rate</span>
            </div>
            <div className="text-[10px] text-white/50 mt-1 border-t border-white/5 pt-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {totalCompletedTasks} / {totalTasks} global tasks done
            </div>
          </div>

          <div className="glass-panel p-5 border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[110px] col-span-2 md:col-span-1">
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">AI Copilot Load</div>
            <div className="text-3xl font-black text-cyber-blue mt-2 flex items-baseline gap-1 text-glow-cyan">
              {totalAiQueries} <span className="text-xs text-white/40 font-normal">prompts</span>
            </div>
            <div className="text-[10px] text-white/50 mt-1 border-t border-white/5 pt-2 flex items-center gap-1.5 truncate">
              <Sparkles className="w-3 h-3 text-cyber-purple animate-pulse shrink-0" /> ~{(totalAiTokens).toLocaleString()} tokens consumed
            </div>
          </div>
        </section>

        {/* Database Search & List Panel */}
        <section className="glass-panel border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAdminView('nodes')}
                className={`text-xs font-mono font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                  adminView === 'nodes'
                    ? 'border-cyber-blue bg-cyber-blue/10 text-cyber-blue'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                📁 Student Nodes
              </button>
              <button
                onClick={() => setAdminView('leaderboard')}
                className={`text-xs font-mono font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                  adminView === 'leaderboard'
                    ? 'border-cyber-purple bg-cyber-purple/10 text-cyber-purple'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                🏆 Activity Leaderboard
              </button>
            </div>

            {adminView === 'nodes' ? (
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Query name, email or UUID..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyber-blue"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {(['today', 'week', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setLeaderboardRange(r)}
                    className={`px-3 py-1 rounded-lg border text-[10px] uppercase font-bold tracking-wider transition cursor-pointer ${
                      leaderboardRange === r
                        ? 'border-cyber-purple bg-cyber-purple/20 text-cyber-purple shadow-glow-purple'
                        : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {r === 'week' ? '7 Days' : r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {adminView === 'nodes' && (
            <>
              {loadingData ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyber-blue" />
                  Fetching terminal data...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  No matching database states found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal">Student Node</th>
                        <th className="p-4 font-normal">Status</th>
                        <th className="p-4 font-normal">Streak</th>
                        <th className="p-4 font-normal text-right">Study Time</th>
                        <th className="p-4 font-normal text-center">Subjects</th>
                        <th className="p-4 font-normal text-center">Tasks Done</th>
                        <th className="p-4 font-normal text-center">AI Load</th>
                        <th className="p-4 font-normal">Last Active Sync</th>
                        <th className="p-4 font-normal text-center">Diagnostics</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((u) => {
                        const uProfile = u.state.user || {};
                        const tasksList = u.state.tasks || [];
                        const completedTasks = tasksList.filter(t => t.status === 'completed').length;
                        
                        return (
                          <tr key={u.id} className="hover:bg-white/3 transition group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-cyber-blue">
                                  {uProfile.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-white group-hover:text-cyber-blue transition">{uProfile.name || 'Anonymous Student'}</div>
                                  <div className="text-[10px] text-white/40">{uProfile.email || 'No email synced'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {uProfile.isOnboarded ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-semibold">ONBOARDED</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-semibold">ONBOARDING</span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5 text-amber-500" />
                                <span className="font-bold text-white">{uProfile.streakCount || 0}d</span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="font-bold text-white">{uProfile.totalStudyHours?.toFixed(1) || '0.0'}h</div>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2 py-0.5 bg-white/5 rounded border border-white/10 font-bold">
                                {u.state.subjects?.length || 0}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                tasksList.length > 0 && completedTasks === tasksList.length 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                  : 'bg-white/5 border border-white/10 text-white/70'
                              }`}>
                                {completedTasks} / {tasksList.length}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono">
                              <div className="font-bold text-white">
                                {u.state.chatHistory?.filter(m => m.role === 'user').length || 0} <span className="text-[9px] text-white/40 font-normal">prompts</span>
                              </div>
                              <div className="text-[9px] text-cyber-purple">
                                ~{Math.round((u.state.chatHistory?.reduce((sum, m) => sum + (m.content?.length || 0), 0) || 0) / 4).toLocaleString()} tok
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="font-medium text-white/70">{formatLastSync(u.updated_at)}</div>
                              <div className="text-[9px] text-white/30 truncate max-w-[120px]">{u.id}</div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setActiveTab('profile');
                                  }}
                                  className="p-1.5 rounded-lg border border-white/10 hover:border-cyber-blue text-white/60 hover:text-cyber-blue transition cursor-pointer"
                                  title="Inspect Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(u.id)}
                                  className="p-1.5 rounded-lg border border-white/10 hover:border-red-500 text-white/60 hover:text-red-400 transition cursor-pointer"
                                  title="Purge Sync State"
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
            </>
          )}

          {adminView === 'leaderboard' && (
            <div>
              {loadingLeaderboard ? (
                <div className="p-12 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-cyber-purple" />
                  Compiling leaderboard ranks...
                </div>
              ) : leaderboardError ? (
                <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                  <span>{leaderboardError}</span>
                  <button
                    onClick={() => fetchLeaderboard(leaderboardRange)}
                    className="mt-3 px-3 py-1.5 bg-rose-950/30 border border-rose-500/25 hover:bg-rose-950/50 text-rose-300 rounded-lg text-[10px] font-bold transition cursor-pointer"
                  >
                    RETRY SYNC FETCH
                  </button>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-xs">
                  No daily activity ledger entries registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                        <th className="p-4 font-normal text-center w-16">Rank</th>
                        <th className="p-4 font-normal">Student</th>
                        <th className="p-4 font-normal">Linked Accounts</th>
                        <th className="p-4 font-normal text-right">LC Solves</th>
                        <th className="p-4 font-normal text-right">CC Solves</th>
                        <th className="p-4 font-normal text-right">GitHub Contributions</th>
                        <th className="p-4 font-normal text-right">Points Earned</th>
                        <th className="p-4 font-normal text-center">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {leaderboard.map((item, index) => {
                        const isTopThree = index < 3;
                        const rankColors = [
                          'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
                          'text-slate-300 border-slate-400/30 bg-slate-400/5',
                          'text-amber-600 border-amber-600/30 bg-amber-600/5'
                        ];
                        
                        return (
                          <tr key={item.userId} className="hover:bg-white/3 transition group">
                            <td className="p-4 text-center font-black text-sm">
                              {isTopThree ? (
                                <span className={`inline-flex w-7 h-7 rounded-full border items-center justify-center font-extrabold ${rankColors[index]}`}>
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                </span>
                              ) : (
                                <span className="text-white/40">#{index + 1}</span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-cyber-purple">
                                  {item.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-white group-hover:text-cyber-purple transition">{item.name || 'Anonymous Student'}</div>
                                  <div className="text-[9px] text-white/30 truncate max-w-[150px]">{item.userId}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1.5">
                                {item.leetcodeUsername ? (
                                  <a
                                    href={item.leetcodeUsername.trim().startsWith('http') ? item.leetcodeUsername.trim() : `https://leetcode.com/u/${item.leetcodeUsername.trim()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/25 hover:border-yellow-500/40 text-[10px] text-yellow-500 font-bold transition duration-200 cursor-pointer w-fit"
                                  >
                                    💡 leetcode: <strong className="text-white hover:underline">{item.leetcodeUsername}</strong>
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-white/20 font-mono italic">No LeetCode linked</span>
                                )}
                                {item.codechefUsername ? (
                                  <a
                                    href={item.codechefUsername.trim().startsWith('http') ? item.codechefUsername.trim() : `https://www.codechef.com/users/${item.codechefUsername.trim()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 hover:border-orange-500/40 text-[10px] text-orange-500 font-bold transition duration-200 cursor-pointer w-fit"
                                  >
                                    🍳 codechef: <strong className="text-white hover:underline">{item.codechefUsername}</strong>
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-white/20 font-mono italic">No CodeChef linked</span>
                                )}
                                {item.githubUsername ? (
                                  <a
                                    href={item.githubUsername.trim().startsWith('http') ? item.githubUsername.trim() : `https://github.com/${item.githubUsername.trim()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyber-blue/10 hover:bg-cyber-blue/20 border border-cyber-blue/25 hover:border-cyber-blue/40 text-[10px] text-cyber-blue font-bold transition duration-200 cursor-pointer w-fit"
                                  >
                                    🐙 github: <strong className="text-white hover:underline">{item.githubUsername}</strong>
                                  </a>
                                ) : (
                                  <span className="text-[9px] text-white/20 font-mono italic">No GitHub linked</span>
                                )}
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
                              <span className="px-3 py-1 bg-cyber-purple/10 border border-cyber-purple/20 text-cyber-purple rounded-lg font-black text-sm text-glow-purple">
                                {item.totalPoints} pts
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => setSelectedLeaderboardUser(item)}
                                className="p-1.5 rounded-lg border border-white/10 hover:border-cyber-blue text-white/60 hover:text-cyber-blue transition cursor-pointer"
                                title="Inspect Accounts"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

      </div>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-red-500/30 p-6 rounded-2xl max-w-sm w-full relative z-10 bg-[#0F0F16]"
            >
              <div className="flex items-center gap-3 text-red-400">
                <Trash2 className="w-6 h-6 animate-bounce" />
                <h3 className="text-base font-black tracking-wider uppercase">PURGE SYNC DATA</h3>
              </div>
              <p className="text-xs text-white/60 font-mono mt-3 leading-relaxed">
                This operations deletes document <span className="text-red-400 font-semibold">{showDeleteConfirm}</span> from Supabase. All database sync keys and chat history for this user will be deleted.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  ABORT
                </button>
                <button
                  onClick={() => handleDeleteRecord(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-950/45 hover:bg-red-900 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  CONFIRM PURGE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Details Inspector Modal/Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-screen bg-[#0c0d12]/95 border-l border-white/10 flex flex-col z-10 shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/10 bg-white/2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue font-bold text-lg">
                    {selectedUser.state.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{selectedUser.state.user?.name || 'Anonymous Student'}</h3>
                    <p className="text-[10px] text-white/40">{selectedUser.state.user?.email || selectedUser.id}</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Navigation Tabs */}
              <div className="flex border-b border-white/5 bg-black/40 overflow-x-auto shrink-0 scrollbar-none">
                {(['profile', 'subjects', 'tasks', 'courses', 'timetable', 'certificates', 'chat'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-[10px] font-bold tracking-wider uppercase border-b-2 whitespace-nowrap transition cursor-pointer ${
                      activeTab === tab
                        ? 'border-cyber-blue text-cyber-blue bg-white/2'
                        : 'border-transparent text-white/40 hover:text-white/80'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Drawer Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Tab Profile */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/2 border border-white/5 rounded-xl p-4">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-cyber-blue" /> College Timings
                        </div>
                        <div className="mt-2 text-xs font-bold text-white">
                          {selectedUser.state.user?.collegeStart || 'Not Configured'} - {selectedUser.state.user?.collegeEnd || 'Not Configured'}
                        </div>
                      </div>

                      <div className="bg-white/2 border border-white/5 rounded-xl p-4">
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyber-purple" /> Circadian Cycle
                        </div>
                        <div className="mt-2 text-xs font-bold text-white">
                          Wake: {selectedUser.state.user?.wakeTime || '06:00'} | Sleep: {selectedUser.state.user?.sleepTime || '22:00'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-500" /> Monitored Platforms
                      </div>
                      {selectedUser.state.websites && selectedUser.state.websites.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {selectedUser.state.websites.map((w) => (
                            <div key={w.name} className="p-2 border border-white/5 rounded-lg bg-black/40 flex items-center justify-between text-xs">
                              <span className="font-semibold text-white">{w.name}</span>
                              <span className="text-[10px] text-white/40">{w.timeSpentGoal}m goal</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30 font-normal">No custom websites registered for monitoring.</p>
                      )}
                    </div>

                    <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                      <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyber-blue" /> Scheduled Free Time Blocks
                      </div>
                      {selectedUser.state.user?.freeBlocks && selectedUser.state.user.freeBlocks.length > 0 ? (
                        <div className="space-y-1.5">
                          {selectedUser.state.user.freeBlocks.map((fb, idx) => (
                            <div key={idx} className="p-2.5 border border-white/5 rounded-lg bg-black/40 flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{fb.label || `Free Block ${idx + 1}`}</span>
                              <span className="font-mono text-cyber-blue">{fb.start} - {fb.end}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-white/30 font-normal">No free time slots added to circadian planner.</p>
                      )}
                    </div>

                    {/* Administrative Override panel */}
                    <div className="bg-white/2 border border-cyber-purple/20 rounded-xl p-4 space-y-4">
                      <div className="text-[10px] text-cyber-purple font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5" /> Administrative Telemetry Override
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/50 font-mono uppercase">Streak Count (days)</label>
                          <input
                            type="number"
                            value={editStreak}
                            onChange={(e) => setEditStreak(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyber-purple"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] text-white/50 font-mono uppercase">Study Focus Hours (hrs)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editHours}
                            onChange={(e) => setEditHours(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-cyber-purple"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleUpdateUserStats}
                        disabled={isSavingEdit}
                        className="w-full flex items-center justify-center gap-2 border border-cyber-purple/30 hover:border-cyber-purple bg-cyber-purple/10 hover:bg-cyber-purple/25 text-cyber-purple hover:text-white py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        {isSavingEdit ? "SAVING NODE..." : "WRITE DATA OVERRIDE"}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Tab Subjects */}
                {activeTab === 'subjects' && (
                  <div className="space-y-4">
                    {selectedUser.state.subjects && selectedUser.state.subjects.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.state.subjects.map((sub) => (
                          <div key={sub.id} className="p-4 border border-white/5 rounded-xl bg-white/2 flex items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{sub.name}</span>
                                <span className="text-[10px] font-mono bg-cyber-blue/15 text-cyber-blue px-1.5 py-0.5 rounded border border-cyber-blue/20">{sub.code}</span>
                              </div>
                              <div className="text-[10px] text-white/40 mt-1 font-mono">Difficulty: {sub.difficulty} | Credits: {sub.credits}</div>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              sub.priority === 'High' 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                : sub.priority === 'Medium' 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {sub.priority.toUpperCase()} PRIORITY
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No academic subjects configured by this student.</div>
                    )}
                  </div>
                )}

                {/* 3. Tab Tasks */}
                {activeTab === 'tasks' && (
                  <div className="space-y-4">
                    {selectedUser.state.tasks && selectedUser.state.tasks.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.state.tasks.map((task) => (
                          <div key={task.id} className="p-3 border border-white/5 rounded-xl bg-white/2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className={`text-xs font-bold text-white truncate ${task.status === 'completed' ? 'line-through text-white/40' : ''}`}>{task.title}</h4>
                              <div className="text-[9px] text-white/40 mt-1 font-mono truncate">Subject: {task.subjectName || 'General'} | Due: {task.deadline}</div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] text-white/50 font-mono">{task.actualMinutesSpent} / {task.estimatedMinutes}m</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                task.status === 'completed' 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' 
                                  : task.status === 'in_progress'
                                  ? 'bg-cyber-blue/15 text-cyber-blue border border-cyber-blue/25 animate-pulse'
                                  : 'bg-white/5 border border-white/10 text-white/50'
                              }`}>
                                {task.status.toUpperCase().replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No active tasks registered.</div>
                    )}
                  </div>
                )}

                {/* 4. Tab Courses */}
                {activeTab === 'courses' && (
                  <div className="space-y-4">
                    {selectedUser.state.courses && selectedUser.state.courses.length > 0 ? (
                      <div className="space-y-3">
                        {selectedUser.state.courses.map((course) => (
                          <div key={course.id} className="p-4 border border-white/5 rounded-xl bg-white/2 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-white">{course.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-white/40 font-mono">
                                    {getPlatformDisplay(course.platform)} • Due {course.deadline}
                                  </span>
                                  {course.platform && course.platform.startsWith('http') && (
                                    <a
                                      href={course.platform}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[9px] text-cyber-blue hover:underline flex items-center gap-0.5"
                                    >
                                      Visit <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-cyber-blue font-bold font-mono">{course.progress}%</span>
                            </div>

                            <div className="progress-track">
                              <div className="progress-fill bg-cyber-blue" style={{ width: `${course.progress}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No online courses enrolled.</div>
                    )}
                  </div>
                )}

                {/* 5. Tab Timetable */}
                {activeTab === 'timetable' && (
                  <div className="space-y-3">
                    {selectedUser.state.timetable && selectedUser.state.timetable.length > 0 ? (
                      <div className="space-y-2">
                        {selectedUser.state.timetable.map((block) => {
                          const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          return (
                            <div key={block.id} className="p-3 border border-white/5 rounded-xl bg-white/2 flex items-center justify-between text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{block.title}</span>
                                  <span className="text-[9px] bg-white/5 px-1 rounded text-white/40 font-mono uppercase">{block.type}</span>
                                </div>
                                <div className="text-[10px] text-white/40 mt-1 font-mono">
                                  {daysOfWeek[block.day]} • {block.start} - {block.end} {block.subjectCode ? `(${block.subjectCode})` : ''}
                                </div>
                              </div>

                              {block.completed && (
                                <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">COMPLETED</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No weekly schedule blocks compiled yet.</div>
                    )}
                  </div>
                )}

                {/* 5.5 Tab Certificates */}
                {activeTab === 'certificates' && (
                  <div className="space-y-4">
                    {loadingInspectedCerts ? (
                      <div className="p-8 text-center text-white/40 text-xs flex flex-col items-center gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin text-cyber-blue" />
                        Fetching academic certificates...
                      </div>
                    ) : inspectedCerts.length === 0 ? (
                      <div className="text-center py-8 text-white/30 text-xs">
                        No verified credentials or skill certificates uploaded by this user.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {inspectedCerts.map((cert) => (
                          <div key={cert.id} className="bg-black/45 border border-white/5 rounded-xl overflow-hidden flex flex-col justify-between hover:border-cyber-blue/30 transition group">
                            <div 
                              className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden border-b border-white/5 cursor-pointer"
                              onClick={() => setActiveCertPreview(cert)}
                            >
                              <img src={cert.file_url} alt={cert.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition animate-fade-in">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <div className="p-3 space-y-1.5">
                              <div>
                                <h4 className="text-xs font-bold text-white line-clamp-1">{cert.name}</h4>
                                <span className="inline-block text-[8px] font-bold tracking-wider px-1.5 py-0.5 mt-1 bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue rounded uppercase">
                                  {cert.platform}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-white/40 pt-1.5 border-t border-white/5">
                                <span>{new Date(cert.created_at).toLocaleDateString()}</span>
                                <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-cyber-blue hover:underline flex items-center gap-0.5">
                                  Original <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Tab Chat History */}
                {activeTab === 'chat' && (
                  <div className="space-y-4">
                    {selectedUser.state.chatHistory && selectedUser.state.chatHistory.length > 0 ? (
                      <div className="space-y-3">
                        {selectedUser.state.chatHistory.map((chat) => (
                          <div key={chat.id} className={`flex flex-col ${chat.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className="text-[9px] text-white/35 mb-1 font-mono">{chat.role === 'user' ? 'User' : 'Assistant'} • {chat.timestamp}</div>
                            <div className={`p-3 rounded-xl text-xs leading-relaxed max-w-[85%] font-sans ${
                              chat.role === 'user'
                                ? 'bg-cyber-purple/20 text-white rounded-tr-none border border-cyber-purple/25'
                                : 'bg-white/5 text-white/80 rounded-tl-none border border-white/10'
                            }`}>
                              {chat.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/30 text-xs">No AI conversation log records found.</div>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard User Details Inspector Modal */}
      <AnimatePresence>
        {selectedLeaderboardUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLeaderboardUser(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-cyber-purple/30 p-6 rounded-2xl max-w-md w-full relative z-10 bg-[#0F0F16]"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyber-purple/15 border border-cyber-purple/35 flex items-center justify-center font-bold text-sm text-cyber-purple">
                    {selectedLeaderboardUser.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{selectedLeaderboardUser.name || 'Anonymous Student'}</h3>
                    <p className="text-[10px] text-white/40">{selectedLeaderboardUser.userId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLeaderboardUser(null)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="bg-white/2 border border-white/5 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">
                    Points Summary
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">Points</div>
                      <div className="text-sm font-black text-cyber-purple mt-0.5">{selectedLeaderboardUser.totalPoints}</div>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">LeetCode</div>
                      <div className="text-sm font-black text-yellow-500 mt-0.5">{selectedLeaderboardUser.totalLeetcodeSolved}</div>
                    </div>
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-white/40 font-bold">GitHub</div>
                      <div className="text-sm font-black text-cyber-blue mt-0.5">{selectedLeaderboardUser.totalGithubContributions}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">
                    Social & Dev Profiles
                  </span>
                  
                  {/* GitHub Profile Button */}
                  {selectedLeaderboardUser.githubUsername ? (
                    <a
                      href={selectedLeaderboardUser.githubUsername.trim().startsWith('http') ? selectedLeaderboardUser.githubUsername.trim() : `https://github.com/${selectedLeaderboardUser.githubUsername.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-cyber-blue/10 hover:bg-cyber-blue/20 border border-cyber-blue/25 hover:border-cyber-blue/50 text-cyber-blue font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        🐙 GitHub Profile
                      </span>
                      <span className="text-white text-[10px]">{selectedLeaderboardUser.githubUsername}</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>🐙 GitHub Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}

                  {/* LeetCode Profile Button */}
                  {selectedLeaderboardUser.leetcodeUsername ? (
                    <a
                      href={selectedLeaderboardUser.leetcodeUsername.trim().startsWith('http') ? selectedLeaderboardUser.leetcodeUsername.trim() : `https://leetcode.com/u/${selectedLeaderboardUser.leetcodeUsername.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/25 hover:border-yellow-500/50 text-yellow-500 font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        💡 LeetCode Profile
                      </span>
                      <span className="text-white text-[10px]">{selectedLeaderboardUser.leetcodeUsername}</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>💡 LeetCode Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}

                  {/* CodeChef Profile Button */}
                  {selectedLeaderboardUser.codechefUsername ? (
                    <a
                      href={selectedLeaderboardUser.codechefUsername.trim().startsWith('http') ? selectedLeaderboardUser.codechefUsername.trim() : `https://www.codechef.com/users/${selectedLeaderboardUser.codechefUsername.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 hover:border-orange-500/50 text-orange-500 font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        🍳 CodeChef Profile
                      </span>
                      <span className="text-white text-[10px]">{selectedLeaderboardUser.codechefUsername}</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>🍳 CodeChef Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}

                  {/* LinkedIn Profile Button */}
                  {selectedLeaderboardUser.linkedinUrl ? (
                    <a
                      href={selectedLeaderboardUser.linkedinUrl.trim().startsWith('http') ? selectedLeaderboardUser.linkedinUrl.trim() : `https://${selectedLeaderboardUser.linkedinUrl.trim()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 hover:border-blue-500/50 text-blue-400 font-bold text-xs transition duration-200 cursor-pointer shadow-md"
                    >
                      <span className="flex items-center gap-2">
                        🔗 LinkedIn Profile
                      </span>
                      <span className="text-white text-[10px] truncate max-w-[200px]">View Profile</span>
                    </a>
                  ) : (
                    <div className="w-full flex items-center justify-between p-3 rounded-xl bg-white/2 border border-white/5 text-white/30 text-xs italic">
                      <span>🔗 LinkedIn Profile</span>
                      <span>Not linked</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedLeaderboardUser(null)}
                  className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspected Certificate Image Lightbox Overlay */}
      <AnimatePresence>
        {activeCertPreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCertPreview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel border border-white/10 p-4 rounded-2xl max-w-3xl w-full relative z-10 bg-[#0F0F16] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-white">{activeCertPreview.name}</h3>
                  <p className="text-[9px] text-white/40 uppercase font-mono mt-0.5">{activeCertPreview.platform} credential</p>
                </div>
                <button
                  onClick={() => setActiveCertPreview(null)}
                  className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-black/50 p-2 rounded-lg flex items-center justify-center overflow-auto max-h-[60vh]">
                <img src={activeCertPreview.file_url} alt={activeCertPreview.name} className="max-w-full max-h-[50vh] object-contain rounded-lg border border-white/5" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  );
}
