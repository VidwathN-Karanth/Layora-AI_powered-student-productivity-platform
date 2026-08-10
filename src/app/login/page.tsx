'use client';

import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#070709] text-white flex items-center justify-center relative overflow-hidden p-4">
      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Layora Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <span className="text-white font-bold text-2xl tracking-tighter">L</span>
          </div>
          <h2 className="text-2xl font-bold tracking-wide text-white">
            LAYORA
          </h2>
          <p className="text-xs text-white/40 mt-1">Autonomous Student Productivity Suite</p>
        </div>

        {/* Google Sign-In Recommendation Note */}
        <div className="w-full bg-[#0d111c]/60 border border-white/10 rounded-xl p-4 mb-6 backdrop-blur-md relative z-10 flex items-start gap-3 shadow-lg">
          <div className="mt-0.5 p-1 rounded-lg bg-primary/10 border border-primary/20 text-primary flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <h4 className="font-semibold text-white mb-0.5">Google Sign-In Recommended</h4>
            <p className="text-white/60 leading-relaxed">
              To enable direct uploads to <span className="text-primary font-semibold">Google Drive</span>, please log in or sign up using your Google account.
            </p>
          </div>
        </div>

        {/* Clerk SignIn Widget Wrapper */}
        <div className="w-full relative">
          <div className="relative z-10">
            <SignIn 
              routing="hash"
              fallbackRedirectUrl="/"
              signUpFallbackRedirectUrl="/"
            />
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-white/30 space-y-1.5 z-10">
          <div>© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</div>
          <div className="flex items-center justify-center gap-3">
            <a href="/privacy" className="text-primary hover:text-white transition hover:underline">Privacy Policy</a>
            <span className="text-white/10">•</span>
            <a href="/terms" className="text-primary hover:text-white transition hover:underline">Terms & Conditions</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
