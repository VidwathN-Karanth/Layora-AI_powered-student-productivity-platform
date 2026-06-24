'use client';

import { useState, useEffect } from 'react';
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
  const [codechefUsername, setCodechefUsername] = useState(store.user?.codechefUsername || '');
  const [linkedinUrl, setLinkedinUrl] = useState(store.user?.linkedinUrl || '');
  const [linkingField, setLinkingField] = useState<'leetcode' | 'github' | 'codechef' | 'linkedin' | null>(null);
  const [linkErrors, setLinkErrors] = useState<{ leetcode?: string; github?: string; codechef?: string; linkedin?: string }>({});
  const [linkSuccesses, setLinkSuccesses] = useState<{ leetcode?: boolean; github?: boolean; codechef?: boolean; linkedin?: boolean }>({});

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string | undefined>>({});

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "This field cannot be empty";
    if (!wakeTime) errors.wakeTime = "This field cannot be empty";
    if (!sleepTime) errors.sleepTime = "This field cannot be empty";
    if (!collegeStart) errors.collegeStart = "This field cannot be empty";
    if (!collegeEnd) errors.collegeEnd = "This field cannot be empty";

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    store.updateRoutine({
      name,
      wakeTime,
      sleepTime,
      collegeStart,
      collegeEnd
    });
    setProfileErrors({});
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleLinkAccount = async (field: 'leetcode' | 'github' | 'codechef' | 'linkedin') => {
    let val = '';
    if (field === 'leetcode') val = leetcodeUsername.trim();
    if (field === 'codechef') val = codechefUsername.trim();
    if (field === 'github') val = githubUsername.trim();
    if (field === 'linkedin') val = linkedinUrl.trim();

    if (!val) {
      setLinkErrors(prev => ({ ...prev, [field]: "This field cannot be empty" }));
      return;
    }

    setLinkingField(field);
    setLinkErrors(prev => ({ ...prev, [field]: undefined }));
    setLinkSuccesses(prev => ({ ...prev, [field]: false }));

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
      const payload: Record<string, any> = {};
      if (field === 'leetcode') payload.leetcodeUsername = leetcodeUsername || null;
      if (field === 'codechef') payload.codechefUsername = codechefUsername || null;
      if (field === 'github') payload.githubUsername = githubUsername || null;
      if (field === 'linkedin') payload.linkedinUrl = linkedinUrl || null;

      const linkRes = await fetch(`/api/users/${targetUserId}/link-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!linkRes.ok) {
        const errorData = await linkRes.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      // 3. Update Zustand Store
      store.updateRoutine(payload);

      setLinkSuccesses(prev => ({ ...prev, [field]: true }));
    } catch (err: any) {
      console.error(`${field} link failed:`, err);
      const errMsg = err.message || 'An unexpected error occurred.';
      setLinkErrors(prev => ({ ...prev, [field]: errMsg }));
    } finally {
      setLinkingField(null);
    }
  };

  const handleSystemReset = async () => {
    if (!confirm("Are you absolutely sure you want to erase all registration and application data? This action cannot be undone.")) {
      return;
    }

    setIsPurging(true);

    suppressSupabaseSync();
    window.localStorage.removeItem('layora-productivity-store');
    store.resetStore();

    if (supabase && clerkUser?.id) {
      try {
        // 1. Delete from user_states
        const { error: stateError } = await supabase.from('user_states').delete().eq('id', clerkUser.id);
        if (stateError) throw stateError;

        // 2. Delete from daily_activities
        const { error: activityError } = await supabase.from('daily_activities').delete().eq('user_id', clerkUser.id);
        if (activityError) throw activityError;

        // 3. Delete from users
        const { error: userError } = await supabase.from('users').delete().eq('id', clerkUser.id);
        if (userError) throw userError;

        console.log('Purge: All Supabase data deleted for', clerkUser.id);
      } catch (err) {
        console.error('Supabase delete failed:', err);
      }
    }

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
      <div className="border-b border-outline-variant pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">System Configuration</h2>
          <p className="text-xs text-outline font-mono mt-0.5">Customize UI preferences, routine rhythms, and link accounts.</p>
        </div>
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

            <form onSubmit={handleSaveProfile} noValidate className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-outline mb-1">Username / Alias</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setProfileErrors(prev => ({ ...prev, name: undefined }));
                  }}
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
                {profileErrors.name && <p className="text-red-500 text-[10px] font-mono mt-1">{profileErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Wake Cycle</label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => {
                      setWakeTime(e.target.value);
                      setProfileErrors(prev => ({ ...prev, wakeTime: undefined }));
                    }}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                  />
                  {profileErrors.wakeTime && <p className="text-red-500 text-[10px] font-mono mt-1">{profileErrors.wakeTime}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Sleep Cycle</label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => {
                      setSleepTime(e.target.value);
                      setProfileErrors(prev => ({ ...prev, sleepTime: undefined }));
                    }}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                  />
                  {profileErrors.sleepTime && <p className="text-red-500 text-[10px] font-mono mt-1">{profileErrors.sleepTime}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">College Start</label>
                  <input
                    type="time"
                    value={collegeStart}
                    onChange={(e) => {
                      setCollegeStart(e.target.value);
                      setProfileErrors(prev => ({ ...prev, collegeStart: undefined }));
                    }}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                  />
                  {profileErrors.collegeStart && <p className="text-red-500 text-[10px] font-mono mt-1">{profileErrors.collegeStart}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">College End</label>
                  <input
                    type="time"
                    value={collegeEnd}
                    onChange={(e) => {
                      setCollegeEnd(e.target.value);
                      setProfileErrors(prev => ({ ...prev, collegeEnd: undefined }));
                    }}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                  />
                  {profileErrors.collegeEnd && <p className="text-red-500 text-[10px] font-mono mt-1">{profileErrors.collegeEnd}</p>}
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

          {/* --- PANEL 2: LEETCODE, GITHUB & CODECHEF LINKING --- */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-mono font-bold tracking-wider text-primary">LeetCode, GitHub & CodeChef Accounts</h3>
            </div>

            <div className="space-y-5">
              <p className="text-[10px] text-outline font-mono leading-relaxed">
                Link your public LeetCode and CodeChef profiles to earn points daily for your solving activity, and GitHub profile to display your contributions! Leaderboard scores update every midnight UTC.
                <br />
                <strong className="text-amber-500 block mt-1.5 uppercase tracking-wide">⚠️ For LeetCode, GitHub and CodeChef, only your username should be given, not the full link.</strong>
              </p>

              {/* LeetCode Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-outline mb-1">LeetCode Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={leetcodeUsername}
                    onChange={(e) => {
                      setLeetcodeUsername(e.target.value);
                      setLinkErrors(prev => ({ ...prev, leetcode: undefined }));
                    }}
                    placeholder="e.g. leetcode_user"
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('leetcode')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] min-w-[110px]"
                  >
                    {linkingField === 'leetcode' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Link & Verify'
                    )}
                  </button>
                </div>
                {linkErrors.leetcode && (
                  <div className="text-rose-400 text-[10px] font-mono mt-1">❌ {linkErrors.leetcode}</div>
                )}
                {linkSuccesses.leetcode && (
                  <div className="text-emerald-400 text-[10px] font-mono mt-1">✅ LeetCode account linked successfully!</div>
                )}
              </div>

              {/* CodeChef Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-outline mb-1">CodeChef Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={codechefUsername}
                    onChange={(e) => {
                      setCodechefUsername(e.target.value);
                      setLinkErrors(prev => ({ ...prev, codechef: undefined }));
                    }}
                    placeholder="e.g. codechef_user"
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('codechef')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] min-w-[110px]"
                  >
                    {linkingField === 'codechef' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Link & Verify'
                    )}
                  </button>
                </div>
                {linkErrors.codechef && (
                  <div className="text-rose-400 text-[10px] font-mono mt-1">❌ {linkErrors.codechef}</div>
                )}
                {linkSuccesses.codechef && (
                  <div className="text-emerald-400 text-[10px] font-mono mt-1">✅ CodeChef account linked successfully!</div>
                )}
              </div>

              {/* GitHub Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-outline mb-1">GitHub Username</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => {
                      setGithubUsername(e.target.value);
                      setLinkErrors(prev => ({ ...prev, github: undefined }));
                    }}
                    placeholder="e.g. github_user"
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('github')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] min-w-[110px]"
                  >
                    {linkingField === 'github' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Link & Verify'
                    )}
                  </button>
                </div>
                {linkErrors.github && (
                  <div className="text-rose-400 text-[10px] font-mono mt-1">❌ {linkErrors.github}</div>
                )}
                {linkSuccesses.github && (
                  <div className="text-emerald-400 text-[10px] font-mono mt-1">✅ GitHub account linked successfully!</div>
                )}
              </div>

              {/* LinkedIn Field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-outline mb-1">LinkedIn Account URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => {
                      setLinkedinUrl(e.target.value);
                      setLinkErrors(prev => ({ ...prev, linkedin: undefined }));
                    }}
                    placeholder="e.g. https://www.linkedin.com/in/username"
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('linkedin')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] min-w-[110px]"
                  >
                    {linkingField === 'linkedin' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Link & Verify'
                    )}
                  </button>
                </div>
                {linkErrors.linkedin && (
                  <div className="text-rose-400 text-[10px] font-mono mt-1">❌ {linkErrors.linkedin}</div>
                )}
                {linkSuccesses.linkedin && (
                  <div className="text-emerald-400 text-[10px] font-mono mt-1">✅ LinkedIn link saved successfully!</div>
                )}
              </div>
            </div>
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
