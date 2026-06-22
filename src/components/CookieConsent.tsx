'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Cookie, X, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check localStorage to see if user has already made a choice
    const consent = localStorage.getItem('layora-cookie-consent');
    if (!consent) {
      // Delay showing the banner slightly for a smoother entry
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('layora-cookie-consent', 'accepted-all');
    setShowBanner(false);
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('layora-cookie-consent', 'accepted-essential');
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[420px] bg-[#0b0f19]/95 border border-white/10 rounded-2xl p-5 shadow-[0_10px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(182,0,248,0.05)] backdrop-blur-md z-[9999] flex flex-col gap-4 font-mono text-white select-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyber-purple/10 border border-cyber-purple/30 flex items-center justify-center text-cyber-purple">
                <Cookie className="w-4.5 h-4.5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-wider uppercase text-white">Cookie Terminal</h4>
                <p className="text-[9px] text-cyber-blue font-bold tracking-widest uppercase">System Preferences</p>
              </div>
            </div>
            <button
              onClick={handleAcceptEssential}
              className="text-white/40 hover:text-white transition p-1 hover:bg-white/5 rounded-lg"
              title="Accept Essential Only"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-white/70">
              Layora utilizes cookies to authenticate your session state, secure platform databases, and preserve user timetable rhythms. No marketing or tracking cookies are initialized.
            </p>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] text-white/50">Only essential & functional cookies used.</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-1">
            <button
              onClick={handleAcceptAll}
              className="flex-1 bg-gradient-to-r from-cyber-purple to-cyber-blue text-on-surface rounded-xl py-2 px-3 text-xs font-bold transition duration-300 hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
            >
              Accept All
            </button>
            <button
              onClick={handleAcceptEssential}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-2 px-3 text-xs font-bold transition duration-300 active:scale-[0.98] cursor-pointer flex items-center justify-center"
            >
              Essential Only
            </button>
          </div>

          {/* Privacy Link */}
          <div className="border-t border-white/5 pt-2.5 flex justify-center">
            <Link
              href="/privacy"
              className="text-[9px] text-cyber-blue hover:text-white flex items-center gap-1.5 hover:underline"
            >
              Read full Privacy & Cookie Protocol <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
