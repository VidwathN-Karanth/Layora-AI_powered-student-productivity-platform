'use client';
/** TEMPORARY harness — delete after checking the settings order. */
import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import DashboardLayout from '../dashboard/layout';
import SettingsPage from '../dashboard/settings/page';

if (typeof window !== 'undefined') {
  localStorage.setItem('layora-cookie-consent', 'accepted-essential');
  const real = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/')) {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, allowed: true, cohort: '3rd Year' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    }
    return real(input as RequestInfo, init);
  }) as typeof window.fetch;
}

export default function ShotsPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    useStore.setState({
      isAuthenticated: true, hasHydrated: true, isCloudLoaded: true, cohort: '3rd Year',
      user: { name: 'CSE Student', email: 'student@mite.ac.in', streakCount: 12, totalStudyHours: 128, isOnboarded: true, freeBlocks: [] },
    });
    setReady(true);
  }, []);
  if (!ready) return null;
  return (
    <>
      <style>{`nextjs-portal { display: none !important; } .fixed.top-20.right-5 { display: none !important; }`}</style>
      <DashboardLayout><SettingsPage /></DashboardLayout>
    </>
  );
}
