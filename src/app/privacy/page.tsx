'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Eye, Database, Trash2, Key } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-start relative overflow-y-auto p-6 md:p-12 cyber-grid">
      {/* Glow Orbs */}
      <div className="absolute w-[500px] h-[500px] bg-cyber-purple/15 -top-[10%] -right-[10%] rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute w-[500px] h-[500px] bg-cyber-blue/15 -bottom-[10%] -left-[10%] rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-3xl z-10 space-y-8 mt-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-mono text-white/60 hover:text-cyber-blue transition border border-white/5 hover:border-cyber-blue/30 bg-white/2 hover:bg-cyber-blue/5 px-3.5 py-1.5 rounded-xl cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> BACK TO PORTAL
        </button>

        {/* Header */}
        <div className="border-b border-white/10 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyber-purple to-cyber-blue flex items-center justify-center border border-white/10">
              <span className="text-white font-mono font-black text-sm">L</span>
            </div>
            <span className="text-xs font-mono font-bold tracking-widest text-cyber-blue uppercase bg-cyber-blue/10 px-2 py-0.5 rounded border border-cyber-blue/20">
              Security & Trust
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-geist text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue">
            Privacy Policy
          </h1>
          <p className="text-xs text-white/50 font-mono mt-1">Last updated: June 22, 2026</p>
        </div>

        {/* Content Body */}
        <div className="glass-card border border-white/10 rounded-2xl p-6 md:p-8 space-y-8 backdrop-blur-md bg-[#0d111c]/60 shadow-[0_4px_30px_rgba(0,0,0,0.5)] text-xs md:text-sm font-mono text-white/80 leading-relaxed">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-cyber-purple" />
              <span>1. Overview</span>
            </div>
            <p>
              Welcome to Layora ("Service"). We respect your privacy and are committed to protecting the personal data of our users. This Privacy Policy describes how we collect, use, store, and share your information when you access or use Layora, its companion features, and daily scoreboard tracking.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Eye className="w-4 h-4 text-cyber-blue" />
              <span>2. Information We Collect</span>
            </div>
            <p>
              To run the daily study schedules, calendar exports, and leaderboard features, Layora collects and processes limited categories of information:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>
                <strong className="text-white">Account Information:</strong> We collect your alias/username, email address, and profile details provided during onboarding or sign-in (managed securely via Clerk authentication).
              </li>
              <li>
                <strong className="text-white">GitHub Integration Data:</strong> When you provide your public GitHub username, our background sync job periodically queries the official GitHub GraphQL API to fetch the number of daily commits, pull requests, and review contributions. We only store the daily counts and do not read repository contents or code.
              </li>
              <li>
                <strong className="text-white">LeetCode Integration Data:</strong> When you provide your public LeetCode username, we fetch public problem submission counts (Easy, Medium, and Hard solves) to compute daily study points.
              </li>
              <li>
                <strong className="text-white">Calendar OAuth Tokens:</strong> If you authorize Google Calendar synchronization, we store the OAuth access and refresh tokens securely in our backend database to export your study schedules.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>3. How We Use Your Information</span>
            </div>
            <p> We use the collected data for the following essential purposes: </p>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>Formulating daily rhythm templates and academic schedule planners.</li>
              <li>Aggregating and posting points on the global scoreboard/leaderboard.</li>
              <li>Automating scheduling changes and exports to your Google Calendar.</li>
              <li>Analyzing global progress metrics to improve Layora's features.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Key className="w-4 h-4 text-amber-400" />
              <span>4. Data Sharing & Security</span>
            </div>
            <p>
              We do <strong className="text-white">not</strong> sell, rent, or trade your personal information with third parties. 
              Only your public display name, public GitHub/LeetCode usernames, and total aggregated points/contribution counts are visible to other logged-in users on the public scoreboard. All private communication tokens (such as calendar sync variables or session hashes) are encrypted and stored securely.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>5. User Rights & Data Erasure</span>
            </div>
            <p>
              You maintain full ownership of your data profile. You have the right to edit your username mappings, clear active integrations, or wipe all saved account records at any time. A self-serve <strong className="text-white">"Erase All Registration & Store Data"</strong> button is available in the Settings Panel under the Danger Zone to let you permanently delete all cached parameters, databases rows, and sync configurations.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-cyber-blue" />
              <span>6. Contact Us</span>
            </div>
            <p>
              If you have any questions or data requests regarding our privacy standards, you can reach out directly via:
              <br />
              <strong className="text-white">Email:</strong> vidwathkaranth@gmail.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className="text-center font-mono text-[9px] text-white/30 pt-4 border-t border-white/5">
          © {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
