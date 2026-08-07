'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { 
  ShieldAlert, UserCheck, LogOut, ArrowRight, Sparkles, 
  CalendarRange, CheckSquare, Globe, Trophy, Shield 
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { isAdminEmail } from '@/lib/admin';

export default function RootPage() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const store = useStore();
  const [showPortal, setShowPortal] = useState(false);
  const [showLanding, setShowLanding] = useState(false);

  const handleLogout = async () => {
    store.logout();
    await signOut();
    router.replace('/login');
  };

  useEffect(() => {
    if (!isAuthLoaded || !isUserLoaded) return;

    if (isSignedIn) {
      const email = user?.primaryEmailAddress?.emailAddress || '';
      if (isAdminEmail(email)) {
        setShowPortal(true);
      } else {
        const timeout = setTimeout(() => {
          router.replace('/dashboard');
        }, 500);
        return () => clearTimeout(timeout);
      }
    } else {
      setShowLanding(true);
    }
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, router]);

  // Render Admin/User Portal selection screen (if admin user is signed in)
  if (showPortal) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden p-6 cyber-grid">
        <div className="absolute w-[500px] h-[500px] bg-cyber-purple/15 -top-[10%] -right-[10%] rounded-full blur-[120px] animate-[pulse_8s_infinite_alternate] pointer-events-none"></div>
        <div className="absolute w-[500px] h-[500px] bg-cyber-blue/15 -bottom-[10%] -left-[10%] rounded-full blur-[120px] animate-[pulse_10s_infinite_alternate] pointer-events-none"></div>

        <div className="z-10 w-full max-w-lg flex flex-col items-center text-center gap-8">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyber-purple to-cyber-blue blur opacity-75 animate-pulse"></div>
            <div className="relative w-20 h-20 rounded-full bg-black border border-white/20 flex items-center justify-center">
              <span className="text-3xl">👑</span>
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue text-glow-cyan font-geist">
              HELLO BOSS!!
            </h1>
            <p className="text-sm text-white/50 font-mono mt-2">
              Select your access terminal:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-4">
            <button
              onClick={() => router.push('/admin')}
              className="glass-card hover:border-cyber-purple border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 transition duration-300 group cursor-pointer"
              style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)' }}
            >
              <div className="w-12 h-12 rounded-xl bg-cyber-purple/10 border border-cyber-purple/30 flex items-center justify-center text-cyber-purple group-hover:bg-cyber-purple/20 transition">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-geist font-bold text-sm text-white group-hover:text-cyber-purple transition">
                  ADMIN PORTAL
                </h3>
                <p className="text-[10px] text-white/40 mt-1 font-mono leading-relaxed">
                  Monitor telemetry, user database state, and operational analytics.
                </p>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="glass-card hover:border-cyber-blue border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 transition duration-300 group cursor-pointer"
              style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)' }}
            >
              <div className="w-12 h-12 rounded-xl bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue group-hover:bg-cyber-blue/20 transition">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-geist font-bold text-sm text-white group-hover:text-cyber-blue transition">
                  USER PORTAL
                </h3>
                <p className="text-[10px] text-white/40 mt-1 font-mono leading-relaxed">
                  Launch the standard student workspace planner, logs, and calendar.
                </p>
              </div>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2 rounded-xl text-xs font-mono transition cursor-pointer mt-4"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </main>
    );
  }

  // Render Public Landing/Introduction page (for unauthenticated users & Google Reviewers)
  if (showLanding) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-between relative overflow-x-hidden p-6 md:p-12 cyber-grid">
        {/* Glow Orbs */}
        <div className="absolute w-[500px] h-[500px] bg-cyber-purple/15 -top-[10%] -right-[10%] rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute w-[500px] h-[500px] bg-cyber-blue/15 -bottom-[10%] -left-[10%] rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top Navbar */}
        <header className="w-full max-w-5xl z-10 flex items-center justify-between border-b border-white/10 pb-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyber-purple to-cyber-blue flex items-center justify-center border border-white/15">
              <span className="text-white font-mono font-black text-xs">L</span>
            </div>
            <span className="font-mono font-bold tracking-widest text-white text-sm">LAYORA</span>
          </div>
          <button 
            onClick={() => router.push('/login')} 
            className="px-4 py-1.5 rounded-xl border border-white/10 hover:border-cyber-blue/30 bg-white/3 hover:bg-cyber-blue/5 text-xs font-mono font-semibold tracking-wider text-white hover:text-cyber-blue transition cursor-pointer"
          >
            SIGN IN
          </button>
        </header>

        {/* Hero Section */}
        <div className="w-full max-w-4xl z-10 flex flex-col items-center text-center gap-8 py-8">
          <div className="inline-flex items-center gap-2 bg-cyber-purple/10 border border-cyber-purple/20 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider text-cyber-purple uppercase">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            AI Student Productivity Suite
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-geist leading-tight">
              Optimize Your Schedule with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple via-cyber-blue to-cyan-300 text-glow-cyan">
                Layora
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-white/70 max-w-2xl mx-auto leading-relaxed font-mono">
              Welcome to Layora — the next-generation academic workspace. We leverage artificial intelligence to design custom study timetables, manage tasks, track metrics, and sync calendars for an optimized student routine.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center mt-4">
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-3 rounded-xl bg-primary text-on-surface hover:bg-primary-container text-xs font-mono font-bold tracking-widest transition flex items-center gap-2 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(176,38,255,0.25)]"
            >
              LAUNCH APP <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#features"
              className="px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/3 text-xs font-mono font-semibold tracking-widest text-white hover:bg-white/5 transition flex items-center gap-2 cursor-pointer"
            >
              EXPLORE FEATURES
            </a>
          </div>
        </div>

        {/* Features section for Google's verification reviewers */}
        <div id="features" className="w-full max-w-5xl z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-12 border-t border-white/5 mt-12 text-left">
          <div className="glass-card border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyber-purple/10 border border-cyber-purple/20 flex items-center justify-center text-cyber-purple">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-geist font-bold text-xs text-white">AI Planner</h3>
            <p className="text-[10px] text-white/50 leading-relaxed font-mono">
              Build optimal study blocks, routines, and rest breaks customized around subject difficulty, credits, and goals.
            </p>
          </div>

          <div className="glass-card border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyber-blue/10 border border-cyber-blue/20 flex items-center justify-center text-cyber-blue">
              <CalendarRange className="w-4 h-4" />
            </div>
            <h3 className="font-geist font-bold text-xs text-white">Google Calendar Sync</h3>
            <p className="text-[10px] text-white/50 leading-relaxed font-mono">
              Connect your Google account to synchronize your AI-generated timetable blocks straight to your Google Calendar.
            </p>
          </div>

          <div className="glass-card border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-9 h-9 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Globe className="w-4 h-4" />
            </div>
            <h3 className="font-geist font-bold text-xs text-white">Global Shared Library</h3>
            <p className="text-[10px] text-white/50 leading-relaxed font-mono">
              Share study materials, notes, and resources publicly by sharing verified URLs and drive folders with fellow peers.
            </p>
          </div>

          <div className="glass-card border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Trophy className="w-4 h-4" />
            </div>
            <h3 className="font-geist font-bold text-xs text-white">Focus Leaderboard</h3>
            <p className="text-[10px] text-white/50 leading-relaxed font-mono">
              Input LeetCode, GitHub, or Codechef handles to track points and rank in real-time on active student leaderboards.
            </p>
          </div>
        </div>

        {/* Data Security & Integration Details */}
        <div className="w-full max-w-5xl z-10 glass-card border border-white/5 bg-white/[0.01] rounded-2xl p-6 md:p-8 space-y-4 text-left font-mono mt-8 leading-relaxed">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-white font-bold text-xs">
            <Shield className="w-4 h-4 text-cyber-blue" />
            <span>Google API Integration & Scope Usage Info</span>
          </div>
          <p className="text-[10px] text-white/60">
            Layora provides an optional Integration with Google APIs to synchronize your student study schedule.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[9px] text-white/55">
            <li>
              <strong>Scope Used:</strong> <code className="bg-white/5 px-1 py-0.5 rounded text-cyber-purple">https://www.googleapis.com/auth/calendar</code> (Google Calendar API).
            </li>
            <li>
              <strong>Purpose:</strong> We request this permission to insert AI-generated timetable block sessions (lectures, self-study times, routines) as weekly recurring events on your primary Google Calendar.
            </li>
            <li>
              <strong>Privacy Protection:</strong> Layora does not read, modify, or delete any other events on your Google Calendar, and does not store or share your Google login credentials or calendar data with third parties.
            </li>
          </ul>
        </div>

        {/* Footer */}
        <footer className="w-full max-w-5xl z-10 border-t border-white/10 pt-6 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[9px] text-white/40">
          <span>© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-cyber-blue transition underline">Privacy Policy</a>
            <a href="/terms" className="hover:text-cyber-blue transition underline">Terms & Conditions</a>
          </div>
        </footer>
      </main>
    );
  }

  // Loading screen (displayed while authentication state loads)
  return (
    <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden p-6 cyber-grid">
      <div className="z-10 flex flex-col items-center gap-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border border-primary animate-ping"></div>
          <div className="absolute inset-2 rounded-full border border-blue-500/50 animate-pulse"></div>
          <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-on-surface font-mono font-bold text-2xl tracking-tighter">L</span>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-mono animate-pulse">
            LAYORA
          </h1>
          <p className="text-xs text-primary/60 font-mono mt-1">
            Synchronizing academic core...
          </p>
        </div>

        <div className="w-48 h-1 bg-surface-container rounded-full overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
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
