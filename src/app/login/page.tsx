'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { Mail, Lock, User, ArrowRight, Shield, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const loginUser = useStore((state) => state.login);
  const loginWithCredentials = useStore((state) => state.loginWithCredentials);
  const registerUser = useStore((state) => state.registerUser);
  const resetStore = useStore((state) => state.resetStore);
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Simulated Google SSO states
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleLoadingStep, setGoogleLoadingStep] = useState(0);
  const [customGoogle, setCustomGoogle] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (activeTab === 'register' && !name)) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate database network timing
    setTimeout(() => {
      if (activeTab === 'register') {
        const res = registerUser(email, name, password);
        if (res.success) {
          const loginRes = loginWithCredentials(email, password);
          if (loginRes.success) {
            router.push('/dashboard');
          } else {
            setError(loginRes.error || 'Auto-login failed.');
            setLoading(false);
          }
        } else {
          setError(res.error || 'Registration failed.');
          setLoading(false);
        }
      } else {
        const loginRes = loginWithCredentials(email, password);
        if (loginRes.success) {
          router.push('/dashboard');
        } else {
          setError(loginRes.error || 'Login failed.');
          setLoading(false);
        }
      }
    }, 1500);
  };

  const handleGoogleLogin = () => {
    if (isSupabaseConfigured && supabase) {
      setLoading(true);
      setError('');
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      }).catch(err => {
        setLoading(false);
        setError('Supabase Google Auth failed.');
      });
      return;
    }
    
    // Otherwise open our beautiful simulator modal
    setShowGoogleChooser(true);
  };

  const executeGoogleLogin = (emailStr: string, nameStr: string) => {
    if (!emailStr || !nameStr) return;
    setGoogleLoading(true);
    setGoogleLoadingStep(0);
    
    // Cyber updates
    const timer1 = setTimeout(() => setGoogleLoadingStep(1), 700);
    const timer2 = setTimeout(() => setGoogleLoadingStep(2), 1400);
    const timer3 = setTimeout(() => {
      loginUser(emailStr, nameStr);
      setShowGoogleChooser(false);
      setGoogleLoading(false);
      router.push('/dashboard');
    }, 2100);
  };

  return (
    <main className="min-h-screen bg-background text-[#f3f4f6] flex items-center justify-center relative overflow-hidden p-4 cyber-grid">
      {/* Glow Orbs */}
      <div className="glow-orb w-[400px] h-[400px] bg-purple-900/20 top-[-100px] right-[-50px] animate-[pulse_6s_infinite_alternate]"></div>
      <div className="glow-orb w-[450px] h-[450px] bg-blue-900/20 bottom-[-150px] left-[-100px] animate-[pulse_8s_infinite_alternate]"></div>

      <div className="w-full max-w-md z-10">
        {/* Layora Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 mb-3 border border-white/10">
            <span className="text-white font-mono font-black text-xl tracking-widest">L</span>
          </div>
          <h2 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-mono">
            LAYORA
          </h2>
          <p className="text-xs text-purple-300/50 font-mono mt-1">Autonomous Student Productivity Suite</p>
        </div>

        {/* Auth Glass Card */}
        <div className="glass-panel-neon rounded-2xl p-6 md:p-8 relative overflow-hidden">
          {/* Neon Top Edge Accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-cyan-400 opacity-70"></div>

          {!forgotPassword ? (
            <>
              {/* Tab Selector */}
              <div className="flex border-b border-white/10 mb-6">
                <button
                  onClick={() => { setActiveTab('login'); setError(''); }}
                  className={`flex-1 pb-3 text-sm font-mono font-semibold transition-all relative ${
                    activeTab === 'login' ? 'text-purple-400' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  Login
                  {activeTab === 'login' && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500"
                    />
                  )}
                </button>
                <button
                  onClick={() => { setActiveTab('register'); setError(''); }}
                  className={`flex-1 pb-3 text-sm font-mono font-semibold transition-all relative ${
                    activeTab === 'register' ? 'text-purple-400' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  Create Account
                  {activeTab === 'register' && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500"
                    />
                  )}
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-start gap-2 text-xs text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {activeTab === 'register' && (
                  <div>
                    <label className="block text-xs font-mono text-purple-300/70 mb-1.5 uppercase">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-purple-400/60" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-purple-300/70 mb-1.5 uppercase">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-purple-400/60" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-mono text-purple-300/70 uppercase">Password</label>
                    {activeTab === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setForgotPassword(true); setError(''); }}
                        className="text-[10px] font-mono text-cyan-400 hover:underline"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-purple-400/60" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white rounded-xl py-3 text-sm font-mono font-bold flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-lg shadow-purple-500/20 active:scale-95 transition"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      {activeTab === 'login' ? 'Login' : 'Register'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Separator */}
              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <span className="relative bg-background px-3 text-[10px] font-mono text-white/40">Or continue with</span>
              </div>

              {/* OAuth Panel */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-xs font-mono flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.746-.08-1.32-.176-1.886H12.24z"/>
                  </svg>
                  Google
                </button>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-xs font-mono flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  GITHUB
                </button>
              </div>
            </>
          ) : (
            // Forgot Password Screen
            <div className="space-y-4">
              <h3 className="text-lg font-mono font-semibold text-purple-400">Reset Access</h3>
              <p className="text-xs text-white/60">
                {!resetSent 
                  ? 'Input your academic email. The AI dispatcher will compile a dynamic access override link.' 
                  : 'Check your terminal mailbox. Override token dispatched successfully.'
                }
              </p>

              {!resetSent ? (
                <form onSubmit={(e) => { e.preventDefault(); setResetSent(true); }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-purple-300/70 mb-1.5 uppercase">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-purple-400/60" />
                      <input
                        type="email"
                        required
                        placeholder="student@university.edu"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white rounded-xl py-2.5 text-sm font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    Reset Password
                  </button>
                </form>
              ) : (
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2 text-xs text-emerald-300">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Instructions sent! Use dummy login to proceed.</span>
                </div>
              )}

              <button
                onClick={() => { setForgotPassword(false); setResetSent(false); }}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 text-xs font-mono transition cursor-pointer text-center"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>

        {/* Reset App Data Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              if (confirm("Are you sure you want to completely erase all local registration & productivity data?")) {
                resetStore();
                alert("All application data has been successfully erased.");
                window.location.reload();
              }
            }}
            className="text-[11px] font-mono text-rose-400/60 hover:text-rose-400 hover:underline transition cursor-pointer bg-transparent border-none outline-none"
          >
            Erase Local Registration & App Data
          </button>
        </div>
      </div>

      {/* Google Chooser Modal Overlay */}
      <AnimatePresence>
        {showGoogleChooser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
              onClick={() => { if (!googleLoading) setShowGoogleChooser(false); }}
            />

            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-md bg-surface-container-lowest border border-purple-500/30 rounded-2xl p-6 md:p-8 overflow-hidden shadow-2xl shadow-purple-500/10 z-10 glass-panel-neon space-y-6"
            >
              {/* Glowing Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-blue-500"></div>

              {/* Title & Google SVG */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.746-.08-1.32-.176-1.886H12.24z"/>
                  </svg>
                </div>
                <h3 className="text-lg font-mono font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                  {googleLoading ? 'Authenticating...' : 'Google Sign In'}
                </h3>
                <p className="text-xs text-white/55 max-w-xs font-sans">
                  {googleLoading 
                    ? 'Establishing secure handshake with academic identity servers' 
                    : 'Select a profile to initialize your credentials or enter custom details.'
                  }
                </p>
              </div>

              {googleLoading ? (
                /* Connecting loader screen */
                <div className="py-8 flex flex-col items-center justify-center space-y-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
                    <div className="absolute inset-2 rounded-full border-4 border-cyan-500/20 border-b-cyan-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                  </div>
                  <div className="text-center font-mono text-[10px] text-cyan-400 uppercase tracking-widest animate-pulse h-4">
                    {googleLoadingStep === 0 && 'Connecting to Google OAuth Node...'}
                    {googleLoadingStep === 1 && 'Synchronizing user profile metadata...'}
                    {googleLoadingStep === 2 && 'Signing in and writing session keys...'}
                  </div>
                </div>
              ) : (
                /* Chooser Screen */
                <div className="space-y-4">
                  {!customGoogle ? (
                    <div className="space-y-2.5">
                      {/* Prepopulated Accounts */}
                      <button
                        onClick={() => executeGoogleLogin('vidwan@gmail.com', 'Vidwan')}
                        className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-xl p-3 text-left transition group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-mono font-bold text-xs">V</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono font-bold text-white group-hover:text-purple-300">Vidwan</div>
                          <div className="text-[10px] font-mono text-white/40 truncate">vidwan@gmail.com</div>
                        </div>
                        <div className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded-full uppercase">Active</div>
                      </button>

                      <button
                        onClick={() => executeGoogleLogin('alex.mercer@gmail.com', 'Alex Mercer')}
                        className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-xl p-3 text-left transition group cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-mono font-bold text-xs">A</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono font-bold text-white group-hover:text-purple-300">Alex Mercer</div>
                          <div className="text-[10px] font-mono text-white/40 truncate">alex.mercer@gmail.com</div>
                        </div>
                        <div className="text-[9px] font-mono text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full uppercase font-semibold">Demo</div>
                      </button>

                      {/* Custom Switcher */}
                      <button
                        onClick={() => setCustomGoogle(true)}
                        className="w-full text-center py-2.5 rounded-xl border border-dashed border-white/10 hover:border-purple-500/40 text-xs font-mono text-purple-400 hover:text-purple-300 transition cursor-pointer text-white"
                      >
                        + Use another Google account
                      </button>
                    </div>
                  ) : (
                    /* Custom Inputs Form */
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        executeGoogleLogin(customEmail, customName);
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-mono text-purple-300/70 mb-1.5 uppercase">Google Full Name</label>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 w-4 h-4 text-purple-400/60" />
                            <input
                              type="text"
                              required
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              placeholder="E.g. John Doe"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-purple-500 transition text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono text-purple-300/70 mb-1.5 uppercase">Google Email Address</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-purple-400/60" />
                            <input
                              type="email"
                              required
                              value={customEmail}
                              onChange={(e) => setCustomEmail(e.target.value)}
                              placeholder="E.g. john.doe@gmail.com"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-purple-500 transition text-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setCustomGoogle(false); setError(''); }}
                          className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-xs font-mono transition text-white cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white rounded-xl py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-1 shadow-lg shadow-purple-500/10 cursor-pointer"
                        >
                          Continue <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  )}
                  
                  {/* Google disclaimer footer */}
                  <div className="text-[10px] text-white/30 text-center leading-normal font-sans pt-2 border-t border-white/5">
                    To continue, Google will share your name, email address, language preference, and profile picture with Layora.
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
