'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { resolveScheduleOverlaps } from '@/lib/scheduler';
import { apiFetch } from '@/lib/apiClient';
import { 
  LayoutDashboard, CalendarRange, BookMarked, CheckSquare, 
  FolderLock, BarChart3, Settings, LogOut, ChevronLeft, 
  ChevronRight, Clock, 
  Check, Menu, X, Trophy, Award,
  Globe, Sun, Moon
} from 'lucide-react';
import { UserButton, useUser, useAuth } from '@clerk/nextjs';
import OnboardingModal from '@/components/OnboardingModal';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { isAdminEmail } from '@/lib/admin';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const store = useStore();

  const mockAuth = false; // Set to true to bypass Clerk login for local testing

  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useAuth();

  useEffect(() => {
    if (mockAuth && store.hasHydrated) {
      if (!store.isAuthenticated) {
        store.login('mock-student@layora.edu', 'Mock Student');
      } else {
        if (store.user && !store.user.isOnboarded) {
          store.updateOnboardingStatus(true);
        }
        if (store.themeMode !== 'light') {
          store.setThemeMode('light');
        }
      }
    }
  }, [mockAuth, store.hasHydrated, store.isAuthenticated, store.user?.isOnboarded, store.themeMode]);

  useEffect(() => {
    if (mockAuth) return;
    if (!store.hasHydrated || !store.isCloudLoaded) return;
    if (isLoaded && isSignedIn && clerkUser) {
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || '';
      const fullName = clerkUser.fullName || primaryEmail.split('@')[0];
      if (!store.isAuthenticated || store.user?.email !== primaryEmail) {
        store.login(primaryEmail, fullName);
      }
    }
  }, [isLoaded, isSignedIn, clerkUser, store.hasHydrated, store.isCloudLoaded, store.isAuthenticated, store.user?.email, mockAuth]);

  useEffect(() => {
    if (store.isAuthenticated) {
      store.checkAndUpdateStreak();
    }
  }, [store.isAuthenticated]);

  // The student workspace and the admin console are separate surfaces.
  // Admins belong to the console only — bounce them out of every /dashboard route.
  const isAdmin = isAdminEmail(store.user?.email) || isAdminEmail(clerkUser?.primaryEmailAddress?.emailAddress);

  useEffect(() => {
    if (mockAuth) return;
    if (isLoaded && isAdmin) {
      router.replace('/admin');
    }
  }, [isLoaded, isAdmin, mockAuth, router]);

  // Routing protection is handled by Clerk Middleware

  // Sidebar collapsible state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Mobile responsive overrides
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Digital clock state
  const [timeStr, setTimeStr] = useState('');
  const lastCheckedDateRef = useRef('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      lastCheckedDateRef.current = new Date().toLocaleDateString('en-CA');
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !store.is24HourFormat }));
      
      const currentDayStr = d.toLocaleDateString('en-CA');
      if (currentDayStr !== lastCheckedDateRef.current) {
        lastCheckedDateRef.current = currentDayStr;
        if (store.isAuthenticated) {
          store.checkAndUpdateStreak();
        }
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [store.is24HourFormat, store.isAuthenticated]);

  useEffect(() => {
    if (store.activeTaskId) {
      const interval = setInterval(() => {
        store.updateTimerSecond();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [store.activeTaskId]);

  // Auto-resolve any timetable overlap conflicts on store hydration/change
  useEffect(() => {
    if (store.timetable && store.timetable.length > 0) {
      const fixedTimetable = resolveScheduleOverlaps(store.timetable);
      if (JSON.stringify(fixedTimetable) !== JSON.stringify(store.timetable)) {
        store.setTimetable(fixedTimetable);
      }
    }
  }, [store.timetable]);

  // Auto-generate schedule if timetable is empty (Rule 1)
  useEffect(() => {
    if (store.isAuthenticated && store.isCloudLoaded && store.timetable.length === 0) {
      console.log('DashboardLayout - timetable is empty, auto-generating schedule');
      store.generateSchedule();
    }
  }, [store.isAuthenticated, store.isCloudLoaded, store.timetable.length]);

  const handleLogout = async () => {
    store.logout();
    await signOut();
    router.replace('/login');
  };

  // Find currently running task details
  const activeTask = store.tasks.find((t) => t.id === store.activeTaskId);

  // Formatting utility for timer: MM:SS
  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours > 0 ? hours + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Weekly Planner', path: '/dashboard/planner', icon: CalendarRange },
    { name: 'Tasks', path: '/dashboard/tasks', icon: CheckSquare },
    { name: 'Courses', path: '/dashboard/courses', icon: BookMarked },
    { name: 'Resources', path: '/dashboard/resources', icon: FolderLock },
    { name: 'Certificates', path: '/dashboard/certificates', icon: Award },
    { name: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Leaderboard', path: '/dashboard/leaderboard', icon: Trophy },
    { name: 'Global Resources', path: '/dashboard/global-resources', icon: Globe },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings }
  ];

  if (typeof window !== 'undefined') {
    apiFetch('/api/debug-log/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `DashboardLayout render - isLoaded=${isLoaded}, isAuthenticated=${store.isAuthenticated}, hasUser=${!!store.user}, userEmail=${store.user?.email}, isOnboarded=${store.user?.isOnboarded}` })
    }).catch(() => {});
  }

  if (!mockAuth && (!isLoaded || !store.isAuthenticated)) return null;
  if (!mockAuth && isAdmin) return null;

  return (
    <div className="min-h-screen bg-cyber-dark text-white flex relative overflow-hidden font-mono">
      {/* Background Neon Elements */}
      <div className="hidden glow-orb w-[500px] h-[500px] bg-cyber-purple/20 top-0 left-[-200px]"></div>
      <div className="hidden glow-orb w-[500px] h-[500px] bg-cyber-blue/20 bottom-0 right-0"></div>

      {/* --- MOBILE NAV TOPBAR --- */}
      <div className="md:hidden w-full h-14 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 z-40 fixed top-0 left-0">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-primary">
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <span className="font-bold text-white text-sm">LAYORA</span>
        <div className="w-9" />
      </div>

      {/* --- MOBILE SIDEBAR DRAWER --- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-[240px] bg-cyber-dark/95 border-r border-white/10 z-50 flex flex-col justify-between p-3.5 md:hidden"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="font-mono font-bold text-cyber-blue text-sm">Layora</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-white/50"><X className="w-5 h-5" strokeWidth={1.5} /></button>
                </div>
                <nav className="space-y-0.5">
                  {menuItems.map((item) => {
                    const active = pathname.replace(/\/$/, '') === item.path.replace(/\/$/, '');
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => { router.push(item.path); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 py-1.5 rounded-lg text-xs font-mono transition border ${
                          active 
                            ? 'bg-white/10 text-cyber-blue font-bold border-white/10 pl-2 pr-3' 
                            : 'text-white/60 hover:bg-white/5 hover:text-white border-transparent pl-2 pr-3'
                        }`}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                        {item.name.toUpperCase()}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2.5 bg-white/5 p-2 rounded-lg border border-white/10">
                  <UserButton appearance={{ elements: { userButtonAvatarBox: "w-7 h-7 rounded-lg" } }} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono font-semibold truncate text-white">{store.user?.name || 'Layora Student'}</div>
                    <div className="text-[8px] font-mono text-white/40 truncate">{store.user?.email}</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/15 hover:bg-red-950/25 text-red-400 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer">
                  <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} /> Logout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* --- DESKTOP SIDEBAR --- */}
      <motion.aside
        animate={{ width: sidebarOpen ? 260 : 76 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex flex-col justify-between p-4 border-r border-white/10 bg-black/20 backdrop-blur-md shrink-0 h-screen sticky top-0 z-30 overflow-hidden"
      >
        {/* Top Section: Logo & Navigation Container */}
        <div className="flex flex-col flex-1 min-h-0 space-y-6">
          {/* Logo panel */}
          <div className="flex items-center justify-between shrink-0">
            <AnimatePresence mode="wait">
              {sidebarOpen ? (
                <motion.span 
                  key="full-logo" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="font-bold text-sm text-white flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-white text-xs">L</span> LAYORA
                </motion.span>
              ) : (
                <motion.div 
                  key="short-logo" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center w-full gap-2"
                  title="Layora"
                >
                  <span className="font-mono font-black text-base text-primary w-full text-center">
                    L
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-white/10 rounded-lg border border-white/10 text-white/50 hover:text-white transition"
            >
              {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
          </div>

          {/* Navigation Links (Scrollable independently if screen height is small) */}
          <nav className="space-y-1 flex-1 overflow-y-auto pr-1 scrollbar-none">
            {menuItems.map((item) => {
              const active = pathname.replace(/\/$/, '') === item.path.replace(/\/$/, '');
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-xs font-mono transition relative border ${
                    active 
                      ? 'bg-gradient-to-r from-cyber-purple/25 to-cyber-blue/15 text-white font-bold border-white/15 pl-2 pr-3' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white border-transparent pl-2 pr-3'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyber-blue' : ''}`} strokeWidth={1.5} />
                  {sidebarOpen && <span>{item.name.toUpperCase()}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: User Card & Logout (Always static/pinned at the bottom) */}
        <div className="space-y-4 pt-4 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/10 overflow-hidden">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8 rounded-lg shrink-0" } }} />
            {sidebarOpen && (
              <div className="truncate min-w-0">
                <div className="text-xs font-mono font-semibold truncate text-white">{store.user?.name}</div>
                <div className="text-[9px] font-mono text-white/40 truncate">{store.user?.email}</div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/10 hover:bg-red-950/30 text-red-400 py-2 rounded-xl text-xs font-mono transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} /> 
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* --- CENTER WORKSPACE CONTAINER --- */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen pb-16 md:pb-0">
        
        {/* --- DESKTOP TOP NAVIGATION BAR --- */}
        <header className="relative h-14 border-b border-white/10 bg-black/20 backdrop-blur-md px-6 hidden md:flex items-center justify-between z-20">
          <div className="flex items-center gap-2 font-mono text-xs text-white/40">
            <span>Workspace:</span>
            <span className="text-cyber-blue font-bold uppercase">{menuItems.find(item => pathname.replace(/\/$/, '') === item.path.replace(/\/$/, ''))?.name || 'DASHBOARD'}</span>
          </div>

          {/* Live digital clock with 12/24 toggle */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 border border-white/10 bg-white/5 px-4 py-1.5 rounded-full font-mono">
            <span 
              className={`w-2 h-2 rounded-full shrink-0 ${isSupabaseConfigured ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}
              title={isSupabaseConfigured ? "Synced to Supabase" : "Running in Local Demo Mode"}
            />
            <Clock className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="text-white font-bold font-mono text-lg min-w-[100px] text-center">
              {timeStr || '00:00:00'}
            </span>
            <button 
              onClick={() => store.setIs24HourFormat(!store.is24HourFormat)}
              className="ml-1 text-xs font-semibold uppercase bg-white/10 hover:bg-white/20 text-white/80 px-1.5 py-0.5 rounded cursor-pointer transition border border-white/10"
              title="Toggle 12h/24h Format"
            >
              {store.is24HourFormat ? '24H' : '12H'}
            </button>
            <div className="h-4 w-[1px] bg-white/15 ml-1.5 mr-0.5 shrink-0" />
            <button
              onClick={() => store.setThemeMode(store.themeMode === 'light' ? 'dark' : 'light')}
              className={`relative flex h-5 w-9 items-center rounded-full transition-colors duration-200 cursor-pointer outline-none border border-white/10 shrink-0 ml-1.5 ${
                store.themeMode === 'light' ? 'bg-zinc-300' : 'bg-zinc-800'
              }`}
              title={store.themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label={store.themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full transition-transform duration-200 ${
                  store.themeMode === 'light' ? 'translate-x-0.5 bg-white text-amber-500' : 'translate-x-4 bg-zinc-950 text-white'
                }`}
              >
                {store.themeMode === 'light' ? (
                  <Sun className="w-2.5 h-2.5 fill-amber-500 text-amber-500" strokeWidth={2.5} />
                ) : (
                  <Moon className="w-2.5 h-2.5 fill-white text-white" strokeWidth={2.5} />
                )}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Live running task timer details */}
            {store.activeTaskId && activeTask && (
              <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1 text-xs text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="font-mono text-xs text-white/50 uppercase">Timer:</span>
                <span className="font-bold truncate max-w-[120px] font-mono text-white">{activeTask.title}</span>
                <span className="font-mono font-bold text-primary">
                  {formatTimer(Math.max(0, (activeTask.estimatedMinutes * 60) - store.activeTimerElapsed))}
                </span>
                <button 
                  onClick={() => store.stopTaskTimer(true, true)} 
                  className="hover:text-white border-l border-white/20 pl-1.5 transition ml-1"
                  title="Complete Task"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                </button>
              </div>
            )}

          </div>
        </header>


        {/* --- SCROLLABLE WORKSPACE CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 z-10 mt-14 md:mt-0 flex flex-col justify-between">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-12 pt-4 border-t border-white/5 text-center font-mono text-[9px] text-white/30 space-y-1.5">
            <div>© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</div>
            <div className="flex items-center justify-center gap-3">
              <span>Contact: <a href="mailto:4mt24cs239@mite.ac.in" className="text-cyber-blue hover:underline">4mt24cs239@mite.ac.in</a></span>
              <span className="text-white/15">•</span>
              <a href="/privacy" className="text-cyber-blue hover:text-white transition hover:underline">Privacy Policy</a>
              <span className="text-white/15">•</span>
              <a href="/terms" className="text-cyber-blue hover:text-white transition hover:underline">Terms & Conditions</a>
            </div>
          </footer>
        </div>
      </main>

      <OnboardingModal />
    </div>
  );
}
