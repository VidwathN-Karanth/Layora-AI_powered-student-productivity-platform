'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { 
  Flame, BookOpen, Clock, CheckSquare, Globe, 
  ExternalLink, ChevronRight, Award, AlertCircle, Sparkles 
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardHome() {
  const store = useStore();

  const user = store.user;
  const subjects = store.subjects;
  const tasks = store.tasks;
  const courses = store.courses;
  const websites = store.websites;
  const timetable = store.timetable;

  const [aiRecs, setAiRecs] = useState<any>(null);
  const [loadingRecs, setLoadingRecs] = useState(true);

  useEffect(() => {
    async function fetchProactive() {
      try {
        const res = await fetch('/api/ai/proactive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentTasks: tasks.filter(t => t.status !== 'completed'),
            currentSubjects: subjects,
            currentRoutine: user ? {
              wakeTime: user.wakeTime,
              sleepTime: user.sleepTime,
              collegeTimings: { start: user.collegeStart, end: user.collegeEnd },
            } : {}
          })
        });
        if (res.ok) {
          const data = await res.json();
          setAiRecs(data);
        }
      } catch (err) {
        console.error('Failed to fetch AI recommendations', err);
      } finally {
        setLoadingRecs(false);
      }
    }
    
    // Only fetch if we have subjects and active tasks to save tokens
    if (subjects.length > 0) {
      fetchProactive();
    } else {
      setLoadingRecs(false);
    }
  }, [tasks.length, subjects.length]);

  // Simple statistics
  const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Find today's events from the weekly plan
  const todayNum = new Date().getDay(); // 0 = Sunday, 1 = Monday etc.
  const todaySchedule = timetable
    .filter((b) => b.day === todayNum)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-geist font-bold tracking-tight text-white">
            Welcome Back, <span className="text-cyber-blue text-glow-cyan">{user?.name || 'Student'}</span>
          </h2>
          <p className="text-xs text-white/50 font-mono mt-0.5 uppercase tracking-widest">Academic Cyber-pod Status: System Online</p>
        </div>

        {/* Streak counter with fire glow */}
        <div className="flex items-center gap-2.5 bg-gradient-to-r from-cyber-purple/20 to-cyber-blue/10 border border-cyber-purple/30 rounded-xl px-4 py-2 shadow-lg shadow-cyber-purple/20">
          <Flame className="w-5 h-5 text-cyber-purple animate-bounce" strokeWidth={1.5} />
          <div>
            <div className="text-xs font-mono font-bold leading-none text-white">{user?.streakCount || 0} DAYS</div>
            <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">Active Streak</span>
          </div>
        </div>
      </div>

      {/* --- STATS SUMMARY GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyber-blue shrink-0">
            <Clock className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Study Hours</div>
            <div className="text-lg font-mono font-bold text-white">{user?.totalStudyHours || 0} hrs</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyber-purple shrink-0">
            <CheckSquare className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Pending Tasks</div>
            <div className="text-lg font-mono font-bold text-white">{pendingTasks} active</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Award className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Completion Rate</div>
            <div className="text-lg font-mono font-bold text-white">{completionRate}%</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <BookOpen className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Total Subjects</div>
            <div className="text-lg font-mono font-bold text-white">{subjects.length} loaded</div>
          </div>
        </div>
      </div>

      {/* --- AI PROACTIVE ENGINE WIDGET --- */}
      <div className="glass-card rounded-2xl p-5 relative overflow-hidden bg-gradient-to-r from-black/40 to-cyber-blue/5 border border-cyber-blue/20">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-cyber-blue animate-pulse" strokeWidth={1.5} />
          <h3 className="text-sm font-geist font-bold text-cyber-blue uppercase text-glow-cyan">Proactive Academic Engine</h3>
        </div>
        
        {loadingRecs ? (
          <div className="flex items-center gap-3 text-white/50 font-mono text-xs">
            <span className="w-2 h-2 bg-cyber-blue rounded-full animate-ping"></span>
            Analyzing workload telemetry...
          </div>
        ) : aiRecs ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] font-mono text-white/50 uppercase">Next Best Task</span>
              <p className="font-bold text-white text-sm mt-1">{aiRecs.nextBestTask}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <span className="text-[10px] font-mono text-white/50 uppercase">Focus Priority</span>
              <p className="font-bold text-cyber-purple text-sm mt-1 text-glow-purple">{aiRecs.urgentSubject} ({aiRecs.recommendedDuration} mins)</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/30">
              <span className="text-[10px] font-mono text-amber-400 uppercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/> System Warning</span>
              <p className="font-semibold text-amber-100 text-xs mt-1 leading-tight">{aiRecs.workloadWarning}</p>
            </div>
          </div>
        ) : (
          <div className="text-xs text-white/50 font-mono">No telemetry data available. Load subjects to begin tracking.</div>
        )}
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
                  <div key={block.id} className={`flex items-center gap-4 p-3 rounded-xl bg-white/5 border-l-4 ${
                    block.type === 'study' ? 'border-cyber-blue' : 'border-cyber-purple'
                  }`}>
                    <div className="font-mono text-xs font-bold text-center w-20 text-white">
                      <div>{block.start}</div>
                      <div className="text-[10px] text-white/50 font-normal">{block.end}</div>
                    </div>
                    <div className="border-l border-white/10 pl-4 flex-1">
                      <div className="font-mono font-semibold text-xs text-white">{block.title}</div>
                      <p className="text-[10px] text-white/50 truncate font-sans mt-0.5">{block.details}</p>
                    </div>
                    {block.type === 'study' && (
                      <span className="text-[9px] font-mono bg-cyber-blue/10 text-cyber-blue px-2 py-0.5 rounded border border-cyber-blue/30 uppercase shrink-0">
                        Study Session
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: ACTIVE COURSES & QUICK ACCESS WEBSITES --- */}
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

          {/* Quick Access Launchers */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-geist font-bold tracking-wider text-cyber-blue border-b border-white/10 pb-2 uppercase text-glow-cyan">Quick Launchers</h3>
            
            <div className="grid grid-cols-2 gap-2">
              {websites.map((site) => (
                <a
                  key={site.id}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/5 hover:bg-cyber-blue/10 border border-white/10 hover:border-cyber-blue/50 rounded-xl p-3 flex flex-col justify-between h-20 transition group cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-cyber-blue group-hover:animate-pulse" strokeWidth={1.5} />
                  <div className="flex justify-between items-end mt-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-white group-hover:text-cyber-blue truncate max-w-[80px] block transition">{site.name}</span>
                      <span className="text-[9px] font-mono text-white/50">{site.timeSpentGoal} min goal</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-white/30 group-hover:text-white transition" strokeWidth={1.5} />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

