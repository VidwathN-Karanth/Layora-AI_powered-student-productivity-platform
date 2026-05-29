'use client';

import { useStore } from '@/store/useStore';
import { 
  BarChart3, Flame, Clock, CheckSquare, Sparkles, 
  TrendingUp, Calendar, AlertCircle, Compass 
} from 'lucide-react';

export default function AnalyticsPage() {
  const store = useStore();

  const user = store.user;
  const tasks = store.tasks;
  const subjects = store.subjects;

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.filter(t => t.status !== 'completed').length;

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-primary-fixed border border-primary flex items-center justify-center text-primary shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-outline">Total Focus Time</div>
            <div className="text-base font-mono font-bold">{user?.totalStudyHours || 0} Hours logged</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-secondary-fixed border border-secondary flex items-center justify-center text-secondary shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-outline">Milestones Completed</div>
            <div className="text-base font-mono font-bold">{completedCount} complete • {pendingCount} active</div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-pink-950/30 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Flame className="w-5 h-5 text-pink-500 animate-bounce" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-outline">Active Commitment Streak</div>
            <div className="text-base font-mono font-bold">{user?.streakCount || 0} Daily Cycles</div>
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
