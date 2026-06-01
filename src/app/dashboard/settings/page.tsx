'use client';

import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { 
  Settings, Key, Eye, EyeOff, Check, Sparkles, 
  User, Bell, Calendar, ShieldCheck, RefreshCw,
  AlertTriangle, Trash2, Loader2
} from 'lucide-react';

export default function SettingsPage() {
  const store = useStore();
  const { signOut } = useClerk();

  // Local profile states
  const [name, setName] = useState(store.user?.name || '');
  const [wakeTime, setWakeTime] = useState(store.user?.wakeTime || '06:00');
  const [sleepTime, setSleepTime] = useState(store.user?.sleepTime || '22:00');
  const [collegeStart, setCollegeStart] = useState(store.user?.collegeStart || '09:00');
  const [collegeEnd, setCollegeEnd] = useState(store.user?.collegeEnd || '16:00');

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

  const handleSystemReset = async () => {
    if (!confirm("Are you absolutely sure you want to erase all registration and application data? This action cannot be undone.")) {
      return;
    }

    setIsPurging(true);
    try {
      // Delete Firestore data + Clerk account server-side
      const res = await fetch('/api/user/purge', { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
    } catch (err: any) {
      console.error('Purge API error:', err);
      // Still clear local data even if server call fails
    } finally {
      // Clear local state first
      store.resetStore();
      // Sign out of Clerk to invalidate the client-side session,
      // then redirect — this prevents the stale-session blank page issue
      await signOut({ redirectUrl: '/' });
    }
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
