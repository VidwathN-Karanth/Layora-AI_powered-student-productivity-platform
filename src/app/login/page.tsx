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

        {/* Clerk SignIn Widget Wrapper */}
        <div className="w-full relative">
          {/* Neon backdrop halo for visual depth */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/20 rounded-[20px] blur-xl opacity-60 z-0"></div>
          
          <div className="relative z-10">
            <SignIn 
              routing="hash"
              fallbackRedirectUrl="/dashboard"
              signUpFallbackRedirectUrl="/dashboard"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
