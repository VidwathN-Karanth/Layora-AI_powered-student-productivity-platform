'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useStore();

  useEffect(() => {
    // Small delay to ensure Zustand has loaded from localStorage
    const timeout = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace('/login');
      } else {
        router.replace('/dashboard');
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen bg-[#030307] flex flex-col items-center justify-center relative overflow-hidden cyber-grid">
      {/* Background glow orbs */}
      <div className="glow-orb w-[300px] h-[300px] bg-purple-600 top-1/4 left-1/4"></div>
      <div className="glow-orb w-[300px] h-[300px] bg-blue-600 bottom-1/4 right-1/4"></div>

      <div className="z-10 flex flex-col items-center gap-6">
        <div className="relative w-20 h-20">
          {/* Pulsing cyber ring */}
          <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping"></div>
          <div className="absolute inset-2 rounded-full border border-blue-500/50 animate-pulse"></div>
          <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <span className="text-white font-mono font-bold text-2xl tracking-tighter">L</span>
          </div>
        </div>
        
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-mono">
            LAYORA
          </h1>
          <p className="text-xs text-purple-300/60 font-mono mt-1">
            Synchronizing academic core...
          </p>
        </div>

        {/* Loading progress indicator */}
        <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative">
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
