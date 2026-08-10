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
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden p-6">
        <div className="z-10 w-full max-w-lg flex flex-col items-center text-center gap-8">
          <div className="relative w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-3xl">👑</span>
          </div>

          <div>
            <h1 className="text-3xl font-extrabold tracking-wide text-white">
              Welcome back
            </h1>
            <p className="text-xs text-white/50 mt-2">
              Select your access portal:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-4">
            <button
              onClick={() => router.push('/admin')}
              className="border border-white/10 p-6 rounded-xl flex flex-col items-center gap-4 transition duration-300 bg-[#0d111c]/40 hover:bg-[#0d111c]/60 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  ADMIN PORTAL
                </h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  Monitor telemetry, user database state, and operational analytics.
                </p>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="border border-white/10 p-6 rounded-xl flex flex-col items-center gap-4 transition duration-300 bg-[#0d111c]/40 hover:bg-[#0d111c]/60 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  USER PORTAL
                </h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">
                  Launch the standard student workspace planner, logs, and calendar.
                </p>
              </div>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2 rounded-lg text-xs transition cursor-pointer mt-4"
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
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center relative overflow-x-hidden scroll-smooth font-geist">

        {/* --- GLOBAL STICKY HEADER --- */}
        <header className="w-full max-w-6xl z-30 sticky top-4 px-6 py-3.5 bg-black/60 backdrop-blur-xl border-b border-white/10 rounded-2xl flex items-center justify-between mt-4 mx-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-xs">L</span>
            </div>
            <span className="font-bold tracking-wide text-white text-sm">LAYORA</span>
          </div>

          {/* Center quick links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-white/50">
            <a href="#dashboard" className="hover:text-white transition">Workspace</a>
            <a href="#resources" className="hover:text-white transition">Vault</a>
            <a href="#global-resources" className="hover:text-white transition">Shared Library</a>
            <a href="#courses" className="hover:text-white transition">Courses</a>
            <a href="#leaderboard" className="hover:text-white transition">Scoreboard</a>
            <a href="/privacy" className="text-primary hover:text-white transition font-semibold">Privacy</a>
          </nav>

          {/* Top Right Auth Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => router.push('/login')} 
              className="px-3.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-xs font-medium text-white/70 hover:text-white transition cursor-pointer"
            >
              Log in
            </button>
            <button 
              onClick={() => router.push('/login')} 
              className="px-3.5 py-1.5 rounded-lg bg-primary hover:brightness-110 text-xs font-semibold text-white transition cursor-pointer"
            >
              Sign up
            </button>
          </div>
        </header>

        {/* Google Verification text — positioned cleanly below hero, not as a banner */}

        {/* ================= HERO SECTION ================= */}
        <section className="w-full max-w-5xl z-10 flex flex-col items-center text-center gap-6 py-20 px-6 min-h-[90vh] justify-center">
          <ScrollReveal direction="up" delay={0.1}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight font-geist leading-tight max-w-4xl">
              Unify your academic life with{' '}
              <span className="text-primary">Layora</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.2}>
            <p className="text-sm sm:text-base text-white/50 max-w-2xl mx-auto leading-relaxed">
              Plan study timetables, manage certifications, sync to Google Calendar, organize resources by subject, and compete on coding scoreboards — all in one workspace.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.3}>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              <button
                onClick={() => router.push('/login')}
                className="px-6 py-3 rounded-lg bg-primary text-white hover:brightness-110 text-sm font-semibold transition flex items-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                Get started <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#dashboard"
                className="px-6 py-3 rounded-lg border border-white/10 hover:border-white/20 text-sm font-medium text-white/70 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                Explore features <ChevronDown className="w-4 h-4" />
              </a>
            </div>
          </ScrollReveal>

          {/* Product screenshot */}
          <ScrollReveal direction="up" delay={0.4}>
            <div className="relative mt-12 w-full max-w-4xl border border-white/10 rounded-xl overflow-hidden bg-black/40 p-1">
              <img 
                src="/images/landing/media__1786098306851.png" 
                alt="Layora Workspace Dashboard" 
                className="w-full rounded-lg object-cover border border-white/5"
              />
            </div>
          </ScrollReveal>

          {/* Google verification text — small, below hero, no banner styling */}
          <p className="text-xs text-white/30 max-w-2xl leading-relaxed mt-4">
            Layora is an AI-powered student productivity platform that helps university students optimize study schedules, manage task deadlines, organize resource vaults, and synchronize planner events to Google Calendar.
          </p>
        </section>


        {/* ================= FEATURE 1: DASHBOARD HUB ================= */}
        <section id="dashboard" className="w-full py-24 border-t border-white/5 flex justify-center bg-black/10 px-6">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="right">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white">
                  Unified Dashboard
                </h2>
                <p className="text-sm text-white/50 leading-relaxed mt-3">
                  Your command center. See daily schedules, active learning tracks, and streak points at a glance.
                </p>
                <div className="space-y-2.5 mt-5 text-xs text-white/60">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Streak Tracker:</strong> Monitor consecutive focus days to stay consistent.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>AI Assistant:</strong> Direct access to ChatGPT, Gemini, and Claude.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Academic Timeline:</strong> Today's schedule and tomorrow's upcoming blocks.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7">
              <ScrollReveal direction="left">
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 p-1">
                  <img 
                    src="/images/landing/media__1786098306851.png" 
                    alt="Active Workspace Dashboard" 
                    className="w-full rounded-lg object-cover border border-white/5"
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
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 p-1">
                  <img 
                    src="/images/landing/media__1786090592904.png" 
                    alt="Personal Subject Resource Vault" 
                    className="w-full rounded-lg object-cover border border-white/5"
                  />
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="left">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white">
                  Personal Resource Vault
                </h2>
                <p className="text-sm text-white/50 leading-relaxed mt-3">
                  Lecture notes, syllabi, and cheat sheets indexed by subject. Stop digging through folders.
                </p>
                <div className="space-y-2.5 mt-5 text-xs text-white/60">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Categorized Indexing:</strong> Documents filtered by academic subject.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Google Drive Upload:</strong> Save files directly to your personal Drive.</span>
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
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white">
                  Global Shared Resources
                </h2>
                <p className="text-sm text-white/50 leading-relaxed mt-3">
                  Upload study documents to make them public for the entire student body. Files remain securely stored on your own Google Drive, but are made public for everyone to preview and learn from.
                </p>
                <div className="space-y-2.5 mt-5 text-xs text-white/60">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Preview Thumbnails:</strong> Dynamic, rich card grid displaying visual document previews.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Target Academic Year filter:</strong> Segment sheets quickly by academic year.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Broad Format Support:</strong> Share PDFs, Word files, Excel spreadsheets, and PowerPoint presentations.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7">
              <ScrollReveal direction="left">
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 p-1">
                  <img 
                    src="/images/landing/media__1786090952365.png" 
                    alt="Global Shared Resources Preview" 
                    className="w-full rounded-lg object-cover border border-white/5"
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
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 p-1">
                  <img 
                    src="/images/landing/media__1786091336028.png" 
                    alt="Active Courses and Milestones Tracker" 
                    className="w-full rounded-lg object-cover border border-white/5"
                  />
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-5 space-y-5 text-left">
              <ScrollReveal direction="left">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white">
                  Active Courses & Milestones
                </h2>
                <p className="text-sm text-white/50 leading-relaxed mt-3">
                  Keep tabs on your bootcamps, online certifications (NPTEL, Udemy, Coursera), and external learning platforms.
                </p>
                <div className="space-y-2.5 mt-5 text-xs text-white/60">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Completion Progress Meters:</strong> Visual progress bars keep you updated on current syllabus coverage.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Target Deadlines:</strong> Keep targets aligned with calendar course due dates.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
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
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white">
                  Global Focus Scoreboard
                </h2>
                <p className="text-sm text-white/50 leading-relaxed mt-3">
                  Input your GitHub, LeetCode, or CodeChef credentials to sync coding stats and climb the leaderboard! Only active users who provide valid user handles are displayed, creating a competitive study environment.
                </p>
                <div className="space-y-2.5 mt-5 text-xs text-white/60">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Automatic Querying:</strong> Mapped stats sync daily at 10:00 PM IST directly from public records.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Standard Points Allotment:</strong> Earn points for easy (10pts), medium (20pts), or hard solves (30pts).</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span><strong>Streamlined Roster:</strong> Filters out dormant accounts with missing handles to highlight active students.</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7">
              <ScrollReveal direction="left">
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 p-1">
                  <img 
                    src="/images/landing/media__1786090550700.png" 
                    alt="Global Scoreboard and Coding Tracker" 
                    className="w-full rounded-lg object-cover border border-white/5"
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
              <div className="border border-white/10 bg-white/[0.01] rounded-xl p-6 md:p-8 space-y-4 text-left">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-white font-bold text-sm">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Google API Integration & Scope Usage Transparency</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Layora integrates with Google OAuth API services to let you synchronize your study schedules into your personal calendar.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 text-xs leading-relaxed">
                  <div className="space-y-2">
                    <h5 className="font-bold text-white uppercase text-xs tracking-wider">OAuth Scope Requested</h5>
                    <code className="block bg-white/5 p-2 rounded text-xs border border-white/5 break-all text-primary select-all">
                      https://www.googleapis.com/auth/calendar
                    </code>
                    <span className="text-[11px] text-white/30 block mt-1">
                      (Sensitive Scope: Read/Write Google Calendar)
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h5 className="font-bold text-white uppercase text-xs tracking-wider">Scope Purpose & Limited Use</h5>
                    <p className="text-white/50 text-xs">
                      Our application requests calendar access exclusively to write and synchronize your study timetable blocks (lectures, revision periods, custom routines) as recurring weekly events on your primary Google Calendar. <strong>Layora's use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</strong>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h5 className="font-bold text-white uppercase text-xs tracking-wider">Data Boundaries & Security</h5>
                    <p className="text-white/50 text-xs">
                      We enforce a zero-read, zero-storage policy: we do not read, alter, or delete any other calendars, and we do not store your calendar information on our servers. <strong>We do not sell, rent, or transfer your Google User Data or Calendar events to any third-party advertising platforms or external database systems.</strong>
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>


        {/* ================= DEVELOPER & ARCHITECT SECTION ================= */}
        <section id="dev" className="w-full py-24 border-t border-white/5 flex justify-center bg-[#0d111c]/30 px-6">
          <div className="w-full max-w-3xl text-center space-y-6">
            <ScrollReveal direction="up">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-geist text-white">
                Developer & Architect
              </h2>
              <p className="text-sm text-white/50 max-w-lg mx-auto mt-2 leading-relaxed">
                Layora is designed, engineered, and maintained by:
              </p>
            </ScrollReveal>

            {/* Developer Bio Card */}
            <ScrollReveal direction="up" delay={0.15}>
              <div className="max-w-md mx-auto">
                <div className="bg-[#0d111c]/90 border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 text-left">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10 shrink-0 bg-black flex items-center justify-center relative">
                    <img 
                      src="https://img.icons8.com/color/96/kali-linux.png" 
                      alt="Vidwath N Karanth avatar" 
                      className="w-10 h-10 object-contain relative z-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-white tracking-wide">Vidwath N Karanth</h3>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wider">Lead Fullstack Architect</p>
                    <p className="text-xs text-white/50 leading-normal">
                      Specializes in building clean client interfaces, automated data scrapers, and telemetry-focused dashboards.
                    </p>
                    <div className="flex gap-3 pt-1 text-xs text-white/40">
                      <span className="flex items-center gap-1">
                        <Code className="w-3.5 h-3.5" /> Next.js
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Terminal className="w-3.5 h-3.5" /> Git / CI
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>


        {/* ================= GLOBAL FOOTER ================= */}
        <footer className="w-full max-w-6xl z-10 border-t border-white/10 py-8 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40 bg-black/20 mt-4">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">LAYORA</span>
            <span>© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-white transition underline">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition underline">Terms & Conditions</a>
          </div>
        </footer>
      </main>
    );
  }

  // Loading screen (displayed while authentication state loads)
  return (
    <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden p-6">
      <div className="z-10 flex flex-col items-center gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse"></div>
          <div className="absolute inset-2 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl tracking-tighter">L</span>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-xl font-bold tracking-wider text-white">
            LAYORA
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Loading workspace...
          </p>
        </div>

        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full bg-primary w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
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
