'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Eye, Database, Trash2, Key, Puzzle } from 'lucide-react';
import LayoraMark from '@/components/LayoraMark';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#16181C] text-white flex flex-col items-center justify-start relative overflow-y-auto p-6 md:p-12">
      <div className="w-full max-w-3xl z-10 space-y-8 mt-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-lg cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> BACK TO PORTAL
        </button>

        {/* Header */}
        <div className="border-b border-white/10 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <LayoraMark className="w-10 h-10" glyphClassName="text-sm" />
            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              Security & Trust
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-geist text-white">
            Privacy Policy
          </h1>
          <p className="text-xs text-white/40 mt-1">Last updated: September 6, 2026</p>
        </div>

        {/* Content Body */}
        <div className="border border-white/10 rounded-xl p-6 md:p-8 space-y-8 bg-[#1A1D22]/40 text-sm text-white/80 leading-relaxed">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>1. Overview</span>
            </div>
            <p>
              Welcome to Layora ("Service"). We respect your privacy and are committed to protecting the personal data of our users. This Privacy Policy describes how we collect, use, store, and share your information when you access or use Layora, its companion features, and daily scoreboard tracking.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Eye className="w-4 h-4 text-primary" />
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
              <Database className="w-4 h-4 text-primary" />
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
              <Key className="w-4 h-4 text-primary" />
              <span>4. Data Sharing & Security</span>
            </div>
            <p>
              We do <strong className="text-white">not</strong> sell, rent, or trade your personal information with third parties. 
              Only your public display name, public GitHub/LeetCode usernames, and total aggregated points/contribution counts are visible to other logged-in users on the public scoreboard. All private communication tokens (such as calendar sync variables or session hashes) are encrypted and stored securely.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Puzzle className="w-4 h-4 text-primary" />
              <span>5. Browser Extension</span>
            </div>
            <p>
              The <strong className="text-white">Layora Quick Access</strong> browser extension for Chrome, Edge, Brave and Firefox is covered by this same policy. It is an optional companion to your Layora account, and it works only after you sign in on this site and press Connect on the Extension page.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>
                <strong className="text-white">What it reads:</strong> only your own account name and email address, your saved quick launchers, and your course list with their platform and progress. It requests nothing else.
              </li>
              <li>
                <strong className="text-white">What it never reads:</strong> your browsing history, your open tabs, or the content of any page you visit. The extension runs a script on exactly one page &mdash; Layora&apos;s own Extension page &mdash; and that script does nothing but pass the pairing token to the extension.
              </li>
              <li>
                <strong className="text-white">Where it sends data:</strong> only to Layora at <span className="text-white/90">layora239.vercel.app</span>. It contacts no analytics service, no advertiser, and no other third party.
              </li>
              <li>
                <strong className="text-white">What it stores on your device:</strong> a pairing token and a cached copy of your own launchers and courses, kept in the browser&apos;s local extension storage so the popup opens instantly. Uninstalling the extension deletes both.
              </li>
              <li>
                <strong className="text-white">How pairing works:</strong> connecting mints a token tied to your account rather than using your password, which the extension never sees or stores. We keep only a hashed form of that token on our servers, and you can revoke it for any browser at any time from the Extension page.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Trash2 className="w-4 h-4 text-primary" />
              <span>6. User Rights & Data Erasure</span>
            </div>
            <p>
              You maintain full ownership of your data profile. You have the right to edit your username mappings, clear active integrations, or wipe all saved account records at any time. Please contact us to request the permanent deletion of your cached parameters, database rows, and sync configurations.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>7. Contact Us</span>
            </div>
            <p>
              If you have any questions or data requests regarding our privacy standards, you can reach out directly via:
              <br />
              <strong className="text-white">Email:</strong> vidwathkaranth@gmail.com
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-white/30 pt-4 border-t border-white/5">
          © {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
