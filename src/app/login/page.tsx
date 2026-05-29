'use client';

import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background text-on-surface flex items-center justify-center relative overflow-hidden p-4 cyber-grid">
      {/* Glow Orbs */}
      <div className="hidden w-[400px] h-[400px] bg-purple-900/20 top-[-100px] right-[-50px] animate-[pulse_6s_infinite_alternate]"></div>
      <div className="hidden w-[450px] h-[450px] bg-blue-900/20 bottom-[-150px] left-[-100px] animate-[pulse_8s_infinite_alternate]"></div>

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Layora Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 mb-3 border border-outline-variant">
            <span className="text-on-surface font-mono font-black text-xl tracking-widest">L</span>
          </div>
          <h2 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-mono">
            LAYORA
          </h2>
          <p className="text-xs text-primary/50 font-mono mt-1">Autonomous Student Productivity Suite</p>
        </div>

        {/* Clerk SignIn Widget */}
        <div className="glass-panel-neon rounded-2xl p-1 relative overflow-hidden">
          {/* Neon Top Edge Accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-cyan-400 opacity-70 z-20"></div>
          
          <SignIn 
            routing="hash"
            fallbackRedirectUrl="/dashboard"
            signUpFallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none w-full",
                headerTitle: "text-primary font-mono",
                headerSubtitle: "text-on-surface-variant font-sans text-xs",
                socialButtonsBlockButton: "border-outline-variant text-on-surface hover:bg-surface-container",
                socialButtonsBlockButtonText: "font-mono text-xs font-semibold",
                dividerLine: "bg-surface-container-high",
                dividerText: "text-outline font-mono text-[10px]",
                formFieldLabel: "text-primary/70 font-mono text-xs uppercase",
                formFieldInput: "bg-surface-container border-outline-variant text-on-surface focus:border-primary",
                formButtonPrimary: "bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-on-surface font-mono font-bold font-sm border-none shadow-lg shadow-purple-500/20",
                footerActionText: "text-on-surface-variant font-sans text-xs",
                footerActionLink: "text-secondary hover:text-cyan-300 font-mono text-xs",
                identityPreviewText: "text-on-surface",
                identityPreviewEditButtonIcon: "text-primary"
              }
            }}
          />
        </div>
      </div>
    </main>
  );
}
