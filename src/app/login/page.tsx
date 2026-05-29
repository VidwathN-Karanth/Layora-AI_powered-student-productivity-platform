'use client';

import { SignIn } from '@clerk/nextjs';
import { dark } from '@clerk/themes';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center relative overflow-hidden p-4 cyber-grid">
      {/* Glow Orbs */}
      <div className="absolute w-[400px] h-[400px] bg-cyber-purple/10 top-[-100px] right-[-50px] rounded-full blur-[100px] animate-[pulse_6s_infinite_alternate]"></div>
      <div className="absolute w-[450px] h-[450px] bg-cyber-blue/10 bottom-[-150px] left-[-100px] rounded-full blur-[100px] animate-[pulse_8s_infinite_alternate]"></div>

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Layora Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-cyber-purple to-cyber-blue flex items-center justify-center shadow-[0_0_20px_rgba(157,78,221,0.3)] mb-3 border border-white/10">
            <span className="text-white font-mono font-black text-xl tracking-widest">L</span>
          </div>
          <h2 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue font-mono">
            LAYORA
          </h2>
          <p className="text-xs text-white/50 font-mono mt-1">Autonomous Student Productivity Suite</p>
        </div>

        {/* Clerk SignIn Widget */}
        <div className="glass-card rounded-2xl p-2 relative overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          {/* Neon Top Edge Accent */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyber-purple to-transparent opacity-70 z-20"></div>
          
          <SignIn 
            routing="hash"
            fallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
            appearance={{
              baseTheme: dark,
              variables: {
                colorPrimary: '#00f0ff', // cyber-blue
                colorBackground: 'transparent',
                colorInputBackground: 'rgba(0, 0, 0, 0.4)',
                colorInputText: '#ffffff',
                colorText: '#ffffff',
                colorTextSecondary: 'rgba(255, 255, 255, 0.6)',
                fontFamily: 'var(--font-geist-sans), sans-serif',
              },
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none w-full",
                headerTitle: "text-white font-mono",
                headerSubtitle: "text-white/60 font-sans text-xs",
                socialButtonsBlockButton: "border-white/10 bg-black/40 hover:bg-white/5 text-white transition-colors",
                socialButtonsBlockButtonText: "font-mono text-xs font-semibold text-white",
                dividerLine: "bg-white/10",
                dividerText: "text-white/40 font-mono text-[10px]",
                formFieldLabel: "text-white/70 font-mono text-xs uppercase",
                formFieldInput: "bg-black/40 border-white/10 text-white focus:border-cyber-blue focus:ring-1 focus:ring-cyber-blue/50",
                formButtonPrimary: "bg-gradient-to-r from-cyber-purple/80 to-cyber-blue/80 hover:from-cyber-purple hover:to-cyber-blue text-white font-mono font-bold font-sm border border-white/10 shadow-[0_0_15px_rgba(0,240,255,0.2)] transition-all",
                footerActionText: "text-white/60 font-sans text-xs",
                footerActionLink: "text-cyber-blue hover:text-white font-mono text-xs transition-colors",
                identityPreviewText: "text-white",
                identityPreviewEditButtonIcon: "text-cyber-blue",
                watermark: "hidden !important opacity-0",
                footerBottom: "hidden !important opacity-0",
                internal: "hidden !important opacity-0"
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}
