'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale, ShieldCheck, Terminal, AlertTriangle, HelpCircle } from 'lucide-react';

export default function TermsAndConditionsPage() {
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
            <span className="text-xs font-mono font-bold tracking-widest text-cyber-purple uppercase bg-cyber-purple/10 px-2 py-0.5 rounded border border-cyber-purple/20">
              Legal Framework
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-geist text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue">
            Terms & Conditions
          </h1>
          <p className="text-xs text-white/50 font-mono mt-1">Last updated: June 22, 2026</p>
        </div>

        {/* Content Body */}
        <div className="glass-card border border-white/10 rounded-2xl p-6 md:p-8 space-y-8 backdrop-blur-md bg-[#0d111c]/60 shadow-[0_4px_30px_rgba(0,0,0,0.5)] text-xs md:text-sm font-mono text-white/80 leading-relaxed">
          
          <p className="text-white/70 italic">
            These Terms and Conditions ("Terms") govern your access to and use of Layora (the "Service"), including its daily coding activity tracker and leaderboard. By creating an account or using Layora, you agree to be bound by these Terms.
          </p>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-cyber-purple" />
              <span>1. Acceptance of Terms</span>
            </div>
            <p>
              By accessing or using Layora, you confirm that you have read, understood, and agree to these Terms and our Privacy Policy. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Terminal className="w-4 h-4 text-cyber-blue" />
              <span>2. Description of Service</span>
            </div>
            <p>
              Layora tracks users' daily coding activity by connecting to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li><strong className="text-white">GitHub:</strong> via GitHub's official GraphQL API, to read your contribution and commit activity.</li>
              <li><strong className="text-white">LeetCode:</strong> via an unofficial, publicly accessible GraphQL endpoint, to read your public submission activity.</li>
            </ul>
            <p>
              Layora uses this data to calculate daily coding points and display them on a public leaderboard. Layora is <strong className="text-white">not affiliated with GitHub or LeetCode</strong>. Since the LeetCode integration relies on an API that LeetCode has not officially published for third-party use, it may be modified, rate-limited, or discontinued at any time without notice, which could affect point calculation or sync accuracy.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Scale className="w-4 h-4 text-emerald-400" />
              <span>3. Eligibility</span>
            </div>
            <p>
              Layora does not impose a minimum age requirement to use the Service. However, under the Indian Contract Act, 1872, a person under the age of 18 is not considered competent to enter into a binding contract. <strong className="text-white">If you are under 18, you may only use Layora with the consent and involvement of a parent or legal guardian</strong>, who must agree to these Terms on your behalf and takes responsibility for your use of the Service.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>4. Account Registration</span>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>Provide accurate and complete information when creating your account.</li>
              <li>Keep your login credentials confidential and secure.</li>
              <li>Notify us promptly of any unauthorized use of your account.</li>
              <li>Be responsible for all activity that occurs under your account.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <HelpCircle className="w-4 h-4 text-cyber-blue" />
              <span>5. Third-Party Integrations</span>
            </div>
            <p>
              By connecting your GitHub or LeetCode account, you authorize Layora to access the relevant public activity data for the purpose of calculating coding points. You are responsible for ensuring your use of these integrations complies with GitHub's and LeetCode's own terms of service. Layora is not responsible for any disruption, suspension, or restriction imposed on your GitHub or LeetCode account as a result of using our integration, nor for any inaccuracy resulting from changes to either platform's API.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Terminal className="w-4 h-4 text-cyber-purple" />
              <span>6. Points, Leaderboard & Fair Use</span>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>Coding points are calculated automatically based on activity data synced from GitHub and LeetCode through a scheduled background job.</li>
              <li>Your username, points, streaks, and rank will be displayed publicly on the leaderboard.</li>
              <li>You agree <strong className="text-white">not</strong> to manipulate, exploit, or artificially inflate your coding activity or points (for example, through fake commits, automated scripts designed solely to game the leaderboard, or other forms of abuse).</li>
              <li>We reserve the right to investigate, adjust, reset, or remove points, and to suspend or disqualify accounts found to be in violation of fair use, at our sole discretion.</li>
              <li>We do not guarantee the leaderboard will always be perfectly accurate or up to date, given dependency on third-party APIs and sync schedules.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>7. Acceptable Use</span>
            </div>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>Use the Service for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to other users' accounts or to Layora's systems.</li>
              <li>Interfere with or disrupt the Service, including the sync jobs or leaderboard infrastructure.</li>
              <li>Harass, abuse, or impersonate other users via your username or profile.</li>
              <li>Scrape, copy, or republish leaderboard data at scale without our permission.</li>
            </ul>
            <p>We reserve the right to suspend or terminate accounts that violate these rules.</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>8. Intellectual Property</span>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>Layora's branding, design, codebase, and content (excluding user-generated data) are the property of Layora and may not be copied or reproduced without permission.</li>
              <li>Your own code, repositories, and submissions remain your property. Layora does not claim ownership over your code — we only access and display activity metadata (such as commit counts and points) necessary to operate the leaderboard.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>9. Disclaimers</span>
            </div>
            <p>The Service is provided on an <strong className="text-white">"as is"</strong> and <strong className="text-white">"as available"</strong> basis, without warranties of any kind, express or implied. We do not guarantee that:</p>
            <ul className="list-disc pl-5 space-y-2 text-white/70">
              <li>The Service will be uninterrupted, error-free, or secure.</li>
              <li>Point calculations or leaderboard rankings will always be accurate, given reliance on third-party APIs.</li>
              <li>The GitHub or LeetCode integrations will remain available indefinitely.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>10. Limitation of Liability</span>
            </div>
            <p>
              To the maximum extent permitted by applicable law, Layora and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of, or inability to use, the Service — including any loss of data, points, or ranking.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <Scale className="w-4 h-4 text-cyber-blue" />
              <span>11. Governing Law & Dispute Resolution</span>
            </div>
            <p>
              These Terms are governed by the laws of India. Any disputes arising out of or relating to these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of <strong className="text-white">Karnataka, India</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-white/5 pb-1">
              <ShieldCheck className="w-4 h-4 text-cyber-purple" />
              <span>12. Contact Us</span>
            </div>
            <p>
              If you have questions about these Terms, contact us at:
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
