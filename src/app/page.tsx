'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { ShieldAlert, UserCheck, LogOut } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { isAdminEmail } from '@/lib/admin';

export default function RootPage() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn, signOut } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const store = useStore();
  const [showPortal, setShowPortal] = useState(false);

  const handleLogout = async () => {
    store.logout();
    await signOut();
    router.replace('/login');
  };

  useEffect(() => {
    if (!isAuthLoaded || !isUserLoaded) return;
    
    if (isSignedIn) {
      const email = user?.primaryEmailAddress?.emailAddress || '';
      if (isAdminEmail(email)) {
        setShowPortal(true);
      } else {
        const timeout = setTimeout(() => {
          router.replace('/dashboard');
        }, 500);
        return () => clearTimeout(timeout);
      }
    } else {
      const timeout = setTimeout(() => {
        router.replace('/login');
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, router]);

  if (showPortal) {
    return (
      <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center relative overflow-hidden p-6 cyber-grid">
        <div className="absolute w-[500px] h-[500px] bg-cyber-purple/15 -top-[10%] -right-[10%] rounded-full blur-[120px] animate-[pulse_8s_infinite_alternate] pointer-events-none"></div>
        <div className="absolute w-[500px] h-[500px] bg-cyber-blue/15 -bottom-[10%] -left-[10%] rounded-full blur-[120px] animate-[pulse_10s_infinite_alternate] pointer-events-none"></div>

        <div className="z-10 w-full max-w-lg flex flex-col items-center text-center gap-8">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyber-purple to-cyber-blue blur opacity-75 animate-pulse"></div>
            <div className="relative w-20 h-20 rounded-full bg-black border border-white/20 flex items-center justify-center">
              <span className="text-3xl">👑</span>
            </div>
          </div>

          <div>
            <h1 className="text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue text-glow-cyan font-geist">
              HELLO BOSS!!
            </h1>
            <p className="text-sm text-white/50 font-mono mt-2">
              Select your access terminal:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-4">
            <button
              onClick={() => router.push('/admin')}
              className="glass-card hover:border-cyber-purple border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 transition duration-300 group cursor-pointer"
              style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)' }}
            >
              <div className="w-12 h-12 rounded-xl bg-cyber-purple/10 border border-cyber-purple/30 flex items-center justify-center text-cyber-purple group-hover:bg-cyber-purple/20 transition">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-geist font-bold text-sm text-white group-hover:text-cyber-purple transition">
                  ADMIN PORTAL
                </h3>
                <p className="text-[10px] text-white/40 mt-1 font-mono leading-relaxed">
                  Monitor telemetry, user database state, and operational analytics.
                </p>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="glass-card hover:border-cyber-blue border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-4 transition duration-300 group cursor-pointer"
              style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)' }}
            >
              <div className="w-12 h-12 rounded-xl bg-cyber-blue/10 border border-cyber-blue/30 flex items-center justify-center text-cyber-blue group-hover:bg-cyber-blue/20 transition">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-geist font-bold text-sm text-white group-hover:text-cyber-blue transition">
                  USER PORTAL
                </h3>
                <p className="text-[10px] text-white/40 mt-1 font-mono leading-relaxed">
                  Launch the standard student workspace planner, logs, and calendar.
                </p>
              </div>
            </button>
          </div>
          
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2 rounded-xl text-xs font-mono transition cursor-pointer mt-4"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden cyber-grid">
      <div className="z-10 flex flex-col items-center gap-6">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border border-primary animate-ping"></div>
          <div className="absolute inset-2 rounded-full border border-blue-500/50 animate-pulse"></div>
          <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-on-surface font-mono font-bold text-2xl tracking-tighter">L</span>
          </div>
        </div>
        
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-mono">
            LAYORA
          </h1>
          <p className="text-xs text-primary/60 font-mono mt-1">
            Synchronizing academic core...
          </p>
        </div>

        <div className="w-48 h-1 bg-surface-container rounded-full overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 w-1/3 rounded-full animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
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
