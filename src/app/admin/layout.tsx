'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth, useUser } from '@clerk/nextjs';
import {
  Activity, Award, CalendarDays, ChevronLeft, ChevronRight, Clock, FileText,
  Globe, LayoutDashboard, LogOut, Menu, Moon, ScrollText, Settings, Sun, Trophy,
  Users, X,
} from 'lucide-react';

import { useStore } from '@/store/useStore';
import { apiFetch } from '@/lib/apiClient';
import { formatShortDate } from '@/lib/dateFormat';
import { COHORTS, shortCohortLabel } from '@/lib/cohorts';
import LayoraMark from '@/components/LayoraMark';
import NotificationAgent from '@/components/NotificationAgent';
import NotificationCenter from '@/components/NotificationCenter';
import ExtensionNudge from '@/components/ExtensionNudge';
import { AdminProvider, useAdmin } from './AdminContext';

/* ────────────────────────────────────────────────────────────────
   The admin console's shell.

   Deliberately the same shape as the student workspace: a sidebar of sections
   on the left, a header with the clock and the theme switch, the same footer.
   Staff and students then share one mental model of the app, and the console
   stopped being a single page stacking six panels down one scroll.

   The console differs in exactly one structural way, and it is the reason the
   year selector lives up here rather than on each page: every admin data route
   demands an explicit `?cohort=`, so a section is only meaningful once a year
   is chosen. Sections that are not about students — settings, the audit trail —
   hide the selector instead of showing one that changes nothing.
   ──────────────────────────────────────────────────────────────── */

