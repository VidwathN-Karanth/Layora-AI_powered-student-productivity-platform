'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, ChatMessage } from '@/store/useStore';
import { sendAIChatMessage } from '@/lib/aiService';
import { 
  LayoutDashboard, CalendarRange, BookMarked, CheckSquare, Calendar, 
  FolderLock, BarChart3, Settings, UserCheck, LogOut, ChevronLeft, 
  ChevronRight, Send, Paperclip, Sparkles, MessageCircle, Clock, 
  Pause, Check, Menu, X, ArrowUpRight
} from 'lucide-react';
import OnboardingModal from '@/components/OnboardingModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const store = useStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!store.isAuthenticated) {
      router.replace('/login');
    }
  }, [store.isAuthenticated, router]);

  // Sidebar collapsible state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Right chatbot panel visibility
  const [chatOpen, setChatOpen] = useState(true);
  
  // Mobile responsive overrides
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Digital clock state
  const [timeStr, setTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global Task Timer Ticking Sync
  useEffect(() => {
    if (store.activeTaskId) {
      const interval = setInterval(() => {
        store.updateTimerSecond();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [store.activeTaskId]);

  // Chat message input and scrolling
  const [messageText, setMessageText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [store.chatHistory, chatLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const query = messageText;
    setMessageText('');
    store.addChatMessage('user', query);
    setChatLoading(true);

    // Compile history
    const history = store.chatHistory.map((h) => ({
      role: h.role,
      content: h.content,
    }));

    const response = await sendAIChatMessage(
      query,
      history,
      store.selectedModel,
      store.apiKeys
    );

    store.addChatMessage('assistant', response);
    setChatLoading(false);
  };

  const handleLogout = () => {
    store.logout();
    router.replace('/login');
  };

  // Find currently running task details
  const activeTask = store.tasks.find((t) => t.id === store.activeTaskId);

  // Formatting utility for timer: MM:SS
  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours > 0 ? hours + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Weekly Planner', path: '/dashboard/planner', icon: CalendarRange },
    { name: 'Courses', path: '/dashboard/courses', icon: BookMarked },
    { name: 'Tasks', path: '/dashboard/tasks', icon: CheckSquare },
    { name: 'Resources', path: '/dashboard/resources', icon: FolderLock },
    { name: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  if (!store.isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#030306] text-[#f3f4f6] flex relative overflow-hidden font-sans">
      {/* Background Neon Elements */}
      <div className="glow-orb w-[500px] h-[500px] bg-purple-950/10 top-0 left-[-200px]"></div>
      <div className="glow-orb w-[500px] h-[500px] bg-blue-950/10 bottom-0 right-0"></div>

      {/* --- MOBILE NAV TOPBAR --- */}
      <div className="md:hidden w-full h-14 bg-cyber-dark/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-40 fixed top-0 left-0">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-purple-400">
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">AERO_LAB</span>
        <button onClick={() => setChatOpen(!chatOpen)} className="p-2 hover:bg-white/5 rounded-lg text-cyan-400">
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>

      {/* --- MOBILE SIDEBAR DRAWER --- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-[260px] bg-[#07070c] border-r border-white/10 z-50 flex flex-col justify-between p-4 md:hidden"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <span className="font-mono font-bold text-purple-400 text-sm">Æ AERO STUDY</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-white/40"><X className="w-5 h-5" /></button>
                </div>
                <nav className="space-y-1">
                  {menuItems.map((item) => {
                    const active = pathname === item.path;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => { router.push(item.path); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition ${
                          active ? 'bg-purple-600 text-white font-bold' : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.name.toUpperCase()}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-mono font-black text-xs">U</div>
                  <div>
                    <div className="text-xs font-mono font-semibold truncate">{store.user?.name || 'Aero Student'}</div>
                    <div className="text-[9px] font-mono text-white/40 truncate">{store.user?.email}</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/10 hover:bg-red-950/30 text-red-400 py-2 rounded-xl text-xs font-mono transition">
                  <LogOut className="w-4 h-4" /> LOGOUT
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* --- DESKTOP SIDEBAR --- */}
      <motion.aside
        animate={{ width: sidebarOpen ? 260 : 76 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex flex-col justify-between p-4 border-r border-white/5 bg-[#05050a]/90 backdrop-blur-md shrink-0 h-screen sticky top-0 z-30"
      >
        <div className="space-y-8">
          {/* Logo panel */}
          <div className="flex items-center justify-between">
            <AnimatePresence mode="wait">
              {sidebarOpen ? (
                <motion.span 
                  key="full-logo" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="font-mono font-black text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-2"
                >
                  <span className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-white text-[10px]">Æ</span> AERO_STUDY
                </motion.span>
              ) : (
                <motion.span 
                  key="short-logo" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="font-mono font-black text-base text-purple-400 w-full text-center"
                >
                  Æ
                </motion.span>
              )}
            </AnimatePresence>

            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-white/5 rounded-lg border border-white/10 text-white/40 hover:text-white transition"
            >
              {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const active = pathname === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition relative ${
                    active 
                      ? 'bg-gradient-to-r from-purple-600/40 to-blue-500/20 text-white border border-purple-500/30' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                  {sidebarOpen && <span>{item.name.toUpperCase()}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/5 overflow-hidden">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center font-mono font-black text-xs text-white">
              {store.user?.name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="truncate">
                <div className="text-xs font-mono font-semibold truncate text-white/90">{store.user?.name}</div>
                <div className="text-[9px] font-mono text-white/40 truncate">{store.user?.email}</div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/10 hover:bg-red-950/30 text-red-400 py-2 rounded-xl text-xs font-mono transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" /> 
            {sidebarOpen && <span>LOGOUT</span>}
          </button>
        </div>
      </motion.aside>

      {/* --- CENTER WORKSPACE CONTAINER --- */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen pb-16 md:pb-0">
        
        {/* --- DESKTOP TOP NAVIGATION BAR --- */}
        <header className="h-14 border-b border-white/5 bg-[#05050a]/40 backdrop-blur-md px-6 hidden md:flex items-center justify-between z-20">
          <div className="flex items-center gap-2 font-mono text-xs text-white/50">
            <span>SYS_LOC:</span>
            <span className="text-purple-400 font-bold uppercase">{pathname.split('/').pop() || 'DASHBOARD'}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Live running task timer details */}
            {store.activeTaskId && activeTask && (
              <div className="flex items-center gap-2.5 bg-purple-950/30 border border-purple-500/30 rounded-full px-3.5 py-1 text-xs text-purple-200 animate-pulse-glow">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="font-mono text-[10px] text-white/40 uppercase">TIMER:</span>
                <span className="font-bold truncate max-w-[120px] font-mono text-purple-300">{activeTask.title}</span>
                <span className="font-mono font-black text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded-full border border-cyan-800/30">
                  {formatTimer(store.activeTimerElapsed)}
                </span>
                <button 
                  onClick={() => store.stopTaskTimer(true)} 
                  className="hover:text-white border-l border-white/10 pl-1.5 transition ml-1"
                  title="Complete Task"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            )}

            {/* Live digital clock */}
            <div className="flex items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-1 rounded-full text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-bold font-mono">
                {timeStr || '00:00:00'}
              </span>
            </div>

            {/* Chatbot trigger */}
            <button 
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-1.5 rounded-full border transition cursor-pointer ${
                chatOpen ? 'bg-purple-600/20 border-purple-500/50 text-white' : 'bg-white/5 border-white/10 text-purple-400'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* --- SCROLLABLE WORKSPACE CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 z-10 mt-14 md:mt-0">
          {children}
        </div>
      </main>

      {/* --- RIGHT PERSISTENT AI CHAT PANEL --- */}
      <AnimatePresence>
        {chatOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="hidden xl:flex flex-col border-l border-white/5 bg-[#05050a]/95 backdrop-blur-lg shrink-0 h-screen sticky top-0 z-30 overflow-hidden"
          >
            {/* Chat header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span className="font-mono text-xs font-bold">CO-PILOT_CHAT</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Provider select dropdown */}
                <select
                  value={store.selectedModel}
                  onChange={(e) => store.setSelectedModel(e.target.value as any)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[9px] font-mono text-purple-300 focus:outline-none"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">GPT-4o</option>
                  <option value="claude">Claude</option>
                  <option value="grok">Grok</option>
                </select>
                <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat logs scroll area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {store.chatHistory.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`text-[9px] font-mono text-white/30 mb-1`}>
                    {msg.role === 'user' ? 'USER_SESSION' : 'AI_COPILOT'} • {msg.timestamp}
                  </div>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] font-sans ${
                    msg.role === 'user' 
                      ? 'bg-purple-600/30 text-purple-100 rounded-tr-none border border-purple-500/20' 
                      : 'bg-white/5 text-white/90 rounded-tl-none border border-white/5'
                  }`}>
                    {/* Basic custom markdown implementation */}
                    {msg.content.split('\n').map((line, lIdx) => {
                      if (line.startsWith('**') || line.startsWith('1.') || line.startsWith('-')) {
                        return <p key={lIdx} className="font-semibold text-purple-300 mt-1">{line}</p>;
                      }
                      return <p key={lIdx} className="mt-0.5">{line}</p>;
                    })}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex flex-col items-start">
                  <div className="text-[9px] font-mono text-white/30 mb-1">AI_COPILOT is typing...</div>
                  <div className="bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat footer input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-white/2">
              <div className="flex gap-2 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 items-center">
                <button type="button" className="text-white/40 hover:text-white" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Ask for schedule tweaks, break suggestion, advice..."
                  className="bg-transparent border-0 focus:outline-none text-xs flex-1 text-white placeholder-white/30"
                />
                <button 
                  type="submit" 
                  className="bg-purple-600 hover:bg-purple-500 text-white rounded-lg p-1 transition cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
      <OnboardingModal />
    </div>
  );
}
