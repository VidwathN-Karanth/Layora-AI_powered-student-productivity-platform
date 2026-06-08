'use client';

import { SignIn } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#070709] text-white flex items-center justify-center relative overflow-hidden p-4 cyber-grid">
      {/* Glow Orbs - floating behind everything */}
      <div className="absolute w-[500px] h-[500px] bg-cyber-purple/15 -top-[10%] -right-[10%] rounded-full blur-[120px] animate-[pulse_8s_infinite_alternate] pointer-events-none"></div>
      <div className="absolute w-[500px] h-[500px] bg-cyber-blue/15 -bottom-[10%] -left-[10%] rounded-full blur-[120px] animate-[pulse_10s_infinite_alternate] pointer-events-none"></div>

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Layora Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyber-purple to-cyber-blue flex items-center justify-center shadow-[0_0_30px_rgba(176,38,255,0.25)] mb-3 border border-white/10">
            <span className="text-white font-mono font-black text-xl tracking-widest">L</span>
          </div>
          <h2 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue font-mono">
            LAYORA
          </h2>
          <p className="text-xs text-white/50 font-mono mt-1">Autonomous Student Productivity Suite</p>
        </div>

        {/* Google Sign-In Recommendation Note */}
        <div className="w-full bg-[#0d111c]/60 border border-white/10 rounded-2xl p-4 mb-6 backdrop-blur-md relative z-10 flex items-start gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="mt-0.5 p-1 rounded-lg bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple flex-shrink-0">
            <svg className="w-4 h-4 text-cyber-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-white tracking-wide font-mono uppercase mb-0.5">Google Sign-In Recommended</h4>
            <p className="text-[11px] text-white/70 font-mono leading-relaxed">
              To enable direct uploads to <span className="text-cyber-secondary font-semibold">Google Drive</span>, please log in or sign up using your Google account.
            </p>
          </div>
        </div>

        {/* Clerk SignIn Widget Wrapper */}
        <div className="w-full relative">
          {/* Neon backdrop halo for visual depth */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/20 rounded-[20px] blur-xl opacity-60 z-0"></div>
          
          <div className="relative z-10">
            <SignIn 
              routing="hash"
              fallbackRedirectUrl="/"
              signUpFallbackRedirectUrl="/"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
