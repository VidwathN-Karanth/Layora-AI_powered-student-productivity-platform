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
  Pause, Check, Menu, X, ArrowUpRight
} from 'lucide-react';
import OnboardingModal from '@/components/OnboardingModal';
import CommandPalette from '@/components/CommandPalette';

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

    // Compile history - slice last 6 messages to stay under Groq free tier's 6,000 TPM (Tokens Per Minute) limit
    const history = store.chatHistory.slice(-6).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    // Compile student context - prune UI properties (ids, colors, extra metadata) to minimize token footprint
    const context = {
      currentSchedule: store.timetable.map((block) => ({
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
      }
    };

    const rawResponse = await sendAIChatMessage(
      query,
      history,
      store.selectedModel,
      store.apiKeys,
      context
    );

    interface ParsedTag {
      tagName: string;
      jsonContent: string;
      fullTagText: string;
    }

    const cleanJson = (jsonStr: string) => {
      // Strip markdown code block wrappers if any
      let cleaned = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Strip single-line comments // ...
      cleaned = cleaned.replace(/\/\/.*/g, '');
      
      // Strip multi-line comments /* ... */
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Strip trailing commas before closing brackets/braces
      cleaned = cleaned
        .replace(/,\s*\]/g, ']')
        .replace(/,\s*\}/g, '}');
        
      return cleaned.trim();
    };

    function parseTags(text: string, tagNames: string[]): ParsedTag[] {
      const results: ParsedTag[] = [];
      
      for (const tagName of tagNames) {
        const tagStart = `[${tagName}:`;
        let index = 0;
        
        while (true) {
          const startIdx = text.indexOf(tagStart, index);
          if (startIdx === -1) break;
          
          let depth = 1;
          let endIdx = -1;
          let inString = false;
          let escape = false;
          
          for (let i = startIdx + 1; i < text.length; i++) {
            const char = text[i];
            if (escape) {
              escape = false;
              continue;
            }
            if (char === '\\') {
              escape = true;
              continue;
            }
            if (char === '"') {
              inString = !inString;
              continue;
            }
            if (!inString) {
              if (char === '[') {
                depth++;
              } else if (char === ']') {
                depth--;
                if (depth === 0) {
                  endIdx = i;
                  break;
                }
              }
            }
          }
          
          if (endIdx !== -1) {
            const fullTagText = text.substring(startIdx, endIdx + 1);
            const tagContent = text.substring(startIdx + tagStart.length, endIdx).trim();
            
            // Find JSON part
            let jsonContent = tagContent;
            const firstBracket = tagContent.match(/^[^{\[]*([{\[])/);
            if (firstBracket) {
              const startChar = firstBracket[1];
              const endChar = startChar === '[' ? ']' : '}';
              const firstIdx = tagContent.indexOf(startChar);
              const lastIdx = tagContent.lastIndexOf(endChar);
              if (firstIdx !== -1 && lastIdx !== -1 && lastIdx > firstIdx) {
                jsonContent = tagContent.substring(firstIdx, lastIdx + 1);
              }
            }
            
            results.push({
              tagName,
              jsonContent,
              fullTagText
            });
            
            index = endIdx + 1;
          } else {
            index = startIdx + 1;
          }
        }
      }
      
      return results;
    }

    const newTimetableBlocks = [...store.timetable];

    const blockColors = {
      class: 'border-l-4 border-cyan-500 bg-cyan-950/20 text-cyan-200',
      study: 'border-l-4 border-purple-500 bg-purple-950/20 text-purple-200',
      extracurricular: 'border-l-4 border-pink-500 bg-pink-950/20 text-pink-200',
      break: 'border-l-4 border-emerald-500 bg-emerald-950/20 text-emerald-200',
    };

    const parsedTags = parseTags(rawResponse, ['SCHEDULE_BLOCK', 'CREATE_TASK', 'REPLACE_TIMETABLE']);

    // Parse schedule blocks
    parsedTags.filter(t => t.tagName === 'SCHEDULE_BLOCK').forEach(tag => {
      try {
        const blockData = JSON.parse(cleanJson(tag.jsonContent));
        const type = blockData.type || 'study';
        newTimetableBlocks.push({
          id: `ai-block-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          day: Number(blockData.day),
          start: blockData.start || '17:00',
          end: blockData.end || '18:00',
          title: blockData.title || 'AI Scheduled Block',
          type: type,
          color: blockColors[type as keyof typeof blockColors] || blockColors.study,
          details: blockData.details || 'Dynamically scheduled by AI Copilot'
        });
      } catch (err) {
        console.error('Failed to parse AI schedule block JSON:', err);
      }
    });

    if (newTimetableBlocks.length > store.timetable.length) {
      store.setTimetable(newTimetableBlocks);
    }

    // Parse task cards
    parsedTags.filter(t => t.tagName === 'CREATE_TASK').forEach(tag => {
      try {
        const taskData = JSON.parse(cleanJson(tag.jsonContent));
        const subjectId = store.subjects[0]?.id || 'sub-general';
        const subjectName = store.subjects[0]?.name || 'General Study';
        store.addTask({
          subjectId,
          subjectName,
          title: taskData.title || 'AI Generated Task',
          deadline: taskData.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          estimatedMinutes: Number(taskData.estimatedMinutes) || 60,
        });
      } catch (err) {
        console.error('Failed to parse AI task JSON:', err);
      }
    });

    // Parse complete timetable replacements
    parsedTags.filter(t => t.tagName === 'REPLACE_TIMETABLE').forEach(tag => {
      try {
        const blocksData = JSON.parse(cleanJson(tag.jsonContent));
        if (Array.isArray(blocksData)) {
          const sanitisedBlocks = blocksData.map((b: any, idx: number) => ({
            id: b.id || `ai-block-${Date.now()}-${idx}`,
            day: Number(b.day),
            start: b.start || '17:00',
            end: b.end || '18:00',
            title: b.title || 'AI Scheduled Block',
            type: b.type || 'study',
            color: b.color || blockColors[b.type as keyof typeof blockColors] || blockColors.study,
            subjectCode: b.subjectCode,
            details: b.details || 'Re-scheduled by AI Copilot'
          }));
          
          store.setTimetable(sanitisedBlocks);

          // Auto-task creator fallback: automatically create cards in the tasks list for scheduled study sessions
          sanitisedBlocks.forEach((block: any) => {
            if (block.type === 'study') {
              const cleanTitle = block.title.replace(/^Study:\s*/i, '').trim();
              const taskExists = store.tasks.some(
                t => t.title.toLowerCase() === cleanTitle.toLowerCase()
              );
              if (!taskExists && cleanTitle.toLowerCase() !== 'study time') {
                const matchedSub = store.subjects.find(
                  s => s.code === block.subjectCode || s.name.toLowerCase() === cleanTitle.toLowerCase()
                );
                const subjectId = matchedSub?.id || store.subjects[0]?.id || 'sub-general';
                const subjectName = matchedSub?.name || store.subjects[0]?.name || 'General Study';
                
                let duration = 60;
                if (block.start && block.end) {
                  const [sh, sm] = block.start.split(':').map(Number);
                  const [eh, em] = block.end.split(':').map(Number);
                  duration = (eh * 60 + em) - (sh * 60 + sm);
                  if (duration <= 0) duration = 60;
                }

                store.addTask({
                  subjectId,
                  subjectName,
                  title: cleanTitle,
                  deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                  estimatedMinutes: duration
                });
              }
            }
          });
        }
      } catch (err) {
        console.error('Failed to parse AI replacement timetable JSON:', err);
      }
    });

    // Strip commands from response to show clean markdown to the user
    let cleanResponse = rawResponse;
    parsedTags.forEach(tag => {
      cleanResponse = cleanResponse.replace(tag.fullTagText, '');
    });
    cleanResponse = cleanResponse.trim();

    store.addChatMessage('assistant', cleanResponse);
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
    <div className="min-h-screen bg-background text-[#f3f4f6] flex relative overflow-hidden font-sans">
      {/* Background Neon Elements */}
      <div className="glow-orb w-[500px] h-[500px] bg-purple-950/10 top-0 left-[-200px]"></div>
      <div className="glow-orb w-[500px] h-[500px] bg-blue-950/10 bottom-0 right-0"></div>

      {/* --- MOBILE NAV TOPBAR --- */}
      <div className="md:hidden w-full h-14 bg-cyber-dark/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-40 fixed top-0 left-0">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-purple-400">
          <Menu className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <span className="font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Layora</span>
        <button onClick={() => setChatOpen(!chatOpen)} className="p-2 hover:bg-white/5 rounded-lg text-cyan-400">
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 left-0 w-[260px] bg-surface-container-lowest border-r border-white/10 z-50 flex flex-col justify-between p-4 md:hidden"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <span className="font-mono font-bold text-purple-400 text-sm">Layora</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-white/40"><X className="w-5 h-5" strokeWidth={1.5} /></button>
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
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
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
                    <div className="text-xs font-mono font-semibold truncate">{store.user?.name || 'Layora Student'}</div>
                    <div className="text-[9px] font-mono text-white/40 truncate">{store.user?.email}</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 border border-red-500/20 bg-red-950/10 hover:bg-red-950/30 text-red-400 py-2 rounded-xl text-xs font-mono transition">
                  <LogOut className="w-4 h-4" strokeWidth={1.5} /> Logout
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
        className="hidden md:flex flex-col justify-between p-4 border-r border-white/5 bg-surface-container-lowest/90 backdrop-blur-md shrink-0 h-screen sticky top-0 z-30"
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
                  <span className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-white text-[10px]">L</span> LAYORA
                </motion.span>
              ) : (
                <motion.span 
                  key="short-logo" 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="font-mono font-black text-base text-purple-400 w-full text-center"
                >
                  L
                </motion.span>
              )}
            </AnimatePresence>

            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-white/5 rounded-lg border border-white/10 text-white/40 hover:text-white transition"
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
                      ? 'bg-gradient-to-r from-purple-600/40 to-blue-500/20 text-white border border-purple-500/30' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 text-purple-400 shrink-0" strokeWidth={1.5} />
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
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} /> 
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* --- CENTER WORKSPACE CONTAINER --- */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen pb-16 md:pb-0">
        
        {/* --- DESKTOP TOP NAVIGATION BAR --- */}
        <header className="h-14 border-b border-white/5 bg-surface-container-lowest/40 backdrop-blur-md px-6 hidden md:flex items-center justify-between z-20">
          <div className="flex items-center gap-2 font-mono text-xs text-white/50">
            <span>Workspace:</span>
            <span className="text-purple-400 font-bold uppercase">{pathname.split('/').pop() || 'DASHBOARD'}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Live running task timer details */}
            {store.activeTaskId && activeTask && (
              <div className="flex items-center gap-2.5 bg-purple-950/30 border border-purple-500/30 rounded-full px-3.5 py-1 text-xs text-purple-200 animate-pulse-glow">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="font-mono text-[10px] text-white/40 uppercase">Timer:</span>
                <span className="font-bold truncate max-w-[120px] font-mono text-purple-300">{activeTask.title}</span>
                <span className="font-mono font-black text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded-full border border-cyan-800/30">
                  {formatTimer(store.activeTimerElapsed)}
                </span>
                <button 
                  onClick={() => store.stopTaskTimer(true)} 
                  className="hover:text-white border-l border-white/10 pl-1.5 transition ml-1"
                  title="Complete Task"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                </button>
              </div>
            )}

            {/* Command Palette Center */}
            <CommandPalette />

            {/* Live digital clock */}
            <div className="flex items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-1 rounded-full text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" strokeWidth={1.5} />
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
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
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
            className="hidden xl:flex flex-col border-l border-white/5 bg-surface-container-lowest/95 backdrop-blur-lg shrink-0 h-screen sticky top-0 z-30 overflow-hidden"
          >
            {/* Chat header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                <span className="font-mono text-xs font-bold">Co-pilot Chat</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/30 border border-cyan-850/40 px-2 py-0.5 rounded uppercase">Groq AI</span>
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
                    {msg.role === 'user' ? 'User' : 'Co-pilot'} • {msg.timestamp}
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
                  <div className="text-[9px] font-mono text-white/30 mb-1">Co-pilot is typing...</div>
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