const MENU = [
  { name: 'Overview', path: '/admin', icon: LayoutDashboard },
  { name: 'Student Nodes', path: '/admin/students', icon: Users },
  { name: 'Leaderboard', path: '/admin/leaderboard', icon: Trophy },
  { name: 'Events', path: '/admin/events', icon: CalendarDays },
  { name: 'Certificates', path: '/admin/certificates', icon: Award },
  { name: 'Resumes', path: '/admin/resumes', icon: FileText },
  { name: 'Global Resources', path: '/admin/global-resources', icon: Globe },
  { name: 'Activity Log', path: '/admin/logs', icon: ScrollText },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

/** Sections whose data is not scoped to one academic year. */
const YEARLESS = ['/admin/logs', '/admin/settings'];

const normalise = (path: string) => path.replace(/\/$/, '') || '/admin';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { isLoaded: isUserLoaded, user } = useUser();
  const { isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();

  const themeMode = useStore((state) => state.themeMode);
  const setThemeMode = useStore((state) => state.setThemeMode);
  const is24HourFormat = useStore((state) => state.is24HourFormat);

  const [authorized, setAuthorized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  const adminName = user?.fullName || user?.firstName || 'Administrator';
  const adminEmail = user?.primaryEmailAddress?.emailAddress || '';
  const adminAvatar = user?.imageUrl || '';
  const adminInitial = (adminName || adminEmail || 'A').charAt(0).toUpperCase();

  const current = normalise(pathname);
  const active = MENU.find((item) => normalise(item.path) === current);
  const showYearSelector = !YEARLESS.includes(current);

  /**
   * Verify admin access with the server, not by comparing an email here.
   *
   * The log POST doubles as the check: /api/admin/logs sits behind
   * requireAdmin(), so a 2xx *is* the authorization answer. It also records
   * "opened the console", de-duplicated server-side to once per half hour so
   * moving between sections does not become nine lines.
   *
   * Only an explicit 401/403 means no. Anything else is a failed lookup, and
   * that leaves the lock screen up rather than throwing a real admin out over
   * one bad request.
   */
  const checkedRef = useRef(false);
  useEffect(() => {
    if (!isUserLoaded || !isAuthLoaded) return;

    if (!isSignedIn) {
      router.replace('/login');
      return;
    }
    // The shell survives navigation between sections, but React still re-runs
    // this on a fast refresh; one check per mount is enough.
    if (checkedRef.current) return;
    checkedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/admin/logs', { method: 'POST' });
        if (cancelled) return;

        if (res.ok) {
          setAuthorized(true);
          return;
        }
        if (res.status === 401 || res.status === 403) {
          router.replace('/dashboard');
        }
      } catch {
        // Offline or a blocked request. Undecided is not the same as denied.
      }
    })();

    return () => { cancelled = true; };
  }, [isUserLoaded, isAuthLoaded, isSignedIn, router]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !is24HourFormat,
      }));
      setDateStr(formatShortDate(d));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [is24HourFormat]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      useStore.getState().logout();
      await signOut();
      router.replace('/login');
    } catch (err) {
      console.error('Sign out failed:', err);
      setIsSigningOut(false);
      setShowSignOutConfirm(false);
    }
  };

  if (!authorized) {
    return (
      <main className="min-h-screen bg-background text-white flex flex-col items-center justify-center relative overflow-hidden">
        <div className="z-10 flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse" />
            <div className="absolute inset-2 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl tracking-tighter">🔒</span>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-wider text-white">LAYORA BACKEND</h1>
            <p className="text-xs text-white/40 mt-1">
              Authenticating credentials &amp; firewall rules...
            </p>
          </div>
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute left-0 top-0 h-full bg-primary w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]" />
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
    <AdminProvider authorized={authorized} adminName={adminName} adminEmail={adminEmail}>
      <div className="min-h-screen bg-cyber-dark text-white flex relative overflow-hidden font-mono">
        {/* --- MOBILE NAV TOPBAR --- */}
        <div className="md:hidden w-full h-14 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-2 px-3 z-40 fixed top-0 left-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open the menu"
            className="p-2 hover:bg-white/5 rounded-lg text-primary shrink-0"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <div className="flex flex-col items-center leading-none min-w-0">
            <span className="font-mono font-bold text-white text-sm tabular-nums">
              {timeStr || '00:00:00'}
            </span>
            <span className="text-[9px] font-mono text-white/45 tracking-wide truncate">{dateStr}</span>
          </div>

          <button
            onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
            aria-label={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition shrink-0"
          >
            {themeMode === 'light'
              ? <Sun className="w-4 h-4" strokeWidth={1.5} />
              : <Moon className="w-4 h-4" strokeWidth={1.5} />}
          </button>
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
                <div className="space-y-4 overflow-y-auto scrollbar-none">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <span className="font-mono font-bold text-cyber-blue text-sm">Layora Staff</span>
                    <button onClick={() => setMobileMenuOpen(false)} className="text-white/50">
                      <X className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                  </div>
                  <nav className="space-y-0.5">
                    {MENU.map((item) => {
                      const isActive = normalise(item.path) === current;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.name}
                          onClick={() => { router.push(item.path); setMobileMenuOpen(false); }}
                          className={`w-full flex items-center gap-3 py-1.5 pl-2 pr-3 rounded-lg text-xs font-mono transition border ${
                            isActive
                              ? 'bg-white/10 text-cyber-blue font-bold border-white/10'
                              : 'text-white/60 hover:bg-white/5 hover:text-white border-transparent'
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
                    <span className="w-7 h-7 rounded-lg bg-cyber-blue/15 border border-cyber-blue/25 flex items-center justify-center text-cyber-blue font-black text-xs shrink-0">
                      {adminInitial}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono font-semibold truncate text-white">{adminName}</div>
                      <div className="text-[8px] font-mono text-white/40 truncate">{adminEmail}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setMobileMenuOpen(false); setShowSignOutConfirm(true); }}
                    className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/15 hover:bg-red-950/25 text-red-400 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} /> Sign out
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
          className={`hidden md:flex flex-col justify-between py-4 border-r border-white/10 bg-black/20 backdrop-blur-md shrink-0 h-screen sticky top-0 z-30 overflow-hidden ${
            sidebarOpen ? 'px-4' : 'px-2'
          }`}
        >
          <div className="flex flex-col flex-1 min-h-0 space-y-6">
            <div className={`shrink-0 ${sidebarOpen ? 'flex items-center justify-between' : 'flex flex-col items-center gap-2'}`}>
              <AnimatePresence mode="wait">
                {sidebarOpen ? (
                  <motion.span
                    key="full-logo"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="font-bold text-sm text-white flex items-center gap-2"
                  >
                    <LayoraMark className="h-6 w-6" glyphClassName="text-xs" /> LAYORA
                    <span className="text-[9px] font-mono uppercase tracking-widest text-cyber-blue">Staff</span>
                  </motion.span>
                ) : (
                  <motion.div
                    key="short-logo"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center"
                    title="Layora Staff"
                  >
                    <span className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center font-mono font-black text-base text-primary">
                      L
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Collapse the sidebar' : 'Expand the sidebar'}
                title={sidebarOpen ? 'Collapse the sidebar' : 'Expand the sidebar'}
                className="p-1.5 hover:bg-white/10 rounded-lg border border-white/10 text-white/50 hover:text-white transition cursor-pointer shrink-0"
              >
                {sidebarOpen
                  ? <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
                  : <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />}
              </button>
            </div>

            <nav className={`space-y-1 flex-1 overflow-y-auto scrollbar-none ${sidebarOpen ? 'pr-1' : ''}`}>
              {MENU.map((item) => {
                const isActive = normalise(item.path) === current;
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.path)}
                    title={sidebarOpen ? undefined : item.name}
                    aria-label={item.name}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center rounded-xl text-xs font-mono transition relative border cursor-pointer ${
                      sidebarOpen ? 'w-full gap-3 py-2.5 pl-2 pr-3' : 'w-11 h-11 mx-auto justify-center'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-cyber-purple/25 to-cyber-blue/15 text-white font-bold border-white/15'
                        : 'text-white/60 hover:bg-white/5 hover:text-white border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyber-blue' : ''}`} strokeWidth={1.5} />
                    {sidebarOpen && <span>{item.name.toUpperCase()}</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className={`pt-4 border-t border-white/5 shrink-0 ${sidebarOpen ? 'space-y-4' : 'space-y-2'}`}>
            <div className={`flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden ${
              sidebarOpen ? 'gap-2.5 p-2.5' : 'justify-center p-1.5'
            }`}>
              {adminAvatar && !avatarFailed ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={adminAvatar}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                />
              ) : (
                <span className="w-8 h-8 rounded-lg bg-cyber-blue/15 border border-cyber-blue/25 flex items-center justify-center text-cyber-blue font-black text-sm shrink-0">
                  {adminInitial}
                </span>
              )}
              {sidebarOpen && (
                <div className="truncate min-w-0">
                  <div className="text-xs font-mono font-semibold truncate text-white">{adminName}</div>
                  <div className="text-[9px] font-mono text-white/40 truncate">{adminEmail}</div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSignOutConfirm(true)}
              title={sidebarOpen ? undefined : 'Sign out'}
              aria-label="Sign out"
              className={`flex items-center justify-center border border-red-500/20 bg-red-950/10 hover:bg-red-950/30 text-red-400 rounded-xl text-xs font-mono transition cursor-pointer ${
                sidebarOpen ? 'w-full gap-2 py-2' : 'w-11 h-11 mx-auto'
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              {sidebarOpen && <span>Sign out</span>}
            </button>
          </div>
        </motion.aside>

        {/* --- CENTER WORKSPACE --- */}
        <main className="flex-1 min-w-0 flex flex-col min-h-screen">
          <header className="relative h-14 border-b border-white/10 bg-black/20 backdrop-blur-md px-6 hidden md:flex items-center justify-between z-20">
            <div className="flex items-center gap-2 font-mono text-xs text-white/40">
              <span>Console:</span>
              <span className="text-cyber-blue font-bold uppercase">{active?.name || 'OVERVIEW'}</span>
              <span className="hidden lg:flex items-center gap-2 ml-2 pl-3 border-l border-white/10">
                <CalendarDays className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/60 font-semibold tracking-wide">{dateStr}</span>
              </span>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 border border-white/10 bg-white/5 px-4 py-1.5 rounded-full font-mono">
              <Clock className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <span className="text-white font-bold font-mono text-lg min-w-[100px] text-center leading-none">
                {timeStr || '00:00:00'}
              </span>
              <div className="h-4 w-[1px] bg-white/15 ml-1.5 mr-0.5 shrink-0" />
              <button
                onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
                className={`relative flex h-5 w-9 items-center rounded-full transition-colors duration-200 cursor-pointer outline-none border border-white/10 shrink-0 ml-1.5 ${
                  themeMode === 'light' ? 'bg-zinc-300' : 'bg-zinc-800'
                }`}
                title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                aria-label={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full transition-transform duration-200 ${
                    themeMode === 'light' ? 'translate-x-0.5 bg-white text-amber-500' : 'translate-x-4 bg-zinc-950 text-white'
                  }`}
                >
                  {themeMode === 'light'
                    ? <Sun className="w-2.5 h-2.5 fill-amber-500 text-amber-500" strokeWidth={2.5} />
                    : <Moon className="w-2.5 h-2.5 fill-white text-white" strokeWidth={2.5} />}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyber-purple/30 bg-cyber-purple/10 text-[10px] font-mono font-bold uppercase tracking-wider text-cyber-purple">
                <Activity className="w-3 h-3" /> Staff access
              </span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 z-10 mt-14 md:mt-0 flex flex-col justify-between">
            <div className="flex-1 space-y-6">
              {showYearSelector && <YearSelector />}
              {children}
            </div>

            <footer className="mt-12 pt-4 border-t border-white/5 text-center font-mono text-[9px] text-white/30 space-y-1.5">
              <div>© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</div>
              <div className="flex items-center justify-center gap-3">
                <span>Contact: <a href="mailto:4mt24cs239@mite.ac.in" className="text-cyber-blue hover:underline">4mt24cs239@mite.ac.in</a></span>
                <span className="text-white/15">•</span>
                <a href="/privacy" className="text-cyber-blue hover:text-white transition hover:underline">Privacy Policy</a>
                <span className="text-white/15">•</span>
                <a href="/terms" className="text-cyber-blue hover:text-white transition hover:underline">Terms &amp; Conditions</a>
              </div>
            </footer>
          </div>
        </main>

        {/* Sign-out confirmation */}
        <AnimatePresence>
          {showSignOutConfirm && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isSigningOut && setShowSignOutConfirm(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="signout-title"
                className="glass-panel border border-white/15 p-6 rounded-2xl max-w-sm w-full relative z-10 bg-[#1E2126]"
              >
                <div className="flex items-center gap-3 text-white">
                  <LogOut className="w-5 h-5 text-cyber-blue" />
                  <h3 id="signout-title" className="text-base font-black tracking-wider uppercase">Sign out</h3>
                </div>
                <p className="text-xs text-white/60 font-mono mt-3 leading-relaxed">
                  You will be signed out of the admin console as{' '}
                  <span className="text-cyber-blue font-semibold">{adminEmail || adminName}</span>.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowSignOutConfirm(false)}
                    disabled={isSigningOut}
                    className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-40"
                  >
                    STAY SIGNED IN
                  </button>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="px-4 py-2 bg-red-950/45 hover:bg-red-900 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-60"
                  >
                    {isSigningOut ? 'SIGNING OUT...' : 'CONFIRM SIGN OUT'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Staff get the same reminders and the same extension prompt students do. */}
        <NotificationAgent />
        <NotificationCenter />
        <ExtensionNudge />
      </div>
    </AdminProvider>
  );
}

/**
 * The academic year every section below is scoped to.
 *
 * Separated out so it can read the context the provider above it supplies —
 * a component cannot consume a context its own render creates.
 */
function YearSelector() {
  const { selectedCohort, setSelectedCohort } = useAdmin();

  return (
    <section className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 shrink-0">
        Academic year
      </span>
      <div
        role="tablist"
        aria-label="Academic year"
        className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-max"
      >
        {COHORTS.map((c) => {
          const isActive = selectedCohort === c;
          return (
            <button
              key={c}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedCohort(c)}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                isActive
                  ? 'bg-cyber-blue text-white shadow-md'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {shortCohortLabel(c)}
            </button>
          );
        })}
      </div>
      <span className="text-[10px] font-mono text-white/25 leading-relaxed">
        Every panel below shows this year only.
      </span>
    </section>
  );
}
