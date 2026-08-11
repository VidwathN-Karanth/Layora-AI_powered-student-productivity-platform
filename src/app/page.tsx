'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { 
  ShieldAlert, UserCheck, LogOut, ArrowRight, Sparkles, 
  CalendarRange, CheckSquare, Globe, Trophy, Shield, 
  Layers, ChevronDown, CheckCircle, Code, Terminal, Crown
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { isAdminEmail } from '@/lib/admin';
import { motion, AnimatePresence } from 'framer-motion';

// Spring-based Entrance Wrapper
const SpringReveal = ({ 
  children, 
  direction = 'up', 
  delay = 0,
  className = ""
}: { 
  children: React.ReactNode; 
  direction?: 'up' | 'down' | 'left' | 'right'; 
  delay?: number;
  className?: string;
}) => {
  const directions = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 }
  };
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...directions[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ type: 'spring', stiffness: 100, damping: 20, delay }}
    >
      {children}
    </motion.div>
  );
};

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
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden p-6">
        {/* Subtle noise background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        
        <div className="z-10 w-full max-w-lg flex flex-col items-center text-center gap-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 shadow-[0_0_40px_rgba(0,122,255,0.2)] flex items-center justify-center"
          >
            <Crown className="w-8 h-8 text-primary drop-shadow-[0_0_10px_rgba(0,122,255,0.8)]" />
          </motion.div>

          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-geist">
              Welcome back
            </h1>
            <p className="text-xs text-white/50 mt-2 font-jetbrains uppercase tracking-widest">
              Select your access portal
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/admin')}
              className="group border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 transition-colors duration-300 bg-[#121214]/60 hover:bg-[#1C1C1E]/80 backdrop-blur-xl cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-geist tracking-wide">
                  ADMIN PORTAL
                </h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  Monitor telemetry, user database state, and operational analytics.
                </p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/dashboard')}
              className="group border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 transition-colors duration-300 bg-[#121214]/60 hover:bg-[#1C1C1E]/80 backdrop-blur-xl cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-geist tracking-wide">
                  USER PORTAL
                </h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  Launch the standard student workspace planner, logs, and calendar.
                </p>
              </div>
            </motion.button>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer mt-4"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </main>
    );
  }

  // Render Public Landing/Introduction page
  if (showLanding) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center relative overflow-x-hidden scroll-smooth font-geist">
        {/* Subtle noise background for depth */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>
        
        {/* Top-level Mesh Gradient Blur */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>

        {/* --- GLOBAL STICKY HEADER --- */}
        <header className="w-full max-w-6xl z-40 sticky top-4 px-6 py-3.5 bg-[#070709]/70 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center justify-between mt-4 mx-4 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(0,122,255,0.4)]">
              <span className="text-white font-bold text-xs">L</span>
            </div>
            <span className="font-bold tracking-wide text-white text-sm">LAYORA</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-white/50">
            <a href="#dashboard" className="hover:text-white transition">Workspace</a>
            <a href="#resources" className="hover:text-white transition">Vault</a>
            <a href="#global-resources" className="hover:text-white transition">Shared Library</a>
            <a href="#courses" className="hover:text-white transition">Courses</a>
            <a href="#leaderboard" className="hover:text-white transition">Scoreboard</a>
            <a href="/privacy" className="text-primary hover:text-primary-fixed-dim transition font-semibold">Privacy</a>
          </nav>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/login')} 
              className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-xs font-semibold text-white/70 hover:text-white transition cursor-pointer"
            >
              Log in
            </button>
            <button 
              onClick={() => router.push('/login')} 
              className="px-4 py-2 rounded-xl bg-primary hover:bg-[#0055CC] shadow-[0_0_20px_rgba(0,122,255,0.3)] text-xs font-bold text-white transition cursor-pointer"
            >
              Sign up
            </button>
          </div>
        </header>

        {/* ================= HERO SECTION ================= */}
        <section className="w-full max-w-5xl z-10 flex flex-col items-center text-center gap-8 py-24 px-6 min-h-[90vh] justify-center relative">
          <SpringReveal direction="up" delay={0.1}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-4 font-jetbrains">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Generation Student Suite</span>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter font-geist leading-[1.1] max-w-4xl">
              Unify your academic life with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-[#AF52DE]">Layora</span>
            </h1>
          </SpringReveal>

          <SpringReveal direction="up" delay={0.2}>
            <p className="text-sm sm:text-base text-white/50 max-w-2xl mx-auto leading-relaxed">
              Plan study timetables, manage certifications, sync to Google Calendar, organize resources by subject, and compete on coding scoreboards — all in one workspace.
            </p>
          </SpringReveal>

          <SpringReveal direction="up" delay={0.3}>
            <div className="flex flex-wrap gap-4 justify-center mt-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/login')}
                className="px-8 py-4 rounded-xl bg-primary text-white shadow-[0_0_30px_rgba(0,122,255,0.4)] hover:shadow-[0_0_40px_rgba(0,122,255,0.6)] text-sm font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                Get started <ArrowRight className="w-4 h-4" />
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="#dashboard"
                className="px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-sm font-semibold text-white/80 hover:text-white transition flex items-center gap-2 cursor-pointer backdrop-blur-md"
              >
                Explore features <ChevronDown className="w-4 h-4" />
              </motion.a>
            </div>
          </SpringReveal>

          {/* Product screenshot with dramatic glass frame */}
          <SpringReveal direction="up" delay={0.4} className="w-full">
            <div className="relative mt-16 w-full max-w-5xl mx-auto rounded-2xl overflow-hidden bg-black border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] group p-2">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
              <img 
                src="/images/landing/media__1786098306851.png" 
                alt="Layora Workspace Dashboard" 
                className="w-full rounded-xl object-cover border border-white/5 group-hover:scale-[1.01] transition-transform duration-700 ease-out"
              />
            </div>
          </SpringReveal>

          <p className="text-xs text-white/30 max-w-2xl leading-relaxed mt-8 font-jetbrains text-center">
            Layora is an AI-powered student productivity platform that helps university students optimize study schedules, manage task deadlines, organize resource vaults, and synchronize planner events to Google Calendar.
          </p>
        </section>


        {/* ================= BENTO BOX FEATURES ================= */}
        <section id="features" className="w-full py-24 px-6 z-10 relative">
          <div className="w-full max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight font-geist text-white">
                Everything you need to <span className="text-primary">excel.</span>
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-[360px] gap-6">
              
              {/* Feature 1: Unified Dashboard (Large Span) */}
              <SpringReveal delay={0.1} className="md:col-span-8 group relative overflow-hidden rounded-3xl border border-white/10 bg-[#121214]/60 backdrop-blur-xl p-8 flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/20 transition-colors duration-700"></div>
                <div className="z-10 max-w-md">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary mb-4 border border-primary/30">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 id="dashboard" className="text-2xl font-bold tracking-tight text-white mb-2">Unified Dashboard</h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    Your command center. See daily schedules, active learning tracks, and streak points at a glance. Direct access to AI Assistants.
                  </p>
                </div>
                <div className="z-10 mt-6 relative rounded-xl border border-white/5 overflow-hidden shadow-2xl">
                   <img src="/images/landing/media__1786098306851.png" alt="Active Workspace Dashboard" className="w-full object-cover translate-y-4 group-hover:translate-y-0 transition-transform duration-500" />
                </div>
              </SpringReveal>

              {/* Feature 2: Vault (Small Span) */}
              <SpringReveal delay={0.2} className="md:col-span-4 group relative overflow-hidden rounded-3xl border border-white/10 bg-[#121214]/60 backdrop-blur-xl p-8 flex flex-col justify-between">
                <div className="z-10">
                  <div className="w-10 h-10 rounded-lg bg-[#AF52DE]/20 flex items-center justify-center text-[#AF52DE] mb-4 border border-[#AF52DE]/30">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 id="resources" className="text-2xl font-bold tracking-tight text-white mb-2">Personal Vault</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-6">
                    Lecture notes, syllabi, and cheat sheets indexed by subject. Direct Google Drive upload.
                  </p>
                </div>
                <div className="z-10 relative rounded-xl border border-white/5 overflow-hidden mt-auto">
                   <img src="/images/landing/media__1786090592904.png" alt="Personal Subject Resource Vault" className="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              </SpringReveal>

              {/* Feature 3: Global Library (Small Span) */}
              <SpringReveal delay={0.3} className="md:col-span-4 group relative overflow-hidden rounded-3xl border border-white/10 bg-[#121214]/60 backdrop-blur-xl p-8 flex flex-col justify-between">
                <div className="z-10">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 mb-4 border border-green-500/30">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 id="global-resources" className="text-2xl font-bold tracking-tight text-white mb-2">Global Library</h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-6">
                    Share and discover public study documents. Dynamic previews and format support.
                  </p>
                </div>
                <div className="z-10 relative rounded-xl border border-white/5 overflow-hidden mt-auto">
                   <img src="/images/landing/media__1786090952365.png" alt="Global Shared Resources Preview" className="w-full h-32 object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              </SpringReveal>

              {/* Feature 4: Leaderboard & Courses (Large Span) */}
              <SpringReveal delay={0.4} className="md:col-span-8 group relative overflow-hidden rounded-3xl border border-white/10 bg-[#121214]/60 backdrop-blur-xl p-8 flex flex-col justify-between">
                <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-primary/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/20 transition-colors duration-700"></div>
                <div className="z-10 flex flex-col sm:flex-row gap-8 justify-between h-full">
                  <div className="flex-1 max-w-sm">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 mb-4 border border-orange-500/30">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <h3 id="courses" className="text-2xl font-bold tracking-tight text-white mb-2">Scoreboard & Bootcamps</h3>
                    <p className="text-sm text-white/50 leading-relaxed mb-4">
                      <span id="leaderboard">Sync GitHub, LeetCode, and CodeChef stats automatically.</span> Keep tabs on bootcamps and online certifications with progress meters.
                    </p>
                    <ul className="text-xs text-white/60 space-y-2 font-jetbrains">
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-primary" /> Daily stat sync (10 PM IST)</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-primary" /> Automated course reminders</li>
                    </ul>
                  </div>
                  <div className="flex-1 relative rounded-xl border border-white/5 overflow-hidden shadow-2xl h-full min-h-[160px]">
                    <img src="/images/landing/media__1786090550700.png" alt="Global Scoreboard and Coding Tracker" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  </div>
                </div>
              </SpringReveal>

            </div>
          </div>
        </section>


        {/* ================= GOOGLE API DETAILS CARD ================= */}
        <section className="w-full py-24 border-t border-white/5 flex justify-center bg-[#0A0A0C] px-6 relative z-10">
          <div className="w-full max-w-5xl">
            <SpringReveal direction="up">
              <div className="rounded-3xl border border-white/10 bg-[#121214] p-8 md:p-10 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-lg tracking-tight">Google API Integration & Transparency</h4>
                    <p className="text-xs text-white/50 mt-1 font-jetbrains">OAuth Scope Usage & Data Boundaries</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm leading-relaxed">
                  <div className="space-y-3">
                    <h5 className="font-bold text-white/80 uppercase text-xs tracking-widest">Scope Requested</h5>
                    <code className="block bg-black p-3 rounded-lg text-xs border border-white/10 break-all text-primary select-all font-jetbrains">
                      https://www.googleapis.com/auth/calendar
                    </code>
                    <span className="text-xs text-white/40 block">Sensitive Scope: Read/Write Google Calendar</span>
                  </div>
                  <div className="space-y-3">
                    <h5 className="font-bold text-white/80 uppercase text-xs tracking-widest">Purpose & Limited Use</h5>
                    <p className="text-white/60 text-xs leading-relaxed">
                      Our application requests calendar access exclusively to write and synchronize your study timetable blocks (lectures, revision periods) as recurring events. <strong>Layora's use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</strong>
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h5 className="font-bold text-white/80 uppercase text-xs tracking-widest">Data Security</h5>
                    <p className="text-white/60 text-xs leading-relaxed">
                      We enforce a zero-read, zero-storage policy: we do not read or store your calendar information on our servers. <strong>We do not sell, rent, or transfer your Google User Data or Calendar events to any third-party advertising platforms.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </SpringReveal>
          </div>
        </section>


        {/* ================= DEVELOPER & ARCHITECT SECTION ================= */}
        <section id="dev" className="w-full py-24 flex justify-center bg-[#121214] px-6 border-t border-white/5 relative z-10">
          <div className="w-full max-w-3xl text-center space-y-8">
            <SpringReveal direction="up">
              <h2 className="text-3xl font-extrabold tracking-tight font-geist text-white">
                Developer & Architect
              </h2>
            </SpringReveal>

            <SpringReveal direction="up" delay={0.15}>
              <div className="max-w-lg mx-auto">
                <div className="bg-[#1C1C1E] border border-white/10 rounded-3xl p-8 flex flex-col sm:flex-row items-center gap-8 text-left shadow-xl hover:border-white/20 transition-colors">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-black flex items-center justify-center relative shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                    <img 
                      src="https://img.icons8.com/color/96/kali-linux.png" 
                      alt="Vidwath N Karanth avatar" 
                      className="w-12 h-12 object-contain relative z-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">Vidwath N Karanth</h3>
                    <p className="text-xs text-primary font-bold uppercase tracking-widest font-jetbrains">Lead Fullstack Architect</p>
                    <p className="text-sm text-white/60 leading-relaxed mt-2">
                      Specializes in building clean client interfaces, automated data scrapers, and telemetry-focused dashboards.
                    </p>
                    <div className="flex gap-4 pt-2 text-xs text-white/50 font-jetbrains">
                      <span className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-md border border-white/5">
                        <Code className="w-3.5 h-3.5 text-primary" /> Next.js
                      </span>
                      <span className="flex items-center gap-1.5 bg-black/50 px-2 py-1 rounded-md border border-white/5">
                        <Terminal className="w-3.5 h-3.5 text-primary" /> Git / CI
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SpringReveal>
          </div>
        </section>


        {/* ================= GLOBAL FOOTER ================= */}
        <footer className="w-full z-10 border-t border-white/10 py-10 px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-white/40 bg-[#070709]">
          <div className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded flex items-center justify-center bg-primary/20 text-primary font-bold text-[10px]">L</div>
              <span className="font-bold text-white tracking-widest">LAYORA</span>
              <span className="ml-2 font-jetbrains">© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-8 font-medium">
              <a href="/privacy" className="hover:text-white transition">Privacy Policy</a>
              <a href="/terms" className="hover:text-white transition">Terms & Conditions</a>
            </div>
          </div>
        </footer>
      </main>
    );
  }

  // Loading screen
  return (
    <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden p-6">
      <div className="z-10 flex flex-col items-center gap-8">
        <motion.div 
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="relative w-20 h-20"
        >
          <div className="absolute inset-0 rounded-2xl border border-primary/30 animate-ping opacity-20"></div>
          <div className="absolute inset-2 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(0,122,255,0.5)]">
            <span className="text-white font-bold text-2xl tracking-tighter">L</span>
          </div>
        </motion.div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-[0.2em] text-white font-geist">
            LAYORA
          </h1>
          <p className="text-xs text-white/40 mt-2 font-jetbrains uppercase tracking-widest">
            Loading workspace...
          </p>
        </div>
      </div>
    </main>
  );
}
