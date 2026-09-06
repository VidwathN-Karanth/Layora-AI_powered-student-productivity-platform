'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { apiFetch, readJson, errorMessage } from '@/lib/apiClient';
import ResumePanel from '@/components/ResumePanel';
import InfoPopover from '@/components/InfoPopover';
import { 
  Check, Sparkles, User, Bell, BellOff, Calendar,
  ShieldCheck, Loader2, Lock, Puzzle, ArrowRight
} from 'lucide-react';
import {
  alreadyNotified, announce, clearTodaysNotificationMarks, diagnoseCourseReminders,
  permissionState, requestPermission, type NotificationPermissionState,
} from '@/lib/notifications';
import { toDateKey } from '@/lib/dateFormat';
import { useExtensionInstalled, useStoreTarget } from '@/lib/extension';

export default function SettingsPage() {
  const store = useStore();
  const { user: clerkUser } = useUser();

  // Whether this browser already has the extension, and where it would get it.
  // `null` means the browser could not be asked (Firefox has no equivalent of
  // externally_connectable), so the panel falls back to simply offering it.
  const extensionInstalled = useExtensionInstalled();
  const extensionStore = useStoreTarget();

  // Local profile states
  // The display name is read-only — Clerk (Google) is the source of truth.
  const displayName = clerkUser?.fullName || store.user?.name || 'Student';
  const [leetcodeUsername, setLeetcodeUsername] = useState(store.user?.leetcodeUsername || '');
  const [githubUsername, setGithubUsername] = useState(store.user?.githubUsername || '');
  const [codechefUsername, setCodechefUsername] = useState(store.user?.codechefUsername || '');
  const [linkedinUrl, setLinkedinUrl] = useState(store.user?.linkedinUrl || '');
  const [linkingField, setLinkingField] = useState<'leetcode' | 'github' | 'codechef' | 'linkedin' | null>(null);
  const [linkErrors, setLinkErrors] = useState<{ leetcode?: string; github?: string; codechef?: string; linkedin?: string }>({});
  const [linkSuccesses, setLinkSuccesses] = useState<{ leetcode?: boolean; github?: boolean; codechef?: boolean; linkedin?: boolean }>({});

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string | undefined>>({});

  // The browser's own permission, which is separate from the student's
  // preference: they can want reminders while the browser blocks them.
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>('default');
  // Read after mount, never during render: the server has no Notification API,
  // so reading it inline would not match what the browser hydrates.
  useEffect(() => {
    const id = setTimeout(() => setNotifPermission(permissionState()), 0);
    return () => clearTimeout(id);
  }, []);

  const enableNotifications = async () => {
    // Inside the click on purpose — a permission request without a user
    // gesture is ignored, or silently denied, by most browsers.
    const state = await requestPermission();
    setNotifPermission(state);
    if (state === 'granted') {
      store.setNotificationsEnabled(true);
      announce({ title: 'Reminders are on', body: 'This is what a Layora reminder looks like.', tag: 'layora-test' });
    }
  };

  /**
   * Proves the whole path in one click, with no timing involved.
   *
   * If the toast appears but no desktop alert does, the browser permission is
   * the missing piece. If neither appears, reminders are switched off. Also
   * clears today's "already announced" marks, so a real reminder that already
   * fired can fire again while testing.
   */
  // Recomputed on every render, which is often enough for a settings page and
  // avoids another timer. Reading it is what turns "nothing happened" into a
  // specific reason.
  const reminderDiagnosis = diagnoseCourseReminders(
    store.courses,
    new Date(),
    (key) => alreadyNotified(key, toDateKey(new Date()))
  );

  const sendTestReminder = () => {
    clearTodaysNotificationMarks();
    announce({
      title: 'Course: test reminder',
      body: 'If you can see this, reminders are working on this device.',
      tag: 'layora-test-reminder',
      kind: 'course',
    });
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
      // Identity comes from the session server-side; nothing to send.
      const registerRes = await apiFetch('/api/users', { method: 'POST' });

      // 409 just means the profile already exists, which is the normal case.
      if (!registerRes.ok && registerRes.status !== 409) {
        await readJson(registerRes); // throws an ApiError carrying the real reason
      }

      // 2. Perform Account Link with Username verification
      const payload: Record<string, any> = {};
      if (field === 'leetcode') payload.leetcodeUsername = leetcodeUsername || null;
      if (field === 'codechef') payload.codechefUsername = codechefUsername || null;
      if (field === 'github') payload.githubUsername = githubUsername || null;
      if (field === 'linkedin') payload.linkedinUrl = linkedinUrl || null;

      const linkRes = await apiFetch(`/api/users/${targetUserId}/link-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!linkRes.ok) {
        await readJson(linkRes); // throws an ApiError carrying the real reason
      }

      // 3. Update Zustand Store
      store.updateRoutine(payload);

      setLinkSuccesses(prev => ({ ...prev, [field]: true }));
    } catch (err: unknown) {
      console.error(`${field} link failed:`, err);
      setLinkErrors(prev => ({ ...prev, [field]: errorMessage(err, 'An unexpected error occurred.') }));
    } finally {
      setLinkingField(null);
    }
  };


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
          {/* --- PANEL 1: ACCOUNT --- */}
          {/*
            This used to ask for wake time, sleep time and college start/end.
            One department on one timetable answered them identically every
            time, so the questions are gone and the scheduler uses a fixed day
            (DEFAULT_ROUTINE in src/lib/scheduler.ts).
          */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2 relative">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Account</h3>
              </div>
              <InfoPopover label="What reminders does this cover?">
                <div className="space-y-2.5">
                  <p className="text-[10px] font-mono text-on-surface-variant leading-relaxed">
                    One switch for every reminder Layora sends. Turning it off silences all of
                    them. Turn it on separately on every device you use — reminders appear on
                    whichever device has Layora open, and nothing is emailed.
                  </p>
                  <ul className="space-y-1.5 text-[9px] font-mono text-outline leading-relaxed">
                    <li className="flex items-start gap-2">
                      <Bell className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
                      <span>Today&rsquo;s events, once, when you open the workspace.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Bell className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
                      <span>Timetable blocks, a few minutes before each starts — switch these on their own with &ldquo;Planner alerts&rdquo; on the Weekly Planner.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Bell className="w-3 h-3 mt-0.5 shrink-0 text-primary/60" />
                      <span>Course reminders, at the time set on each course under &ldquo;Daily Notification&rdquo;.</span>
                    </li>
                  </ul>
                  <div className="flex items-start gap-2 text-[9px] font-mono text-outline leading-relaxed pt-2 border-t border-outline-variant/40">
                    <Calendar className="w-3 h-3 mt-0.5 shrink-0" />
                    <p>
                      Want them in the Google Calendar app instead? Use &ldquo;Sync to Google
                      Calendar&rdquo; on the Events page, or on the Weekly Planner for study blocks.
                    </p>
                  </div>
                </div>
              </InfoPopover>
            </div>

            {/* Name is not editable: it comes from the college Google account so
                the leaderboard and the admin console always show real people. */}
            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">Name</label>
              <div className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant flex items-center justify-between gap-2">
                <span className="truncate">{displayName}</span>
                <Lock className="w-3 h-3 text-outline shrink-0" />
              </div>
              <p className="text-[9px] font-mono text-outline mt-1">
                Taken from your college Google account.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">College email</label>
              <div className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant flex items-center justify-between gap-2">
                <span className="truncate">{clerkUser?.primaryEmailAddress?.emailAddress || store.user?.email || '—'}</span>
                <Lock className="w-3 h-3 text-outline shrink-0" />
              </div>
              <p className="text-[9px] font-mono text-outline mt-1">
                Your year group is set from this address by the department roster.
              </p>
            </div>

            {/* Reminders live here rather than in a panel of their own — one
                switch does not need a whole card. */}
            <div className="pt-1 border-t border-outline-variant/40">
              <div className="bg-surface-container border border-outline-variant rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-on-surface flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-primary" /> Reminders
                  </span>
                  <span className="text-[9px] font-mono text-outline">
                    {notifPermission === 'unsupported'
                      ? 'In-app only here — add Layora to your Home Screen for phone alerts'
                      : notifPermission === 'denied'
                        ? 'System alerts blocked — allow them in your browser settings'
                        : notifPermission === 'granted'
                          ? store.notificationsEnabled ? 'On, including system alerts' : 'Switched off'
                          : store.notificationsEnabled
                            ? 'On in the app — allow system alerts too'
                            : 'Switched off'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {store.notificationsEnabled && notifPermission !== 'granted' && notifPermission !== 'unsupported' && notifPermission !== 'denied' && (
                    <button
                      onClick={enableNotifications}
                      className="bg-primary/10 border border-primary/30 text-primary text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg hover:bg-primary/20 transition cursor-pointer"
                    >
                      Allow
                    </button>
                  )}
                  <button
                    onClick={sendTestReminder}
                    title="Send a test reminder now"
                    className="border border-outline-variant text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:border-primary hover:text-primary transition cursor-pointer"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => store.setNotificationsEnabled(!store.notificationsEnabled)}
                    role="switch"
                    aria-checked={store.notificationsEnabled}
                    aria-label="Reminders"
                    className={`relative flex h-5 w-9 items-center rounded-full transition-colors duration-200 cursor-pointer border ${
                      store.notificationsEnabled ? 'bg-primary border-primary' : 'bg-surface-container-high border-outline-variant'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200 ${
                        store.notificationsEnabled ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Why a course reminder did or did not fire. Silence is the one
                  thing a reminder cannot explain about itself. */}
              {reminderDiagnosis.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-outline">Course reminders</p>
                  {reminderDiagnosis.map((d) => (
                    <div key={`${d.name}-${d.time}`} className="flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span className="text-on-surface-variant truncate">{d.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-outline tabular-nums">{d.time}</span>
                        <span className={
                          d.status === 'due now' ? 'text-emerald-400'
                          : d.status === 'already sent today' ? 'text-outline'
                          : d.status === 'not due yet' ? 'text-on-surface-variant'
                          : 'text-red-400'
                        }>
                          {d.status}
                        </span>
                      </span>
                    </div>
                  ))}
                  {/* Only ever one explanation at a time: the earlier version said
                      "cannot show" and "not allowed yet" together, which is a
                      contradiction. */}
                  {notifPermission === 'unsupported' ? (
                    <p className="text-[9px] font-mono text-amber-400/80 leading-relaxed pt-1">
                      This browser has no system notifications. On iPhone, use Share → Add to Home
                      Screen and open Layora from there. Reminders still appear inside the app.
                    </p>
                  ) : notifPermission === 'denied' ? (
                    <p className="text-[9px] font-mono text-amber-400/80 leading-relaxed pt-1">
                      System alerts are blocked for this site in your browser settings. Reminders
                      still appear inside the app.
                    </p>
                  ) : notifPermission !== 'granted' ? (
                    <p className="text-[9px] font-mono text-amber-400/80 leading-relaxed pt-1">
                      System alerts are not allowed yet — tap Allow above. Reminders still appear
                      inside the app.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
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
                {/* Stacks on a phone: side by side, a 110px button left the
                    username field too narrow to read what was typed. */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={leetcodeUsername}
                    onChange={(e) => {
                      setLeetcodeUsername(e.target.value);
                      setLinkErrors(prev => ({ ...prev, leetcode: undefined }));
                    }}
                    placeholder="e.g. leetcode_user"
                    className="flex-1 min-w-0 w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('leetcode')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] shrink-0 whitespace-nowrap min-w-0 sm:min-w-[110px]"
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
                {/* Stacks on a phone: side by side, a 110px button left the
                    username field too narrow to read what was typed. */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={codechefUsername}
                    onChange={(e) => {
                      setCodechefUsername(e.target.value);
                      setLinkErrors(prev => ({ ...prev, codechef: undefined }));
                    }}
                    placeholder="e.g. codechef_user"
                    className="flex-1 min-w-0 w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('codechef')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] shrink-0 whitespace-nowrap min-w-0 sm:min-w-[110px]"
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
                {/* Stacks on a phone: side by side, a 110px button left the
                    username field too narrow to read what was typed. */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => {
                      setGithubUsername(e.target.value);
                      setLinkErrors(prev => ({ ...prev, github: undefined }));
                    }}
                    placeholder="e.g. github_user"
                    className="flex-1 min-w-0 w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('github')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] shrink-0 whitespace-nowrap min-w-0 sm:min-w-[110px]"
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
                {/* Stacks on a phone: side by side, a 110px button left the
                    username field too narrow to read what was typed. */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => {
                      setLinkedinUrl(e.target.value);
                      setLinkErrors(prev => ({ ...prev, linkedin: undefined }));
                    }}
                    placeholder="e.g. https://www.linkedin.com/in/username"
                    className="flex-1 min-w-0 w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={linkingField !== null}
                    onClick={() => handleLinkAccount('linkedin')}
                    className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98] h-[34px] shrink-0 whitespace-nowrap min-w-0 sm:min-w-[110px]"
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

          {/* --- PANEL 3: RESUME / CV --- */}
          <ResumePanel />

          {/* --- PANEL 4: BROWSER EXTENSION --- */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
              <Puzzle className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Browser Extension</h3>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Put your quick launchers and courses one click from any tab. Install it once,
              press Connect, and add links straight from the popup.
            </p>

            {extensionInstalled === true ? (
              <p className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-[11px] font-mono text-on-surface-variant">
                <Check className="w-3.5 h-3.5 shrink-0 text-primary" />
                Installed in this browser.
              </p>
            ) : (
              <a
                href={extensionStore.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition hover:opacity-90"
              >
                <Puzzle className="w-3.5 h-3.5" /> {extensionStore.label}
              </a>
            )}

            <a
              href="/extension"
              className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-white/2 p-3.5 transition hover:border-primary hover:bg-surface-container cursor-pointer group"
            >
              <span className="min-w-0">
                <span className="block text-xs font-mono font-bold text-on-surface">
                  {extensionInstalled === true
                    ? 'Connect it to your account'
                    : 'Install & connect the extension'}
                </span>
                <span className="block text-[10px] font-mono text-outline mt-0.5">
                  Firefox, Chrome, Edge and other Chromium browsers
                </span>
              </span>
              <ArrowRight className="w-4 h-4 shrink-0 text-outline transition group-hover:text-primary group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* --- PANEL 5: VISUAL THEMING --- */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Interface Theming</h3>
            </div>

            <div className="space-y-4">
              {/* Light/Dark Mode Switcher */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-outline uppercase block">Theme Mode</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => store.setThemeMode('light')}
                    className={`p-2.5 rounded-xl border text-xs font-mono transition text-center cursor-pointer ${
                      store.themeMode === 'light'
                        ? 'border-primary bg-primary text-white font-bold'
                        : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    ☀️ Light Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => store.setThemeMode('dark')}
                    className={`p-2.5 rounded-xl border text-xs font-mono transition text-center cursor-pointer ${
                      store.themeMode === 'dark' || !store.themeMode
                        ? 'border-primary bg-primary text-white font-bold'
                        : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    🌙 Dark Mode
                  </button>
                </div>
              </div>



              <div className="border-t border-outline-variant pt-4 space-y-2">
                <span className="text-[10px] font-mono text-outline uppercase block">Time Display Format</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => store.setIs24HourFormat(false)}
                    className={`p-2.5 rounded-xl border text-xs font-mono transition text-center cursor-pointer ${
                      !store.is24HourFormat
                        ? 'border-primary bg-primary text-white font-bold'
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
                        ? 'border-primary bg-primary text-white font-bold'
                        : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    24-Hour
                  </button>
                </div>
              </div>
            </div>
          </div>

      </div>
    </div>
  );
}
