'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Check, Link2, Loader2, Plug, ShieldCheck, Trash2 } from 'lucide-react';

import { apiFetch, readJson, errorMessage } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/dateFormat';
import ExtensionInstall from '@/components/ExtensionInstall';

/* ────────────────────────────────────────────────────────────────
   Install and connect the browser extension.

   Chrome removed inline installation in 2018, so no page can install an
   extension on a visitor's behalf — the honest flow is a Web Store link, or
   the unpacked route while the listing is pending. What this page *can* do is
   the fiddly half: pair the installed extension with the signed-in account in
   one press, with no ids to copy.
   ──────────────────────────────────────────────────────────────── */

interface Connection {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

type ConnectState = 'idle' | 'working' | 'done' | 'error';

/** Set once this browser has been paired without being asked. */
const AUTO_CONNECT_KEY = 'layora:ext-autoconnected';

export default function ExtensionPage() {
  const { isLoaded, isSignedIn } = useUser();

  const [installed, setInstalled] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectState, setConnectState] = useState<ConnectState>('idle');
  const [message, setMessage] = useState('');

  /** The extension's content script answers a ping; nothing else can. */
  useEffect(() => {
    let settled = false;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; installed?: boolean } | null;
      if (data?.type === 'layora:pong') {
        settled = true;
        setInstalled(true);
      }
    };

    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'layora:ping' }, window.location.origin);

    // No answer in a second means it is not there.
    const timer = setTimeout(() => { if (!settled) setInstalled(false); }, 1000);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };
  }, []);

  const loadConnections = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const data = await readJson<{ tokens?: Connection[] }>(await apiFetch('/api/extension/token'));
      setConnections(data.tokens || []);
    } catch {
      // A failure here only hides the list; connecting still works.
    }
  }, [isSignedIn]);

  // Inlined rather than calling loadConnections here: the state update is
  // already behind an await, but the lint rule cannot see through the call.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await readJson<{ tokens?: Connection[] }>(await apiFetch('/api/extension/token'));
        if (!cancelled) setConnections(data.tokens || []);
      } catch {
        // Only hides the list; connecting still works.
      }
    })();

    return () => { cancelled = true; };
  }, [isSignedIn]);

  /** Mint a token and hand it to the extension. No ids, no copy-paste. */
  const connect = useCallback(async (auto = false) => {
    setConnectState('working');
    setMessage('');

    try {
      const { token } = await readJson<{ token: string }>(
        await apiFetch('/api/extension/token', {
          method: 'POST',
          body: JSON.stringify({ label: navigator.userAgent.slice(0, 80) }),
        })
      );

      const settled = new Promise<{ ok: boolean; error?: string | null }>((resolve) => {
        const onResult = (event: MessageEvent) => {
          if (event.source !== window || event.origin !== window.location.origin) return;
          const data = event.data as { type?: string; ok?: boolean; error?: string } | null;
          if (data?.type === 'layora:connect:result') {
            window.removeEventListener('message', onResult);
            resolve({ ok: Boolean(data.ok), error: data.error });
          }
        };
        window.addEventListener('message', onResult);
        setTimeout(() => {
          window.removeEventListener('message', onResult);
          resolve({ ok: false, error: 'The extension did not answer. Is it installed and enabled?' });
        }, 4000);
      });

      window.postMessage({ type: 'layora:connect', token }, window.location.origin);
      const result = await settled;

      if (!result.ok) {
        setConnectState('error');
        setMessage(result.error || 'Could not reach the extension.');
        return;
      }

      setConnectState('done');
      setMessage(
        auto
          ? 'Connected automatically. Open the extension from your toolbar.'
          : 'Connected. Open the extension from your toolbar.'
      );
      await loadConnections();
    } catch (err) {
      setConnectState('error');
      setMessage(errorMessage(err, 'Could not create a connection.'));
    }
  }, [loadConnections]);

  /* ── Connect it without being asked ──
     A student who has just installed from the store should not have to find a
     button to finish. When this page can see the extension and the account at
     the same time, it pairs them itself.

     Guarded by a flag in localStorage, because every connection mints a token
     and a fresh one on every page load would litter the list below with
     duplicates. One automatic connection per browser; the button stays for
     every case after that, including reconnecting a browser disconnected by
     hand. Storage being unavailable reads as already-done, which errs towards
     doing nothing. */
  useEffect(() => {
    if (!isSignedIn || installed !== true || connectState !== 'idle') return;

    let already = true;
    try {
      already = window.localStorage.getItem(AUTO_CONNECT_KEY) !== null;
    } catch {
      // Private mode. Leave it to the button.
    }
    if (already) return;

    try {
      window.localStorage.setItem(AUTO_CONNECT_KEY, String(Date.now()));
    } catch {
      return;
    }

    // Deferred so the effect body never starts a state update synchronously.
    queueMicrotask(() => { void connect(true); });
  }, [isSignedIn, installed, connectState, connect]);

  const disconnect = async (id: string) => {
    try {
      await readJson(await apiFetch(`/api/extension/token?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
      setConnections((current) => current.filter((c) => c.id !== id));
    } catch (err) {
      setMessage(errorMessage(err, 'Could not disconnect that.'));
    }
  };

  return (
    <main className="min-h-screen bg-surface text-on-surface px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Browser extension
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Layora Quick Access</h1>
          <p className="max-w-xl text-sm leading-relaxed text-on-surface-variant">
            Your quick launchers and course list, one click from any tab — without opening the
            dashboard. Add a link straight from the popup and it appears in Layora too.
          </p>
        </header>

        {/* ── Step 1: install ── */}
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 font-mono text-[11px] font-bold text-primary">1</span>
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Install it
            </h2>
          </div>

          <ExtensionInstall />

        </section>

        {/* ── Step 2: connect ── */}
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 font-mono text-[11px] font-bold text-primary">2</span>
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Connect it to your account
            </h2>
          </div>

          {!isLoaded ? (
            <p className="mt-5 text-sm text-outline">Checking your session…</p>
          ) : !isSignedIn ? (
            <p className="mt-5 text-sm text-on-surface-variant">
              <a href="/login" className="text-primary font-semibold">Sign in</a> first, then come
              back to this page to connect.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              <button
                onClick={() => void connect()}
                disabled={connectState === 'working'}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition hover:opacity-90 disabled:opacity-50"
              >
                {connectState === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                {connectState === 'done' ? 'Connected' : 'Connect the extension'}
              </button>

              {installed === false && (
                <p className="font-mono text-[11px] text-amber-400">
                  The extension has not been detected on this browser yet. Finish step 1, then reload this page.
                </p>
              )}

              {message && (
                <p className={`font-mono text-[11px] ${connectState === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {connectState === 'done' && <Check className="mr-1 inline h-3 w-3" />}
                  {message}
                </p>
              )}

              <p className="flex items-start gap-2 border-t border-outline-variant pt-4 text-xs leading-relaxed text-outline">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Connecting stores one key for this browser. It reads your launchers and courses and
                can add a launcher — nothing else, and never anyone else&rsquo;s data. Disconnect any
                time below.
              </p>
            </div>
          )}
        </section>

        {/* ── Connected browsers ── */}
        {isSignedIn && connections.length > 0 && (
          <section className="rounded-2xl border border-outline-variant bg-surface-container p-6">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Connected browsers
            </h2>
            <ul className="mt-4 divide-y divide-outline-variant/40">
              {connections.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{shortLabel(c.label)}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-outline">
                      Connected {formatDateTime(c.createdAt)}
                      {c.lastUsedAt ? ` · last used ${formatDateTime(c.lastUsedAt)}` : ' · not used yet'}
                    </div>
                  </div>
                  <button
                    onClick={() => disconnect(c.id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-outline transition hover:border-rose-500/40 hover:text-rose-400"
                  >
                    <Trash2 className="h-3 w-3" /> Disconnect
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

/** A user agent is unreadable; the browser and platform out of it are not. */
function shortLabel(label: string | null): string {
  if (!label) return 'This browser';
  const browser = /Edg\//.test(label) ? 'Edge'
    : /OPR\//.test(label) ? 'Opera'
    : /Firefox\//.test(label) ? 'Firefox'
    : /Chrome\//.test(label) ? 'Chrome'
    : /Safari\//.test(label) ? 'Safari'
    : 'Browser';
  const platform = /Windows/.test(label) ? 'Windows'
    : /Macintosh|Mac OS/.test(label) ? 'macOS'
    : /Android/.test(label) ? 'Android'
    : /Linux/.test(label) ? 'Linux'
    : '';
  return platform ? `${browser} on ${platform}` : browser;
}
