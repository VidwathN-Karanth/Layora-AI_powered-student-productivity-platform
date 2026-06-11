'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, Globe, ExternalLink, ChevronRight, AlertCircle, Sparkles, Check, Plus, Trash
} from 'lucide-react';
import Link from 'next/link';
import { formatTimeStr } from '@/lib/timeUtils';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

export default function DashboardHome() {
  const store = useStore();

  const user = store.user;
  const subjects = store.subjects;
  const tasks = store.tasks;
  const courses = store.courses;
  const websites = store.websites;
  const timetable = store.timetable;

  const [mounted, setMounted] = useState(false);
  const [isAddingInstantTask, setIsAddingInstantTask] = useState(false);
  const [instantTitle, setInstantTitle] = useState('');
  const [instantStart, setInstantStart] = useState('');
  const [instantEnd, setInstantEnd] = useState('');
  const [instantError, setInstantError] = useState('');
  const [instantMode, setInstantMode] = useState<'task' | 'session'>('task');

  const [isAddingLauncher, setIsAddingLauncher] = useState(false);
  const [launcherName, setLauncherName] = useState('');
  const [launcherUrl, setLauncherUrl] = useState('');
  const [launcherError, setLauncherError] = useState('');

  const handleAddLauncher = () => {
    setLauncherError('');
    if (!launcherName.trim() || !launcherUrl.trim()) {
      setLauncherError('Name and URL are required.');
      return;
    }

    let formattedUrl = launcherUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      new URL(formattedUrl);
    } catch (_) {
      setLauncherError('Please enter a valid URL.');
      return;
    }

    store.addWebsite({
      name: launcherName.trim(),
      url: formattedUrl,
      timeSpentGoal: 0
    });

    setLauncherName('');
    setLauncherUrl('');
    setIsAddingLauncher(false);
  };

  const handleOpenInstantTaskModal = () => {
    const now = new Date();
    const formatHHMM = (date: Date) => {
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    };
    
    setInstantTitle('');
    setInstantStart(formatHHMM(now));
    
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    setInstantEnd(formatHHMM(oneHourLater));
    
    setInstantError('');
    setInstantMode('task');
    setIsAddingInstantTask(true);
  };

  const handleAddInstantTask = () => {
    setInstantError('');
    if (!instantTitle.trim()) {
      setInstantError('Task name is required.');
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const [startHour, startMin] = instantStart.split(':').map(Number);
    const [endHour, endMin] = instantEnd.split(':').map(Number);

    if (startHour < currentHour || (startHour === currentHour && startMin < currentMin)) {
      setInstantError('Cannot create a task for a time that has already passed today.');
      return;
    }

    const startTotalMin = startHour * 60 + startMin;
    const endTotalMin = endHour * 60 + endMin;

    if (endTotalMin <= startTotalMin && endHour >= startHour) {
      setInstantError('End time must be after start time.');
      return;
    }

    const todayNum = now.getDay();
    const newBlock = {
      id: `instant-block-${Date.now()}`,
      day: todayNum,
      start: instantStart,
      end: instantEnd,
      title: instantTitle,
      type: 'study' as const,
      color: instantMode === 'session'
        ? 'border-l-4 border-cyber-blue bg-cyber-blue/10 text-white'
        : 'border-l-4 border-cyber-purple bg-cyber-purple/10 text-white',
      details: instantMode === 'session' ? 'Instant session started from dashboard' : 'Instant task scheduled from dashboard',
      completed: false,
      isSession: instantMode === 'session'
    };

    store.setTimetable([...store.timetable, newBlock]);
    setInstantTitle('');
    setIsAddingInstantTask(false);
  };

  useEffect(() => {
    setMounted(true);
  }, []);





  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours > 0 ? hours + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timeToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const handleToggleBlockCompleted = (block: any) => {
    const isCompleted = !block.completed;
    store.updateTimetableBlock(block.id, { completed: isCompleted });

    const taskId = `task-from-block-${block.id}`;
    if (isCompleted) {
      // Find matching subject
      let subjectId = '';
      let subjectName = 'General activity';
      if (block.type === 'study') {
        const matchedSubject = store.subjects.find((s) => s.code === block.subjectCode || block.title.toLowerCase().includes(s.name.toLowerCase()));
        if (matchedSubject) {
          subjectId = matchedSubject.id;
          subjectName = matchedSubject.name;
        } else if (block.title.includes(':')) {
          subjectName = block.title.split(':').pop()?.trim() || 'General study';
        }
      }

      const startMin = timeToMin(block.start);
      const endMin = timeToMin(block.end);
      const duration = endMin >= startMin ? (endMin - startMin) : (1440 - startMin + endMin);

      // Create a completed task in the store.tasks array
      const newTask = {
        id: taskId,
        subjectId: subjectId || 'sub-general',
        subjectName: subjectName,
        title: block.title,
        deadline: new Date().toISOString().split('T')[0],
        estimatedMinutes: duration,
        actualMinutesSpent: duration,
        status: 'completed' as const,
        completedAt: new Date().toISOString()
      };

      store.setFullState({
        tasks: [...store.tasks.filter(t => t.id !== taskId), newTask]
      });
    } else {
      // Remove it from the tasks list
      store.setFullState({
        tasks: store.tasks.filter(t => t.id !== taskId)
      });
    }
  };

  const handleStartStudySession = (block: any) => {
    const taskId = `task-from-block-${block.id}`;
    const existingTask = store.tasks.find((t) => t.id === taskId);

    if (!existingTask) {
      let subjectId = '';
      let subjectName = 'General study';
      if (block.subjectCode) {
        const matchedSubject = store.subjects.find((s) => s.code === block.subjectCode);
        if (matchedSubject) {
          subjectId = matchedSubject.id;
          subjectName = matchedSubject.name;
        }
      }

      const startMin = timeToMin(block.start);
      const endMin = timeToMin(block.end);
      const duration = endMin >= startMin ? (endMin - startMin) : (1440 - startMin + endMin);

      const newTask = {
        id: taskId,
        subjectId: subjectId || 'sub-general',
        subjectName: subjectName,
        title: block.title,
        deadline: new Date().toISOString().split('T')[0],
        estimatedMinutes: duration,
        actualMinutesSpent: 0,
        status: 'in_progress' as const
      };

      store.setFullState({
        tasks: [...store.tasks.filter(t => t.id !== taskId), newTask]
      });
    }

    if (store.activeTaskId === taskId) {
      store.stopTaskTimer(true);
    } else {
      store.startTaskTimer(taskId);
    }
  };

  // Find today's events from the weekly plan
  const todayNum = new Date().getDay(); // 0 = Sunday, 1 = Monday etc.
  const todaySchedule = timetable
    .filter((b) => b.day === todayNum && !b.completed)
    .sort((a, b) => a.start.localeCompare(b.start));

  const tomorrowNum = (todayNum + 1) % 7;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const tomorrowLabel = dayNames[tomorrowNum];
  const tomorrowSchedule = timetable
    .filter((b) => b.day === tomorrowNum && !b.completed)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20 font-mono text-xs text-white/50">
        Syncing dashboard telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-geist font-bold tracking-tight text-white">
            Welcome Back, <span className="text-cyber-blue text-glow-cyan">{user?.name || 'Student'}</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Supabase Cloud Sync Status Badge */}
          {isSupabaseConfigured ? (
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 rounded-full px-2.5 py-1.5 flex items-center gap-1.5 shrink-0" title="State synced to Supabase database in real-time.">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              SUPABASE SYNCED
            </span>
          ) : (
            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/30 border border-amber-500/20 rounded-full px-2.5 py-1.5 flex items-center gap-1.5 shrink-0" title="Running in Local Demo Mode. Enable Supabase to sync data.">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              LOCAL DEMO
            </span>
          )}

          {/* Instant Button */}
          <button 
            onClick={handleOpenInstantTaskModal}
            className="flex items-center gap-2 bg-white/5 hover:bg-cyber-blue/10 border border-white/10 hover:border-cyber-blue/40 rounded-xl px-4 py-2 text-xs font-mono transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-cyber-blue" />
            <span>Instant</span>
          </button>

          {/* Streak counter with fire glow */}
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/10 border border-cyber-purple/30 rounded-xl px-4 py-2 shadow-lg shadow-cyber-purple/20">
            <Flame className="w-5 h-5 text-cyber-purple animate-bounce" strokeWidth={1.5} />
            <div>
              <div className="text-xs font-mono font-bold leading-none text-white">{user?.streakCount || 0} DAYS</div>
              <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">Active Streak</span>
            </div>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT COLUMNS: DAILY AGENDA & RECOMMENDATIONS --- */}
        <div className="lg:col-span-2 space-y-6">

          {/* Daily Schedule Timeline */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-xs font-geist font-bold tracking-wider text-cyber-blue uppercase text-glow-cyan">Daily Schedule</h3>
              <Link href="/dashboard/planner" className="text-[10px] font-mono text-cyber-purple hover:underline flex items-center gap-1">
                Full Planner <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Link>
            </div>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {todaySchedule.length === 0 ? (
                <div className="text-center font-mono text-xs text-white/50 py-8 border border-dashed border-white/20 rounded-xl">
                  No academic blocks scheduled for today. Rest cycle active.
                </div>
              ) : (
                todaySchedule.map((block) => (
                  <div key={block.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-white/5 border-l-4 transition-all ${
                    block.isSession === false
                      ? 'border-cyber-purple'
                      : (block.type === 'study' ? 'border-cyber-blue' : 'border-cyber-purple')
                  }`}>
                    {/* Main row info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
                      {/* Tick Icon to complete task */}
                      <button 
                        onClick={() => handleToggleBlockCompleted(block)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition shrink-0 cursor-pointer ${
                          block.completed 
                            ? 'bg-emerald-500 border-emerald-400 text-black' 
                            : 'border-white/20 hover:border-emerald-500 hover:bg-emerald-500/10 text-transparent hover:text-emerald-400'
                        }`}
                        title="Mark completed"
                      >
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </button>

                      {/* Time Column */}
                      <div className="font-mono text-xs font-bold text-center w-16 shrink-0 text-white leading-tight">
                        <div>{formatTimeStr(block.start, store.is24HourFormat)}</div>
                        <div className="text-[9px] text-white/40 font-normal mt-0.5">{formatTimeStr(block.end, store.is24HourFormat)}</div>
                      </div>

                      {/* Details */}
                      <div className="border-l border-white/10 pl-3 flex-1 min-w-0">
                        <div className="font-mono font-semibold text-xs text-white truncate">{block.title}</div>
                        <p className="text-[10px] text-white/40 truncate font-sans mt-0.5">{block.details}</p>
                      </div>
                    </div>

                    {/* Start Session Button */}
                    {block.type === 'study' && block.isSession !== false && (
                      (() => {
                        const startMin = timeToMin(block.start);
                        const endMin = timeToMin(block.end);
                        const durationMinutes = endMin >= startMin ? (endMin - startMin) : (1440 - startMin + endMin);
                        const isTicking = store.activeTaskId === `task-from-block-${block.id}`;
                        const remainingSeconds = Math.max(0, (durationMinutes * 60) - store.activeTimerElapsed);

                        return (
                          <div className="flex justify-end sm:justify-start w-full sm:w-auto pl-8 sm:pl-0 shrink-0">
                            <button
                              onClick={() => handleStartStudySession(block)}
                              className={`px-3 py-1.5 rounded-xl text-[9px] font-mono font-bold flex items-center gap-1 transition cursor-pointer uppercase border w-full sm:w-auto justify-center ${
                                isTicking
                                  ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse'
                                  : 'bg-cyber-blue/10 hover:bg-cyber-blue/20 border border-cyber-blue/30 text-cyber-blue'
                              }`}
                            >
                              {isTicking ? `Stop (${formatTimer(remainingSeconds)})` : 'Start Session'}
                            </button>
                          </div>
                        );
                      })()
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tomorrow's Schedule Timeline */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-xs font-geist font-bold tracking-wider text-cyber-purple uppercase text-glow-purple">
                Tomorrow's Schedule ({tomorrowLabel})
              </h3>
              <span className="text-[9px] font-mono text-white/40 uppercase">Upcoming Blocks</span>
            </div>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {tomorrowSchedule.length === 0 ? (
                <div className="text-center font-mono text-xs text-white/50 py-8 border border-dashed border-white/20 rounded-xl">
                  No academic blocks scheduled for tomorrow.
                </div>
              ) : (
                tomorrowSchedule.map((block) => (
                  <div key={block.id} className={`flex items-center gap-4 p-3 rounded-xl bg-white/5 border-l-4 transition-all ${
                    block.type === 'study' ? 'border-cyber-blue' : 'border-cyber-purple'
                  }`}>
                    <div className="font-mono text-xs font-bold text-center w-20 text-white shrink-0">
                      <div>{formatTimeStr(block.start, store.is24HourFormat)}</div>
                      <div className="text-[10px] text-white/50 font-normal">{formatTimeStr(block.end, store.is24HourFormat)}</div>
                    </div>

                    <div className="border-l border-white/10 pl-4 flex-1 min-w-0">
                      <div className="font-mono font-semibold text-xs text-white truncate">{block.title}</div>
                      <p className="text-[10px] text-white/50 truncate font-sans mt-0.5">{block.details}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: ACTIVE COURSES & QUICK LAUNCHERS --- */}
        <div className="space-y-6">
          {/* Active Courses Widget */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-geist font-bold tracking-wider text-cyber-purple border-b border-white/10 pb-2 uppercase text-glow-purple">Active Courses</h3>
            
            <div className="space-y-4">
              {courses.length === 0 ? (
                <p className="text-xs text-white/40 font-mono text-center py-6">No online courses logged</p>
              ) : (
                courses.map((course) => (
                  <div key={course.id} className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-mono font-bold text-white leading-tight">{course.name}</div>
                        <span className="text-[9px] font-mono text-white/50">{course.platform}</span>
                      </div>
                      <span className="text-xs font-mono font-black text-cyber-blue text-glow-cyan">{course.progress}%</span>
                    </div>
                    
                    {/* Progress Slider */}
                    <div className="progress-track bg-white/10">
                      <div 
                        className="progress-fill bg-gradient-to-r from-cyber-purple to-cyber-blue shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[9px] font-mono text-white/40">
                      <span>Target: {course.weeklyGoal} hrs/wk</span>
                      <span>Ends: {course.deadline}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Launchers Widget */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-xs font-geist font-bold tracking-wider text-cyber-blue uppercase text-glow-cyan flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyber-blue" /> Quick Launchers
              </h3>
              <button 
                onClick={() => setIsAddingLauncher(!isAddingLauncher)} 
                className="p-1 hover:bg-white/10 rounded-lg text-cyber-blue transition cursor-pointer"
                title="Add Launcher"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Inline Add Form */}
            <AnimatePresence>
              {isAddingLauncher && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-3 bg-white/5 border border-white/10 rounded-xl p-3.5"
                >
                  <div>
                    <label className="block text-[9px] font-mono text-white/50 mb-1 uppercase tracking-wider">Name</label>
                    <input
                      type="text"
                      value={launcherName}
                      onChange={(e) => setLauncherName(e.target.value)}
                      placeholder="e.g. GitHub"
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-cyber-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-white/50 mb-1 uppercase tracking-wider">URL</label>
                    <input
                      type="text"
                      value={launcherUrl}
                      onChange={(e) => setLauncherUrl(e.target.value)}
                      placeholder="https://github.com"
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-cyber-blue"
                    />
                  </div>
                  {launcherError && (
                    <div className="text-[10px] text-red-400 font-mono">{launcherError}</div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsAddingLauncher(false)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg px-2.5 py-1 text-[10px] font-mono transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddLauncher}
                      className="bg-cyber-blue/20 hover:bg-cyber-blue/40 border border-cyber-blue text-cyber-blue rounded-lg px-3 py-1 text-[10px] font-mono font-bold transition cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stacked Launchers List */}
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {websites.length === 0 ? (
                <p className="text-xs text-white/40 font-mono text-center py-6">No launchers configured</p>
              ) : (
                websites.map((site) => {
                  let domain = '';
                  try {
                    let urlStr = site.url;
                    if (!/^https?:\/\//i.test(urlStr)) {
                      urlStr = 'https://' + urlStr;
                    }
                    domain = new URL(urlStr).hostname;
                  } catch (e) {
                    domain = site.url;
                  }

                  const faviconSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                  return (
                    <div 
                      key={site.id} 
                      className="flex items-center justify-between p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyber-blue/40 transition group"
                    >
                      <a
                        href={site.url.startsWith('http') ? site.url : `https://${site.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <div className="w-8 h-8 rounded-lg bg-black/45 border border-white/10 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={faviconSrc} 
                            alt={site.name} 
                            className="w-5 h-5 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-mono font-bold text-white group-hover:text-cyber-blue transition">{site.name}</div>
                          <div className="text-[9px] font-mono text-white/40 truncate">{site.url}</div>
                        </div>
                      </a>

                      <button
                        onClick={() => store.removeWebsite(site.id)}
                        className="text-red-400 hover:text-red-300 p-1 opacity-0 group-hover:opacity-100 transition duration-200 shrink-0 cursor-pointer"
                        title="Delete Launcher"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>        </div>
      </div>

      {/* Instant Task Modal */}
      <AnimatePresence>
        {isAddingInstantTask && (
          <>
            <div onClick={() => setIsAddingInstantTask(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel p-6 rounded-2xl z-50 border border-cyber-blue/30"
            >
              <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-4">
                <Sparkles className="w-5 h-5 text-cyber-blue animate-pulse" />
                <h3 className="text-sm font-geist font-bold text-white uppercase">Instant</h3>
              </div>
              
              <div className="space-y-4">
                {instantError && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl p-2.5 text-[10px] font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{instantError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1 uppercase tracking-wider">Task Name</label>
                  <input
                    type="text"
                    value={instantTitle}
                    onChange={(e) => setInstantTitle(e.target.value)}
                    placeholder="E.g., Review Chemistry Chapter 3"
                    className="w-full input-hud"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1.5 uppercase tracking-wider">Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInstantMode('task')}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-mono border transition cursor-pointer ${
                        instantMode === 'task'
                          ? 'bg-cyber-purple/20 border-cyber-purple text-white font-bold'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Task
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstantMode('session')}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-mono border transition cursor-pointer ${
                        instantMode === 'session'
                          ? 'bg-cyber-blue/20 border-cyber-blue text-white font-bold'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Session
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1 uppercase tracking-wider">Start Time</label>
                    <input
                      type="time"
                      value={instantStart}
                      onChange={(e) => setInstantStart(e.target.value)}
                      className="w-full input-hud text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1 uppercase tracking-wider">End Time</label>
                    <input
                      type="time"
                      value={instantEnd}
                      onChange={(e) => setInstantEnd(e.target.value)}
                      className="w-full input-hud text-center"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsAddingInstantTask(false)} 
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 text-xs font-mono transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleAddInstantTask} 
                    className="flex-1 btn-neon py-2 text-xs transition cursor-pointer"
                  >
                    Add Instant
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

