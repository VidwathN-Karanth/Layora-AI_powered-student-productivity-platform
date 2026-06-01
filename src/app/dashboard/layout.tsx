'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore, ChatMessage } from '@/store/useStore';
import { sendAIChatMessage, resolveScheduleOverlaps } from '@/lib/aiService';
import { 
  LayoutDashboard, CalendarRange, BookMarked, CheckSquare, Calendar, 
  FolderLock, BarChart3, Settings, UserCheck, LogOut, ChevronLeft, 
  ChevronRight, Send, Paperclip, Sparkles, MessageCircle, Clock, 
  Pause, Check, Menu, X, ArrowUpRight, ShieldAlert
} from 'lucide-react';
import { UserButton, useUser, useAuth } from '@clerk/nextjs';
import OnboardingModal from '@/components/OnboardingModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const store = useStore();

  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn && clerkUser) {
      const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || '';
      const fullName = clerkUser.fullName || primaryEmail.split('@')[0];
      if (!store.isAuthenticated || store.user?.email !== primaryEmail) {
        store.login(primaryEmail, fullName);
      }
    }
  }, [isLoaded, isSignedIn, clerkUser]);

  useEffect(() => {
    if (store.isAuthenticated) {
      store.checkAndUpdateStreak();
    }
  }, [store.isAuthenticated]);

  // Routing protection is handled by Clerk Middleware

  // Sidebar collapsible state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Right chatbot panel visibility
  const [chatOpen, setChatOpen] = useState(true);
  
  // Mobile responsive overrides
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        const mobile = window.innerWidth < 1280;
        setIsMobile(mobile);
        if (mobile) {
          setChatOpen(false);
        }
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Digital clock state
  const [timeStr, setTimeStr] = useState('');
  const lastCheckedDateRef = useRef('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      lastCheckedDateRef.current = new Date().toLocaleDateString('en-CA');
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: !store.is24HourFormat }));
      
      const currentDayStr = d.toLocaleDateString('en-CA');
      if (currentDayStr !== lastCheckedDateRef.current) {
        lastCheckedDateRef.current = currentDayStr;
        if (store.isAuthenticated) {
          store.checkAndUpdateStreak();
        }
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [store.is24HourFormat, store.isAuthenticated]);

  useEffect(() => {
    if (store.activeTaskId) {
      const interval = setInterval(() => {
        store.updateTimerSecond();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [store.activeTaskId]);

  // Auto-resolve any timetable overlap conflicts on store hydration/change
  useEffect(() => {
    if (store.timetable && store.timetable.length > 0) {
      const fixedTimetable = resolveScheduleOverlaps(store.timetable);
      if (JSON.stringify(fixedTimetable) !== JSON.stringify(store.timetable)) {
        store.setTimetable(fixedTimetable);
      }
    }
  }, [store.timetable]);

  // Chat message input and scrolling
  const [messageText, setMessageText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  };
  
  useEffect(() => {
    if (chatOpen) {
      scrollToBottom();
      const t1 = setTimeout(scrollToBottom, 50);
      const t2 = setTimeout(scrollToBottom, 150);
      const t3 = setTimeout(scrollToBottom, 350);
      const t4 = setTimeout(scrollToBottom, 600);
      const t5 = setTimeout(scrollToBottom, 1000); // Backstop for slower connections/hydration
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
      };
    }
  }, [store.chatHistory, chatLoading, chatOpen]);

  // Keep chat container scrolled to bottom during width transitions and on initial page mount/reload
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    scrollToBottom();

    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [chatOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const query = messageText;
    setMessageText('');
    store.addChatMessage('user', query);
    setChatLoading(true);

    // Compile history - slice last 6 messages to stay under Groq free tier's 6,000 TPM (Tokens Per Minute) limit
    const history = store.chatHistory.slice(-6).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    // Compile student context - prune UI properties (ids, colors, extra metadata) to minimize token footprint
    const context = {
      currentSchedule: store.timetable.map((block) => ({
        id: block.id,
        day: block.day,
        start: block.start,
        end: block.end,
        title: block.title,
        type: block.type,
        subjectCode: block.subjectCode
      })),
      currentTasks: store.tasks
        .filter((t) => t.status !== 'completed')
        .map((task) => ({
          taskId: task.id,
          title: task.title,
          deadline: task.deadline,
          estimatedMinutes: task.estimatedMinutes
        })),
      currentSubjects: store.subjects.map((sub) => ({
        name: sub.name,
        code: sub.code,
        credits: sub.credits,
        difficulty: sub.difficulty,
        priority: sub.priority
      })),
      currentRoutine: {
        wakeTime: store.user?.wakeTime,
        sleepTime: store.user?.sleepTime,
        collegeTimings: {
          start: store.user?.collegeStart,
          end: store.user?.collegeEnd,
        },
        freeBlocks: store.user?.freeBlocks?.map((fb) => ({
          start: fb.start,
          end: fb.end,
          label: fb.label
        })),
      },
      todayDayOfWeek: new Date().getDay(), // 0 = Sunday, 1 = Monday, etc.
      currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      todayDateString: new Date().toISOString().split('T')[0]
    };

    const rawResponse = await sendAIChatMessage(
      query,
      history,
      store.selectedModel,
      store.apiKeys,
      context
    );

    let cleanResponse = rawResponse;
    
    try {
      const parsedData = JSON.parse(rawResponse);
      
      if (parsedData.reply) {
        cleanResponse = parsedData.reply;
      }
      
      if (parsedData.actions && Array.isArray(parsedData.actions)) {
        const { executeAIActions } = await import('@/lib/actionExecutor');
        executeAIActions(parsedData.actions);
      }
    } catch (err) {
      console.error('Failed to parse AI JSON response:', err);
    }

    store.addChatMessage('assistant', cleanResponse);
    setChatLoading(false);

  };



  const handleLogout = async () => {
    store.logout();
    await signOut();
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

  const isAdmin = store.user?.email?.toLowerCase() === 'vidwathkaranth@gmail.com';
  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Weekly Planner', path: '/dashboard/planner', icon: CalendarRange },
    { name: 'Courses', path: '/dashboard/courses', icon: BookMarked },
    { name: 'Tasks', path: '/dashboard/tasks', icon: CheckSquare },
    { name: 'Resources', path: '/dashboard/resources', icon: FolderLock },
    { name: 'Analytics', path: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
    ...(isAdmin ? [{ name: 'Admin Portal', path: '/admin', icon: ShieldAlert }] : [])
  ];

  if (!isLoaded || !store.isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-cyber-dark text-white flex relative overflow-hidden font-mono">
      {/* Background Neon Elements */}
      <div className="hidden glow-orb w-[500px] h-[500px] bg-cyber-purple/20 top-0 left-[-200px]"></div>
      <div className="hidden glow-orb w-[500px] h-[500px] bg-cyber-blue/20 bottom-0 right-0"></div>

      {/* --- MOBILE NAV TOPBAR --- */}
      <div className="md:hidden w-full h-14 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 z-40 fixed top-0 left-0">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-cyber-blue">
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <span className="font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyber-purple to-cyber-blue">Layora</span>
        <button onClick={() => setChatOpen(!chatOpen)} className="p-2 hover:bg-white/5 rounded-lg text-white">
          <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
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
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-[240px] bg-cyber-dark/95 border-r border-white/10 z-50 flex flex-col justify-between p-3.5 md:hidden"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="font-mono font-bold text-cyber-blue text-sm">Layora</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-white/50"><X className="w-5 h-5" strokeWidth={1.5} /></button>
                </div>
                <nav className="space-y-0.5">
                  {menuItems.map((item) => {
                    const active = pathname === item.path;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.name}
                        onClick={() => { router.push(item.path); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                          active ? 'bg-white/10 text-cyber-blue font-bold' : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                        {item.name.toUpperCase()}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2.5 bg-white/5 p-2 rounded-lg border border-white/10">
                  <UserButton appearance={{ elements: { userButtonAvatarBox: "w-7 h-7 rounded-lg" } }} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono font-semibold truncate text-white">{store.user?.name || 'Layora Student'}</div>
                    <div className="text-[8px] font-mono text-white/40 truncate">{store.user?.email}</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/15 hover:bg-red-950/25 text-red-400 py-1.5 rounded-lg text-xs font-mono transition cursor-pointer">
                  <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} /> Logout
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
        className="hidden md:flex flex-col justify-between p-4 border-r border-white/10 bg-black/20 backdrop-blur-md shrink-0 h-screen sticky top-0 z-30"
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
                  <span className="w-6 h-6 rounded bg-primary flex items-center justify-center text-on-surface text-[10px]">L</span> LAYORA
                </motion.span>
              ) : (
                <motion.div 
                  key="short-logo" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center w-full gap-2 cursor-pointer"
                  onClick={() => setChatOpen(!chatOpen)}
                  title="Open Chatbot"
                >
                  <span className="font-mono font-black text-base text-primary w-full text-center">
                    L
                  </span>
                  <span className="text-[8px] font-mono font-bold text-cyber-blue uppercase text-center bg-cyber-blue/10 px-1 py-0.5 rounded border border-cyber-blue/30 w-full whitespace-nowrap overflow-hidden">
                    Chatbot
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-white/10 rounded-lg border border-white/10 text-white/50 hover:text-white transition"
            >
              {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />}
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
                      ? 'bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/10 text-white border border-white/10' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-cyber-blue' : ''}`} strokeWidth={1.5} />
                  {sidebarOpen && <span>{item.name.toUpperCase()}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 bg-white/5 p-2.5 rounded-xl border border-white/10 overflow-hidden">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8 rounded-lg shrink-0" } }} />
            {sidebarOpen && (
              <div className="truncate min-w-0">
                <div className="text-xs font-mono font-semibold truncate text-white">{store.user?.name}</div>
                <div className="text-[9px] font-mono text-white/40 truncate">{store.user?.email}</div>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/10 hover:bg-red-950/30 text-red-400 py-2 rounded-xl text-xs font-mono transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} /> 
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* --- CENTER WORKSPACE CONTAINER --- */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen pb-16 md:pb-0">
        
        {/* --- DESKTOP TOP NAVIGATION BAR --- */}
        <header className="h-14 border-b border-white/10 bg-black/20 backdrop-blur-md px-6 hidden md:flex items-center justify-between z-20">
          <div className="flex items-center gap-2 font-mono text-xs text-white/40">
            <span>Workspace:</span>
            <span className="text-cyber-blue font-bold uppercase">{pathname.split('/').pop() || 'DASHBOARD'}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Live running task timer details */}
            {store.activeTaskId && activeTask && (
              <div className="flex items-center gap-2.5 bg-cyber-blue/10 border border-cyber-blue/30 rounded-full px-3.5 py-1 text-xs text-cyber-blue animate-pulse-glow">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="font-mono text-[10px] text-white/50 uppercase">Timer:</span>
                <span className="font-bold truncate max-w-[120px] font-mono text-white">{activeTask.title}</span>
                <span className="font-mono font-black text-cyber-blue text-glow-cyan">
                  {formatTimer(Math.max(0, (activeTask.estimatedMinutes * 60) - store.activeTimerElapsed))}
                </span>
                <button 
                  onClick={() => store.stopTaskTimer(true, true)} 
                  className="hover:text-white border-l border-white/20 pl-1.5 transition ml-1"
                  title="Complete Task"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                </button>
              </div>
            )}



            {/* Live digital clock with 12/24 toggle */}
            <div className="flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-1.5 rounded-full font-mono">
              <Clock className="w-4 h-4 text-cyber-blue animate-spin-slow" strokeWidth={1.5} />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-black font-mono text-xl tracking-wider min-w-[110px] text-center">
                {timeStr || '00:00:00'}
              </span>
              <button 
                onClick={() => store.setIs24HourFormat(!store.is24HourFormat)}
                className="ml-1 text-[9px] font-bold uppercase bg-white/10 hover:bg-white/20 text-cyber-blue px-1.5 py-0.5 rounded cursor-pointer transition border border-white/10"
                title="Toggle 12h/24h Format"
              >
                {store.is24HourFormat ? '24H' : '12H'}
              </button>
            </div>

            {/* Chatbot trigger */}
            <button 
              onClick={() => setChatOpen(!chatOpen)}
              className={`flex items-center justify-center rounded-full border transition cursor-pointer ${
                chatOpen ? 'bg-cyber-blue/20 border-cyber-blue text-cyber-blue w-8 h-8 p-0' : 'gap-2 px-3 py-1.5 bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
              title={chatOpen ? "Close Panel" : "Open Chatbot"}
            >
              {chatOpen ? (
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider">Chatbot</span>
                </>
              )}
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
        {chatOpen && isMobile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setChatOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 xl:hidden"
          />
        )}
        {chatOpen && (
          <motion.aside
            initial={isMobile ? { x: '100%', opacity: 0 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0, opacity: 1 } : { width: 340, opacity: 1 }}
            exit={isMobile ? { x: '100%', opacity: 0 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 right-0 z-50 xl:sticky xl:top-0 w-[85%] sm:w-[340px] xl:w-[340px] flex flex-col border-l border-white/10 bg-[#0B0F19]/95 xl:bg-black/40 backdrop-blur-xl shrink-0 h-[100dvh] overflow-hidden shadow-2xl xl:shadow-none"
          >
            {/* Chat header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyber-purple animate-pulse" />
                <span className="font-mono text-xs font-bold">Co-pilot Chat</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-cyber-blue border border-cyber-blue/30 px-2 py-0.5 rounded uppercase">Groq AI</span>
                <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Chat logs scroll area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {store.chatHistory.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`text-[9px] font-mono text-white/30 mb-1`}>
                    {msg.role === 'user' ? 'User' : 'Co-pilot'} • {msg.timestamp}
                  </div>
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[85%] font-sans ${
                    msg.role === 'user' 
                      ? 'bg-cyber-purple/20 text-white rounded-tr-none border border-cyber-purple/30' 
                      : 'glass-panel text-white/90 rounded-tl-none border border-white/10'
                  }`}>
                    {/* Basic custom markdown implementation */}
                    {msg.content.split('\n').map((line, lIdx) => {
                      if (line.startsWith('**') || line.startsWith('1.') || line.startsWith('-')) {
                        return <p key={lIdx} className="font-semibold text-cyber-blue mt-1">{line}</p>;
                      }
                      return <p key={lIdx} className="mt-0.5">{line}</p>;
                    })}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex flex-col items-start">
                  <div className="text-[9px] font-mono text-white/30 mb-1">Co-pilot is typing...</div>
                  <div className="glass-panel p-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center border border-white/10">
                    <span className="w-1.5 h-1.5 bg-cyber-blue rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-cyber-blue rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-cyber-blue rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat footer input */}
            <form onSubmit={handleSendMessage} className="p-3 pb-5 md:pb-3 border-t border-white/10 bg-white/5">
              <div className="flex gap-2 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 items-center">
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
                  className="bg-cyber-blue/20 hover:bg-cyber-blue/40 text-cyber-blue rounded-lg p-1 transition cursor-pointer"
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
