'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  ArrowRight, Bell, Link2, Lock, Puzzle, Settings as SettingsIcon, Sparkles,
  Trash2, User,
} from 'lucide-react';

import { useStore } from '@/store/useStore';
import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/dateFormat';
import {
  announce, clearTodaysNotificationMarks, permissionState, requestPermission,
  type NotificationPermissionState,
} from '@/lib/notifications';
import { SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   Staff settings.

   The same three things a student can change about how Layora behaves on their
   own device — reminders, the extension, and the look of the interface —
   minus the ones that only mean something for a student (coding profiles, CV,
   year group). Staff had none of these before: the console had a light/dark
   pair in its header and nothing else.
   ──────────────────────────────────────────────────────────────── */

interface Connection {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** A user agent is unreadable; the browser and platform out of it are not. */
function shortLabel(label: string | null): string {
  if (!label) return 'A browser';
  const browser =
    /Edg\//.test(label) ? 'Edge'
    : /OPR\//.test(label) ? 'Opera'
    : /Firefox\//.test(label) ? 'Firefox'
    : /Chrome\//.test(label) ? 'Chrome'
    : /Safari\//.test(label) ? 'Safari'
    : 'A browser';

  const platform =
    /Windows/.test(label) ? 'Windows'
    : /Mac OS X|Macintosh/.test(label) ? 'macOS'
    : /Android/.test(label) ? 'Android'
    : /iPhone|iPad/.test(label) ? 'iOS'
    : /Linux/.test(label) ? 'Linux'
    : '';

  return platform ? `${browser} on ${platform}` : browser;
}

export default function AdminSettingsPage() {
  const store = useStore();
  const { user } = useUser();

  const displayName = user?.fullName || 'Administrator';
  const email = user?.primaryEmailAddress?.emailAddress || '—';

  // The browser's own permission, which is separate from the preference: an
  // admin can want reminders while the browser blocks them.
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>('default');

  // Read after mount, never during render: the server has no Notification API,
  // so reading it inline would not match what the browser hydrates.
  useEffect(() => {
    const id = setTimeout(() => setNotifPermission(permissionState()), 0);
    return () => clearTimeout(id);
  }, []);

  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionError, setConnectionError] = useState('');

  const loadConnections = useCallback(async () => {
    try {
      const data = await readJson<{ tokens?: Connection[] }>(await apiFetch('/api/extension/token'));
      setConnections(data.tokens || []);
    } catch (err) {
      setConnectionError(errorMessage(err, 'Could not list connected browsers.'));
    }
  }, []);

  useSectionData(loadConnections);

  const enableNotifications = async () => {
    // Inside the click on purpose — a permission request without a user
    // gesture is ignored, or silently denied, by most browsers.
    const state = await requestPermission();
    setNotifPermission(state);
    if (state === 'granted') {
      store.setNotificationsEnabled(true);
      announce({
        title: 'Reminders are on',
        body: 'This is what a Layora reminder looks like.',
        tag: 'layora-test',
      });
    }
  };

  /**
   * Proves the whole path in one click, with no timing involved.
   *
   * If the toast appears but no desktop alert does, the browser permission is
   * the missing piece. If neither appears, reminders are switched off.
   */
  const sendTestReminder = () => {
    clearTodaysNotificationMarks();
    announce({
      title: 'Test reminder',
      body: 'If you can see this, reminders are working on this device.',
      tag: 'layora-test-reminder',
      kind: 'event',
    });
  };

  const disconnect = async (id: string) => {
    if (!confirm('Disconnect that browser? Its extension will stop showing your launchers.')) return;
    setConnectionError('');
    try {
      await readJson(await apiFetch(`/api/extension/token?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
      setConnections((current) => current.filter((c) => c.id !== id));
    } catch (err) {
      setConnectionError(errorMessage(err, 'Could not disconnect that browser.'));
    }
  };

  const reminderState =
    notifPermission === 'unsupported'
      ? 'In-app only here — this browser has no system notifications'
      : notifPermission === 'denied'
        ? 'System alerts blocked — allow them in your browser settings'
        : notifPermission === 'granted'
          ? store.notificationsEnabled ? 'On, including system alerts' : 'Switched off'
          : store.notificationsEnabled
            ? 'On in the app — allow system alerts too'
            : 'Switched off';

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Reminders, the browser extension, and how the console looks on this device."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- PANEL 1: ACCOUNT & REMINDERS --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Account</h3>
          </div>

          {/* Neither is editable: both come from the college Google account. */}
          <div>
            <span className="block text-[10px] font-mono text-outline mb-1">Name</span>
            <div className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant flex items-center justify-between gap-2">
              <span className="truncate">{displayName}</span>
              <Lock className="w-3 h-3 text-outline shrink-0" />
            </div>
          </div>

          <div>
            <span className="block text-[10px] font-mono text-outline mb-1">Staff email</span>
            <div className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface-variant flex items-center justify-between gap-2">
              <span className="truncate">{email}</span>
              <Lock className="w-3 h-3 text-outline shrink-0" />
            </div>
            <p className="text-[9px] font-mono text-outline mt-1">
              Staff access is granted by this address. It is set in the code, not here.
            </p>
          </div>

          <div className="pt-1 border-t border-outline-variant/40">
            <div className="bg-surface-container border border-outline-variant rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-mono font-bold text-on-surface flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-primary" /> Reminders
                </span>
                <span className="text-[9px] font-mono text-outline">{reminderState}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {store.notificationsEnabled
                  && notifPermission !== 'granted'
                  && notifPermission !== 'unsupported'
                  && notifPermission !== 'denied' && (
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
                  <span className={`h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200 ${
                    store.notificationsEnabled ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            <p className="text-[9px] font-mono text-outline mt-2.5 leading-relaxed">
              One switch for every reminder Layora sends you. Staff reminders cover what the
              department has scheduled today, across every year. Turn it on separately on each
              device you use — nothing is emailed.
            </p>
          </div>
        </div>

        {/* --- PANEL 2: BROWSER EXTENSION --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <Puzzle className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Browser Extension</h3>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            The same extension students use. Install it once, press Connect, and your quick
            launchers are one click from any tab — add a link straight from the popup and it
            appears on your Overview too.
          </p>

          <a
            href="/extension"
            className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-white/2 p-3.5 transition hover:border-primary hover:bg-surface-container cursor-pointer group"
          >
            <span className="min-w-0">
              <span className="block text-xs font-mono font-bold text-on-surface">
                Install &amp; connect the extension
              </span>
              <span className="block text-[10px] font-mono text-outline mt-0.5">
                Firefox, Chrome, Edge and other Chromium browsers
              </span>
            </span>
            <ArrowRight className="w-4 h-4 shrink-0 text-outline transition group-hover:text-primary group-hover:translate-x-0.5" />
          </a>

          <div className="pt-1 border-t border-outline-variant/40 space-y-2">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-outline">
              Connected browsers
            </span>

            {connectionError && (
              <p className="text-[10px] font-mono text-red-400">{connectionError}</p>
            )}

            {connections.length === 0 ? (
              <p className="text-[10px] font-mono text-outline leading-relaxed">
                No browser is connected yet. Nothing will appear in the extension popup until one is.
              </p>
            ) : (
              <ul className="divide-y divide-outline-variant/40">
                {connections.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <span className="flex items-center gap-2 text-xs text-on-surface">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{shortLabel(c.label)}</span>
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-outline">
                        Connected {formatDateTime(c.createdAt)}
                        {c.lastUsedAt ? ` · last used ${formatDateTime(c.lastUsedAt)}` : ' · not used yet'}
                      </span>
                    </div>
                    <button
                      onClick={() => disconnect(c.id)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-outline transition hover:border-rose-500/40 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* --- PANEL 3: INTERFACE --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Interface</h3>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono text-outline uppercase block">Theme mode</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { mode: 'light' as const, label: '☀️ Light Mode' },
                { mode: 'dark' as const, label: '🌙 Dark Mode' },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => store.setThemeMode(mode)}
                  className={`p-2.5 rounded-xl border text-xs font-mono transition text-center cursor-pointer ${
                    (store.themeMode || 'dark') === mode
                      ? 'border-primary bg-primary text-white font-bold'
                      : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-outline-variant pt-4 space-y-2">
            <span className="text-[10px] font-mono text-outline uppercase block">Time display format</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { is24: false, label: '12-Hour (AM/PM)' },
                { is24: true, label: '24-Hour' },
              ]).map(({ is24, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => store.setIs24HourFormat(is24)}
                  className={`p-2.5 rounded-xl border text-xs font-mono transition text-center cursor-pointer ${
                    store.is24HourFormat === is24
                      ? 'border-primary bg-primary text-white font-bold'
                      : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
