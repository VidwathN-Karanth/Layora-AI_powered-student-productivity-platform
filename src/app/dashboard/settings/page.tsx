'use client';

import { useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { suppressSupabaseSync } from '@/components/SyncProvider';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabaseClient';
import { 
  Settings, Key, Eye, EyeOff, Check, Sparkles, 
  User, Bell, Calendar, ShieldCheck, RefreshCw,
  AlertTriangle, Trash2, Loader2
} from 'lucide-react';

export default function SettingsPage() {
  const store = useStore();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();

  // Local profile states
  const [name, setName] = useState(store.user?.name || '');
  const [wakeTime, setWakeTime] = useState(store.user?.wakeTime || '06:00');
  const [sleepTime, setSleepTime] = useState(store.user?.sleepTime || '22:00');
  const [collegeStart, setCollegeStart] = useState(store.user?.collegeStart || '09:00');
  const [collegeEnd, setCollegeEnd] = useState(store.user?.collegeEnd || '16:00');

  const [leetcodeUsername, setLeetcodeUsername] = useState(store.user?.leetcodeUsername || '');
  const [githubUsername, setGithubUsername] = useState(store.user?.githubUsername || '');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateRoutine({
      name,
      wakeTime,
      sleepTime,
      collegeStart,
      collegeEnd
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleLinkAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setLinkSuccess(false);
    setIsLinking(true);

    const targetUserId = clerkUser?.id || store.user?.email || 'test_user';

    try {
      // 1. Register/Ensure User exists in the backend first
      const registerRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetUserId,
          name: name || clerkUser?.fullName || 'Anonymous User',
          email: store.user?.email || clerkUser?.primaryEmailAddress?.emailAddress || 'email@example.com'
        })
      });

      if (!registerRes.ok && registerRes.status !== 409) {
        const errorData = await registerRes.json();
        throw new Error(errorData.error || 'Failed to initialize user in backend');
      }

      // 2. Perform Account Link with Username verification
      const linkRes = await fetch(`/api/users/${targetUserId}/link-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leetcodeUsername: leetcodeUsername || null,
          githubUsername: githubUsername || null
        })
      });

      if (!linkRes.ok) {
        const errorData = await linkRes.json();
        throw new Error(errorData.error || 'Account linking failed');
      }

      // 3. Update Zustand Store
      store.updateRoutine({
        leetcodeUsername: leetcodeUsername || null,
        githubUsername: githubUsername || null
      });

      setLinkSuccess(true);
    } catch (err: any) {
      console.error('Account link failed:', err);
      if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
        setLinkError('Could not connect to the activity sync serverless backend. Please verify your internet connection.');
      } else {
        setLinkError(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleSystemReset = async () => {
    if (!confirm("Are you absolutely sure you want to erase all registration and application data? This action cannot be undone.")) {
      return;
    }

    setIsPurging(true);

    // STEP 1: Silence SyncProvider — must happen before anything else.
    // The realtime listener fires the instant a row is deleted and would
    // recreate it from local state. suppressSync blocks all Supabase writes.
    suppressSupabaseSync();

    // STEP 2: Wipe localStorage directly (no Zustand set(), no subscriber fires).
    window.localStorage.removeItem('layora-productivity-store');

    // STEP 3: Clear in-memory Zustand state.
    // Safe now — SyncProvider subscriber fires but suppressSync blocks the write.
    store.resetStore();

    // STEP 4: Delete Supabase row directly from the CLIENT.
    if (supabase && clerkUser?.id) {
      try {
        const { error } = await supabase.from('user_states').delete().eq('id', clerkUser.id);
        if (error) throw error;
        console.log('Purge: Supabase row deleted for', clerkUser.id);
      } catch (err: any) {
        console.error('Supabase delete failed:', err);
      }
    }

    // STEP 5: Sign out + hard reload to reset all module-level state.
    try { await signOut(); } catch (_) {}
    window.location.replace('/');
  };

  const themeAccents = [
    { name: 'purple', label: 'Neon Purple', color: 'bg-[#B026FF] border-[#e1a6ff]' },
    { name: 'blue', label: 'Cyber Blue', color: 'bg-[#00F0FF] border-[#a6f7ff]' },
    { name: 'pink', label: 'Tokyo Pink', color: 'bg-[#ff007f] border-[#ffa6d2]' },
    { name: 'emerald', label: 'Matrix Emerald', color: 'bg-[#10b981] border-[#a7f3d0]' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-outline-variant pb-4">
        <h2 className="text-xl font-mono font-bold tracking-wide">System Settings</h2>
        <p className="text-xs text-outline font-mono mt-0.5">Customize UI configurations and sync academic calendars.</p>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4 animate-bounce" />
          Configuration updated successfully
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- PANEL 1: ACCOUNT PROFILE & CYCLES --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Academic Rhythm Profile</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">Username / Alias</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-outline mb-1">Wake Cycle</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-outline mb-1">Sleep Cycle</label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-outline mb-1">College Start</label>
                <input
                  type="time"
                  value={collegeStart}
                  onChange={(e) => setCollegeStart(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-outline mb-1">College End</label>
                <input
                  type="time"
                  value={collegeEnd}
                  onChange={(e) => setCollegeEnd(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-4 py-2 text-xs font-mono font-bold transition cursor-pointer"
            >
              Save Rhythm Cycles
            </button>
          </form>
        </div>

        {/* --- PANEL 2: LEETCODE & GITHUB LINKING --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">LeetCode & GitHub Accounts</h3>
          </div>

          <form onSubmit={handleLinkAccounts} className="space-y-4">
            <p className="text-[10px] text-outline font-mono leading-relaxed">
              Link your public LeetCode and GitHub profiles to earn points daily for your solving activity and contributions! Leaderboard scores update every midnight UTC.
            </p>

            {linkError && (
              <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-[10px] font-mono leading-normal">
                ❌ {linkError}
              </div>
            )}

            {linkSuccess && (
              <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-[10px] font-mono">
                ✅ Accounts linked and verified successfully!
              </div>
            )}

            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">LeetCode Username</label>
              <input
                type="text"
                value={leetcodeUsername}
                onChange={(e) => setLeetcodeUsername(e.target.value)}
                placeholder="e.g. leetcode_user"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">GitHub Username</label>
              <input
                type="text"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                placeholder="e.g. github_user"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isLinking}
              className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-4 py-2 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verifying & Linking...
                </>
              ) : (
                'Link & Verify Accounts'
              )}
            </button>
          </form>
        </div>


        {/* --- PANEL 3: VISUAL THEMING --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Interface Theming</h3>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] text-outline font-mono">
              Toggle global neon themes to adjust border highlights and glowing overlays.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {themeAccents.map((acc) => {
                const active = store.themeAccent === acc.name;
                return (
                  <button
                    key={acc.name}
                    onClick={() => store.setThemeAccent(acc.name as any)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-mono transition text-left cursor-pointer ${
                      active 
                        ? 'border-primary bg-primary-fixed text-on-surface font-bold' 
                        : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border ${acc.color} shrink-0`}></span>
                    <span>{acc.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-outline-variant pt-4 space-y-2">
              <span className="text-[10px] font-mono text-outline uppercase block">Time Display Format</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => store.setIs24HourFormat(false)}
                  className={`p-2.5 rounded-xl border text-xs font-mono transition text-center cursor-pointer ${
                    !store.is24HourFormat
                      ? 'border-primary bg-primary-fixed text-on-surface font-bold'
                      : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  12-Hour (AM/PM)
                </button>
                <button
                  type="button"
                  onClick={() => store.setIs24HourFormat(true)}
                  className={`p-2.5 rounded-xl border text-xs font-mono transition text-center cursor-pointer ${
                    store.is24HourFormat
                      ? 'border-primary bg-primary-fixed text-on-surface font-bold'
                      : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  24-Hour
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* --- PANEL 4: CALENDAR INTEGRATIONS --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Calendar OAuth Integration</h3>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] text-outline font-mono leading-relaxed">
              Establish synchronization pathways with Google Calendar services. Auto-export allows agenda revisions in real-time.
            </p>

            <div className="bg-surface-container border border-outline-variant rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-on-surface block">Google OAuth Token</span>
                <span className="text-[9px] font-mono text-outline">Status: {store.calendarSynced ? 'Active Sync' : 'Inactive'}</span>
              </div>

              {store.calendarSynced ? (
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-600 bg-emerald-950/30 border border-emerald-500/20 rounded-full px-3 py-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> AUTHORIZED
                </div>
              ) : (
                <button
                  onClick={() => { store.setCalendarSynced(true); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); }}
                  className="bg-cyan-900/30 border border-secondary text-on-surface text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg hover:bg-cyan-900/50 transition cursor-pointer"
                >
                  Authorize OAuth
                </button>
              )}
            </div>
          </div>
        </div>

        {/* --- PANEL 5: DANGER ZONE (SYSTEM RESET) --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4 border border-rose-500/20 bg-rose-950/5">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-rose-500 uppercase">Danger Zone: Data Erasure</h3>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] text-outline font-mono leading-relaxed">
              Permanently clear your student registration details, timetable rhythm, tasks, and custom AI configurations. All local caches will be wiped. This action is irreversible.
            </p>

            <button
              onClick={handleSystemReset}
              disabled={isPurging}
              className="w-full bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-300 hover:text-on-surface text-xs font-mono font-bold py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPurging ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Purging Data...</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Erase All Registration & Store Data</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
