'use client';

import { useStore } from '@/store/useStore';
import { 
  BarChart3, Clock, CheckSquare, Sparkles, 
  TrendingUp, Calendar, AlertCircle, Compass,
  Award, BookOpen
} from 'lucide-react';

export default function AnalyticsPage() {
  const store = useStore();

  const user = store.user;
  const tasks = store.tasks;
  const subjects = store.subjects;

  const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Study hours per day (simulated for the visual bar chart)
  const dailyStudyHours = [
    { day: 'MON', hours: 2.5, percent: '50%' },
    { day: 'TUE', hours: 3.2, percent: '64%' },
    { day: 'WED', hours: 4.5, percent: '90%' },
    { day: 'THU', hours: 1.8, percent: '36%' },
    { day: 'FRI', hours: 3.0, percent: '60%' },
    { day: 'SAT', hours: 5.5, percent: '100%' },
    { day: 'SUN', hours: 2.0, percent: '40%' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-outline-variant pb-4">
        <h2 className="text-xl font-mono font-bold tracking-wide">Productivity Analytics</h2>
        <p className="text-xs text-outline font-mono mt-0.5">Visualize study hour distributions, active milestones, and AI recommendations.</p>
      </div>

      {/* Stats Blocks */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT COLUMNS: DAILY HOURS GRAPH --- */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-5 space-y-6">
            <div className="flex justify-between items-center border-b border-outline-variant pb-2">
              <h3 className="text-xs font-mono font-bold text-primary tracking-wider">Weekly Focus Density</h3>
              <span className="text-[9px] font-mono text-outline">HOURS / DAY</span>
            </div>

            {/* Vertical Bar Graph using pure Tailwind */}
            <div className="h-56 flex items-end justify-between pt-6 px-4">
              {dailyStudyHours.map((bar) => (
                <div key={bar.day} className="flex flex-col items-center gap-3 w-10 group">
                  <div className="text-[10px] font-mono text-secondary opacity-0 group-hover:opacity-100 transition duration-200">
                    {bar.hours}h
                  </div>
                  
                  {/* Glowing Bar Column */}
                  <div className="w-6 bg-surface-container border border-outline-variant rounded-t-lg relative h-full flex items-end">
                    <div 
                      className="w-full rounded-t-lg bg-gradient-to-t from-purple-600/80 to-cyan-400/80 group-hover:from-purple-500 group-hover:to-cyan-300 transition-all duration-500 shadow-lg shadow-purple-500/10"
                      style={{ height: bar.percent }}
                    ></div>
                  </div>
                  
                  <span className="text-[10px] font-mono text-outline font-bold">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: AI INSIGHTS --- */}
        <div className="space-y-6">
          <div className="glass-panel-neon rounded-2xl p-5 border border-primary space-y-4">
            <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-mono font-bold text-primary">Weekly AI Insights</h4>
            </div>

            <div className="space-y-4 text-xs font-mono text-on-surface leading-relaxed">
              <div className="flex gap-2 items-start">
                <TrendingUp className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                <p>
                  Study hours peaked on **Saturday** (5.5 hrs). This suggests a strong weekend concentration bias.
                </p>
              </div>

              <div className="flex gap-2 items-start">
                <Compass className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p>
                  Calc-MATH201 consumes **42%** of all focus blocks. Workload distribution conforms to credits.
                </p>
              </div>

              <div className="flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                <p>
                  Midweek dip noticed on **Thursday**. Consider scheduling an extra rest break on Wednesday nights to buffer focus levels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
