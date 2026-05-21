'use client';

import { useStore } from '@/store/useStore';
import { motion } from 'framer-motion';
import { 
  Flame, BookOpen, Clock, CheckSquare, Sparkles, Globe, 
  ExternalLink, ChevronRight, Award, AlertCircle 
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

  // Simple statistics
  const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Find today's events from the weekly plan
  const todayNum = new Date().getDay(); // 0 = Sunday, 1 = Monday etc.
  const todaySchedule = timetable
    .filter((b) => b.day === todayNum)
    .sort((a, b) => a.start.localeCompare(b.start));

  // Custom AI recommendations
  const getAIRecommendations = () => {
    if (pendingTasks > 3) {
      return {
        title: 'Task Overload Detected',
        body: 'You currently have several pending tasks. Focus on completing "MATH201 Integration Sheet" first, as it has high priority credits. Avoid taking new courses this week.',
        type: 'warning'
      };
    }
    return {
      title: 'Optimal Balance Achieved',
      body: 'Your weekly load is perfectly proportioned. Your daily streak is active! Maintain this schedule to solidify memory retention.',
      type: 'success'
    };
  };
  const recommendation = getAIRecommendations();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">
            Welcome Back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">{user?.name || 'Student'}</span>
          </h2>
          <p className="text-xs text-white/40 font-mono mt-0.5">Academic Cyber-pod Status: System Online</p>
        </div>

        {/* Streak counter with fire glow */}
        <div className="flex items-center gap-2.5 bg-gradient-to-r from-purple-950/40 to-pink-950/20 border border-pink-500/30 rounded-xl px-4 py-2 shadow-lg shadow-pink-500/5">
          <Flame className="w-5 h-5 text-pink-500 animate-bounce" />
          <div>
            <div className="text-xs font-mono font-bold leading-none">{user?.streakCount || 0} DAYS</div>
            <span className="text-[9px] font-mono text-pink-400 uppercase tracking-widest">Active Streak</span>
          </div>
        </div>
      </div>

      {/* --- STATS SUMMARY GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Study Hours</div>
            <div className="text-lg font-mono font-bold">{user?.totalStudyHours || 0} hrs</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Pending Tasks</div>
            <div className="text-lg font-mono font-bold">{pendingTasks} active</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Completion Rate</div>
            <div className="text-lg font-mono font-bold">{completionRate}%</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-pink-950/30 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono text-white/50">Total Subjects</div>
            <div className="text-lg font-mono font-bold">{subjects.length} loaded</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT COLUMNS: DAILY AGENDA & RECOMMENDATIONS --- */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Recommendation banner */}
          <div className="glass-panel-neon rounded-2xl p-5 border border-purple-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Sparkles className="w-24 h-24 text-purple-400" />
            </div>
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-purple-950/40 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                <Sparkles className="w-4 h-4 animate-spin-slow" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-mono font-black text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
                  AI Recommendation: {recommendation.title}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed font-sans mt-1">
                  {recommendation.body}
                </p>
              </div>
            </div>
          </div>

          {/* Daily Schedule Timeline */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-xs font-mono font-bold tracking-wider text-purple-400">Daily Schedule</h3>
              <Link href="/dashboard/planner" className="text-[10px] font-mono text-cyan-400 hover:underline flex items-center gap-1">
                Full Planner <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {todaySchedule.length === 0 ? (
                <div className="text-center font-mono text-xs text-white/30 py-8 border border-dashed border-white/5 rounded-xl">
                  No academic blocks scheduled for today. Rest cycle active.
                </div>
              ) : (
                todaySchedule.map((block) => (
                  <div key={block.id} className={`flex items-center gap-4 p-3 rounded-xl ${block.color} border-l-4`}>
                    <div className="font-mono text-xs font-bold text-center w-20">
                      <div>{block.start}</div>
                      <div className="text-[10px] text-white/40 font-normal">{block.end}</div>
                    </div>
                    <div className="border-l border-white/10 pl-4 flex-1">
                      <div className="font-mono font-semibold text-xs text-white">{block.title}</div>
                      <p className="text-[10px] text-white/50 truncate font-sans mt-0.5">{block.details}</p>
                    </div>
                    {block.type === 'study' && (
                      <span className="text-[9px] font-mono bg-purple-950/40 text-purple-300 px-2 py-0.5 rounded border border-purple-800/30 uppercase shrink-0">
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
            <h3 className="text-xs font-mono font-bold tracking-wider text-purple-400 border-b border-white/5 pb-2">Active Courses</h3>
            
            <div className="space-y-4">
              {courses.length === 0 ? (
                <p className="text-xs text-white/30 font-mono text-center py-6">No online courses logged</p>
              ) : (
                courses.map((course) => (
                  <div key={course.id} className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-mono font-bold text-white/95 leading-tight">{course.name}</div>
                        <span className="text-[9px] font-mono text-white/40">{course.platform}</span>
                      </div>
                      <span className="text-xs font-mono font-black text-cyan-400">{course.progress}%</span>
                    </div>
                    
                    {/* Progress Slider */}
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full transition-all duration-300"
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
            <h3 className="text-xs font-mono font-bold tracking-wider text-purple-400 border-b border-white/5 pb-2">Quick Launchers</h3>
            
            <div className="grid grid-cols-2 gap-2">
              {websites.map((site) => (
                <a
                  key={site.id}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/5 hover:bg-purple-950/20 border border-white/5 hover:border-purple-500/30 rounded-xl p-3 flex flex-col justify-between h-20 transition group cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-purple-400 group-hover:animate-pulse" />
                  <div className="flex justify-between items-end mt-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-white group-hover:text-purple-300 truncate max-w-[80px] block">{site.name}</span>
                      <span className="text-[9px] font-mono text-white/40">{site.timeSpentGoal} min goal</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-white/30 group-hover:text-white transition" />
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
