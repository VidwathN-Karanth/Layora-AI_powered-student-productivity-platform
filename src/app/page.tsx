'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { 
  ShieldAlert, UserCheck, LogOut, ArrowRight, Sparkles, 
  CalendarRange, CheckSquare, Globe, Trophy, Shield, 
  Layers, ChevronDown, CheckCircle, Code, Terminal
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { isAdminEmail } from '@/lib/admin';
import { motion, AnimatePresence } from 'framer-motion';

// Scroll Triggered Entrance Wrapper
const ScrollReveal = ({ 
  children, 
  direction = 'up', 
  delay = 0 
}: { 
  children: React.ReactNode; 
  direction?: 'up' | 'down' | 'left' | 'right'; 
  delay?: number; 
}) => {
  const directions = {
    up: { y: 50, x: 0 },
    down: { y: -50, x: 0 },
    left: { x: 50, y: 0 },
    right: { x: -50, y: 0 }
  };
  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
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
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center relative overflow-x-hidden scroll-smooth font-mono">
        {/* Glow Backgrounds */}
        <div className="absolute w-[600px] h-[600px] bg-cyber-purple/10 -top-[10%] -right-[15%] rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute w-[600px] h-[600px] bg-cyber-blue/10 top-[25%] -left-[15%] rounded-full blur-[140px] pointer-events-none"></div>
        <div className="absolute w-[600px] h-[600px] bg-cyber-purple/5 top-[60%] -right-[15%] rounded-full blur-[140px] pointer-events-none"></div>

        {/* --- GLOBAL STICKY HEADER --- */}
        <header className="w-full max-w-6xl z-30 sticky top-4 px-6 py-3.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-between shadow-2xl shadow-black/80 mt-4 mx-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyber-purple to-cyber-blue flex items-center justify-center border border-white/15">
              <span className="text-white font-mono font-black text-xs">L</span>
            </div>
            <span className="font-bold tracking-widest text-white text-xs">LAYORA</span>
          </div>

          {/* Center quick links */}
          <nav className="hidden md:flex items-center gap-6 text-[10px] font-bold text-white/50 tracking-wider">
            <a href="#dashboard" className="hover:text-cyber-blue transition uppercase">Workspace</a>
            <a href="#resources" className="hover:text-cyber-blue transition uppercase">Vault</a>
            <a href="#global-resources" className="hover:text-cyber-blue transition uppercase">Shared Library</a>
            <a href="#courses" className="hover:text-cyber-blue transition uppercase">Bootcamps</a>
            <a href="#leaderboard" className="hover:text-cyber-blue transition uppercase">Scoreboard</a>
          </nav>

          {/* Top Right Auth Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => router.push('/login')} 
              className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-cyber-blue/30 bg-white/2 hover:bg-cyber-blue/5 text-[10px] font-bold tracking-wider text-white hover:text-cyber-blue transition cursor-pointer"
            >
              LOGIN
            </button>
            <button 
              onClick={() => router.push('/login')} 
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-[10px] font-bold tracking-wider text-on-surface transition cursor-pointer shadow-[0_0_15px_rgba(176,38,255,0.2)]"
            >
              SIGN UP
            </button>
          </div>
        </header>

        {/* ================= HERO SECTION ================= */}
        <section className="w-full max-w-5xl z-10 flex flex-col items-center text-center gap-8 py-20 px-6 min-h-[90vh] justify-center">
          <ScrollReveal direction="up" delay={0.1}>
            <div className="inline-flex items-center gap-2 bg-cyber-purple/10 border border-cyber-purple/20 px-3.5 py-1 rounded-full text-[9px] font-bold tracking-wider text-cyber-purple uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Next-Gen Student Development Terminal
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.2}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-geist leading-tight max-w-4xl">
              Unify Your Academic Core & Productivity with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple via-cyber-blue to-cyan-300 text-glow-cyan">
                Layora
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.3}>
            <p className="text-[11px] sm:text-xs text-white/70 max-w-2xl mx-auto leading-relaxed">
              Layora is a student productivity platform engineered to maximize output. Formulate optimal study timetables, manage certification progress, sync calendars, and compete on code scoreboards.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.4}>
            <div className="flex flex-wrap gap-3.5 justify-center mt-4">
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-3 rounded-xl bg-primary text-on-surface hover:bg-primary-container text-xs font-bold tracking-widest transition flex items-center gap-2 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(176,38,255,0.25)]"
              >
                ENTER APPLICATION <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#dashboard"
                className="px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/3 text-xs font-semibold tracking-widest text-white hover:bg-white/5 transition flex items-center gap-1.5 cursor-pointer"
              >
                SCROLL TO EXPLORE <ChevronDown className="w-4 h-4 animate-bounce" />
              </a>
            </div>
          </ScrollReveal>

          {/* Hero Floating Device Preview */}
          <ScrollReveal direction="up" delay={0.5}>
            <div className="relative mt-12 w-full max-w-4xl border border-white/10 rounded-2xl overflow-hidden bg-black/60 shadow-[0_0_50px_rgba(0,0,0,0.8)] p-1 backdrop-blur-md group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyber-purple/10 to-cyber-blue/10 opacity-30 z-0"></div>
              <img 
                src="/images/landing/media__1786092055369.png" 
                alt="Layora Workspace Dashboard" 
                className="w-full rounded-xl object-cover relative z-10 border border-white/5 shadow-inner transition duration-700 group-hover:scale-[1.01]"
              />
            </div>
          </ScrollReveal>
        </section>


        {/* ================= FEATURE 1: DASHBOARD HUB ================= */}
        <section id="dashboard" className="w-full py-24 border-t border-white/5 flex justify-center bg-black/10 px-6">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="right">
                <div className="inline-flex items-center gap-1.5 bg-cyber-purple/10 border border-cyber-purple/20 px-2.5 py-0.5 rounded text-[8px] font-bold tracking-wider text-cyber-purple uppercase">
                  <Layers className="w-3 h-3" /> Core Hub
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white mt-2">
                  Unified Telemetry Dashboard
                </h2>
                <p className="text-xs text-white/70 leading-relaxed font-sans mt-3">
                  Your mission control center. Get a quick view of your daily schedules, active learning tracks, and streak points. 
                </p>
                <div className="space-y-2 mt-5 text-[10px] text-white/80">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-cyber-blue shrink-0 mt-0.5" />
                    <span><strong>Streak Tracker:</strong> Monitor consecutive focus days to stay highly consistent.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-cyber-blue shrink-0 mt-0.5" />
                    <span><strong>LLM Assistant Bar:</strong> Direct access to toggled ChatGPT, Gemini, and Claude bots.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-cyber-blue shrink-0 mt-0.5" />
                    <span><strong>Academic Timeline:</strong> Instant view of todays schedules and tomorrow's upcoming blocks.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7">
              <ScrollReveal direction="left">
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40 shadow-xl p-1 relative group">
                  <img 
                    src="/images/landing/media__1786092055369.png" 
                    alt="Active Workspace Dashboard" 
                    className="w-full rounded-xl object-cover border border-white/5 transition duration-500 group-hover:scale-[1.015]"
                  />
                </div>
              </ScrollReveal>
            </div>

          </div>
        </section>


        {/* ================= FEATURE 2: SUBJECT RESOURCE VAULT ================= */}
        <section id="resources" className="w-full py-24 border-t border-white/5 flex justify-center px-6">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 order-last lg:order-first">
              <ScrollReveal direction="right">
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40 shadow-xl p-1 relative group">
                  <img 
                    src="/images/landing/media__1786090592904.png" 
                    alt="Personal Subject Resource Vault" 
                    className="w-full rounded-xl object-cover border border-white/5 transition duration-500 group-hover:scale-[1.015]"
                  />
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="left">
                <div className="inline-flex items-center gap-1.5 bg-cyber-blue/10 border border-cyber-blue/20 px-2.5 py-0.5 rounded text-[8px] font-bold tracking-wider text-cyber-blue uppercase">
                  <Globe className="w-3 h-3" /> Storage Vault
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white mt-2">
                  Personal Resource Vault
                </h2>
                <p className="text-xs text-white/70 leading-relaxed font-sans mt-3">
                  Keep your lecture notes, syllabi, cheat sheets, and blueprints indexed by subject. Stop wasting hours digging through folders; have everything available at your fingertips.
                </p>
                <div className="space-y-2 mt-5 text-[10px] text-white/80">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Categorized Indexing:</strong> View documents filtered automatically by academic subject.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Direct Google Drive Upload:</strong> Save files directly inside your personal Google Drive space.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Drag & Drop + Paste:</strong> Supports drag-and-drop or simple copy-pasting for quick additions.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

          </div>
        </section>


        {/* ================= FEATURE 3: GLOBAL SHARED LIBRARY ================= */}
        <section id="global-resources" className="w-full py-24 border-t border-white/5 flex justify-center bg-black/10 px-6">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="right">
                <div className="inline-flex items-center gap-1.5 bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 rounded text-[8px] font-bold tracking-wider text-pink-400 uppercase">
                  <Globe className="w-3 h-3" /> Public Hub
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white mt-2">
                  Global Shared Resources
                </h2>
                <p className="text-xs text-white/70 leading-relaxed font-sans mt-3">
                  Upload study documents to make them public for the entire student body. Files remain securely stored on your own Google Drive, but are made public for everyone to preview and learn from.
                </p>
                <div className="space-y-2 mt-5 text-[10px] text-white/80">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                    <span><strong>Preview Thumbnails:</strong> Dynamic, rich card grid displaying visual document previews.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                    <span><strong>Target Academic Year filter:</strong> Segment sheets quickly by 1st Yr, 2nd Yr, 3rd Yr, 4th Yr, or others.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                    <span><strong>Broad Format Support:</strong> Share PDFs, Word files, Excel spreadsheets, and PowerPoint presentations.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7">
              <ScrollReveal direction="left">
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40 shadow-xl p-1 relative group">
                  <img 
                    src="/images/landing/media__1786090952365.png" 
                    alt="Global Shared Resources Preview" 
                    className="w-full rounded-xl object-cover border border-white/5 transition duration-500 group-hover:scale-[1.015]"
                  />
                </div>
              </ScrollReveal>
            </div>

          </div>
        </section>


        {/* ================= FEATURE 4: COURSE BOOTCAMP MANAGER ================= */}
        <section id="courses" className="w-full py-24 border-t border-white/5 flex justify-center px-6">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 order-last lg:order-first">
              <ScrollReveal direction="right">
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40 shadow-xl p-1 relative group">
                  <img 
                    src="/images/landing/media__1786091336028.png" 
                    alt="Active Courses and Milestones Tracker" 
                    className="w-full rounded-xl object-cover border border-white/5 transition duration-500 group-hover:scale-[1.015]"
                  />
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="left">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded text-[8px] font-bold tracking-wider text-emerald-400 uppercase">
                  <CalendarRange className="w-3 h-3" /> Academics
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white mt-2">
                  Active Courses & Milestones
                </h2>
                <p className="text-xs text-white/70 leading-relaxed font-sans mt-3">
                  Keep tabs on your bootcamps, online certifications (NPTEL, Udemy, Coursera), and external learning platforms.
                </p>
                <div className="space-y-2 mt-5 text-[10px] text-white/80">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Completion Progress Meters:</strong> Visual progress bars keep you updated on current syllabus coverage.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Target Deadlines:</strong> Keep targets aligned with calendar course due dates.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Daily Email Reminders:</strong> Automated reminders keep you updated on current course targets.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

          </div>
        </section>


        {/* ================= FEATURE 5: LEADERBOARD ================= */}
        <section id="leaderboard" className="w-full py-24 border-t border-white/5 flex justify-center bg-black/10 px-6">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="right">
                <div className="inline-flex items-center gap-1.5 bg-cyber-blue/10 border border-cyber-blue/20 px-2.5 py-0.5 rounded text-[8px] font-bold tracking-wider text-cyber-blue uppercase">
                  <Trophy className="w-3 h-3" /> Streaks
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white mt-2">
                  Global Focus Scoreboard
                </h2>
                <p className="text-xs text-white/70 leading-relaxed font-sans mt-3">
                  Input your GitHub, LeetCode, or CodeChef credentials to sync coding stats and climb the leaderboard! Only active users who provide valid user handles are displayed, creating a competitive study environment.
                </p>
                <div className="space-y-2 mt-5 text-[10px] text-white/80">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-cyber-blue shrink-0 mt-0.5" />
                    <span><strong>Automatic Querying:</strong> Mapped stats sync daily at 10:00 PM IST directly from public records.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-cyber-blue shrink-0 mt-0.5" />
                    <span><strong>Standard Points Allotment:</strong> Earn points for easy (10pts), medium (20pts), or hard solves (30pts).</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-cyber-blue shrink-0 mt-0.5" />
                    <span><strong>Streamlined Roster:</strong> Filters out dormant accounts with missing handles to highlight active students.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7">
              <ScrollReveal direction="left">
                <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/40 shadow-xl p-1 relative group">
                  <img 
                    src="/images/landing/media__1786090550700.png" 
                    alt="Global Scoreboard and Coding Tracker" 
                    className="w-full rounded-xl object-cover border border-white/5 transition duration-500 group-hover:scale-[1.015]"
                  />
                </div>
              </ScrollReveal>
            </div>

          </div>
        </section>


        {/* ================= GOOGLE API DETAILS CARD ================= */}
        <section className="w-full py-20 border-t border-white/5 flex justify-center bg-black/40 px-6">
          <div className="w-full max-w-5xl">
            <ScrollReveal direction="up">
              <div className="glass-card border border-white/10 bg-white/[0.01] rounded-2xl p-6 md:p-8 space-y-4 text-left">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-white font-bold text-xs">
                  <Shield className="w-4 h-4 text-cyber-blue" />
                  <span>Google API Integration & Scope Usage Transparency</span>
                </div>
                <p className="text-[10px] text-white/60 leading-relaxed">
                  Layora integrates with Google OAuth API services to let you synchronize your AI study schedules into your personal calendar.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-[10px] leading-relaxed">
                  <div className="space-y-1">
                    <h5 className="font-bold text-cyber-purple uppercase text-[9px] tracking-wider">OAuth Scope Requested</h5>
                    <code className="block bg-white/5 p-2 rounded text-[8.5px] border border-white/5 break-all text-cyber-blue select-all">
                      https://www.googleapis.com/auth/calendar
                    </code>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-cyber-purple uppercase text-[9px] tracking-wider">Sync Purpose</h5>
                    <p className="text-white/65 text-[9px]">
                      This scope is used solely to insert weekly AI timetable blocks (lectures, revision periods, workouts) as recurring events on your primary Google Calendar.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-cyber-purple uppercase text-[9px] tracking-wider">Data Boundaries</h5>
                    <p className="text-white/65 text-[9px]">
                      We enforce zero-read policies: we never read, alter, or delete other calendar details and do not transmit credentials to third-party databases.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>


        {/* ================= DEVELOPER & ARCHITECT SECTION ================= */}
        <section id="dev" className="w-full py-24 border-t border-white/5 flex justify-center bg-[#0d111c]/30 px-6">
          <div className="w-full max-w-3xl text-center space-y-8">
            <ScrollReveal direction="up">
              <div className="inline-flex items-center gap-1.5 bg-cyber-purple/10 border border-cyber-purple/20 px-2.5 py-0.5 rounded text-[8px] font-bold tracking-wider text-cyber-purple uppercase">
                <Terminal className="w-3.5 h-3.5" /> Platform Engineer
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white mt-2">
                Developer & Architect
              </h2>
              <p className="text-xs text-white/50 max-w-lg mx-auto mt-2 leading-relaxed">
                Layora is designed, engineered, and maintained by:
              </p>
            </ScrollReveal>

            {/* Developer Bio Card */}
            <ScrollReveal direction="up" delay={0.15}>
              <div className="relative group max-w-md mx-auto">
                {/* Glow ring */}
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-cyber-purple to-cyber-blue opacity-50 blur-lg transition duration-500 group-hover:opacity-75 group-hover:blur-xl"></div>
                
                <div className="relative bg-[#0d111c]/90 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 text-left backdrop-blur-md">
                  {/* Dev avatar placeholder with Kalilinux dragon logo matching screenshots */}
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-cyber-purple/35 shrink-0 bg-black flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyber-purple/20 to-transparent"></div>
                    <img 
                      src="https://img.icons8.com/color/96/kali-linux.png" 
                      alt="Vidwath N Karanth avatar" 
                      className="w-10 h-10 object-contain relative z-10 filter brightness-110"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-white tracking-wide">Vidwath N Karanth</h3>
                    <p className="text-[10px] text-cyber-blue font-mono font-semibold uppercase tracking-wider">Lead Fullstack Architect</p>
                    <p className="text-[10px] text-white/60 leading-normal font-sans">
                      Specializes in building cyber-theme client interfaces, automated data scrapers, and telemetry-focused dashboards.
                    </p>
                    <div className="flex gap-3 pt-1 text-[10px] text-white/40">
                      <span className="flex items-center gap-1">
                        <Code className="w-3 h-3" /> Next.js
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Terminal className="w-3 h-3" /> Git / CI
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>


        {/* ================= GLOBAL FOOTER ================= */}
        <footer className="w-full max-w-6xl z-10 border-t border-white/10 py-8 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[9px] text-white/40 bg-black/20 mt-4 rounded-t-2xl">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white font-mono">LAYORA</span>
            <span>© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</span>
          </div>
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
