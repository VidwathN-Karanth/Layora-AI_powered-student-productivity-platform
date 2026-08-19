'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { COLLEGE_EMAIL_DOMAIN } from '@/lib/cohorts';
import { apiFetch } from '@/lib/apiClient';
import { useStore } from '@/store/useStore';

type Reason = 'wrong_domain' | 'not_on_roster' | 'signed_out' | null;

export default function AccessDeniedPage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const store = useStore();

  const [reason, setReason] = useState<Reason>(null);
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await apiFetch('/api/me');
        const data = await res.json();
        if (cancelled) return;

        // Access was granted after all (the lecturer added them, or they
        // signed in with the right account) — send them where they belong.
        if (data.allowed) {
          router.replace(data.isAdmin ? '/admin' : '/dashboard');
          return;
        }

        setEmail(data.email || '');
        setReason(data.reason || 'signed_out');
      } catch {
        if (!cancelled) setReason('signed_out');
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [router]);

  const handleSignOut = async () => {
    store.logout();
    await signOut();
    router.replace('/login');
  };

  const copy = {
    wrong_domain: {
      title: 'Use your college account',
      body: `Layora is open only to CSE department accounts ending in @${COLLEGE_EMAIL_DOMAIN}. Sign out and sign back in with your college Google account.`,
      action: 'Sign out and try again',
    },
    not_on_roster: {
      title: 'You are not on the roster yet',
      body: 'Your college account is valid, but your email has not been added to a year group yet. Ask your lecturer to add it to the CSE roster, then sign in again.',
      action: 'Sign out',
    },
    signed_out: {
      title: 'Sign in to continue',
      body: 'Your session has ended. Sign in with your college Google account to get back to your workspace.',
      action: 'Go to sign in',
    },
  }[reason ?? 'signed_out'];

  if (checking) {
    return <main className="min-h-screen bg-[#16181C]" />;
  }

  return (
    <main className="min-h-screen bg-[#16181C] text-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md flex flex-col items-center text-center gap-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <div className="space-y-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">{copy.title}</h1>
          <p className="text-sm text-white/60 leading-relaxed">{copy.body}</p>
        </div>

        {email && (
          <div className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-left">
            <Mail className="w-4 h-4 text-white/40 shrink-0" strokeWidth={1.5} />
            <span className="text-xs font-mono text-white/70 truncate">{email}</span>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white px-5 py-3 rounded-xl text-sm font-semibold transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          {copy.action}
        </button>

        <p className="text-[11px] text-white/30">
          Already been added? Sign out and back in to refresh your access.
        </p>
      </motion.div>
    </main>
  );
}
