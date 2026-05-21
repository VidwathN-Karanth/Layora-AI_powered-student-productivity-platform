'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { 
  BookMarked, PlusCircle, Trash, Award, 
  BookOpen, Calendar, HelpCircle, GraduationCap, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CoursesPage() {
  const store = useStore();

  const [showAddCourse, setShowAddCourse] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [progress, setProgress] = useState(0);
  const [goal, setGoal] = useState(2);
  const [deadline, setDeadline] = useState('2026-06-30');

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    store.addCourse({
      name,
      platform: platform || 'Self-Study',
      progress,
      weeklyGoal: goal,
      deadline
    });

    setName('');
    setPlatform('');
    setProgress(0);
    setGoal(2);
    setShowAddCourse(false);
  };

  const handleProgressChange = (id: string, val: number) => {
    store.updateCourseProgress(id, val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">ACTIVE_COURSES</h2>
          <p className="text-xs text-white/40 font-mono mt-0.5">Manage external platforms, bootcamps, and certification milestones.</p>
        </div>

        <button
          onClick={() => setShowAddCourse(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white rounded-xl px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/10"
        >
          <PlusCircle className="w-4 h-4" />
          ADD_ONLINE_COURSE
        </button>
      </div>

      {/* Courses Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {store.courses.length === 0 ? (
          <div className="col-span-2 text-center py-20 border border-dashed border-white/5 rounded-2xl font-mono text-xs text-white/30">
            No courses logged yet. Add online bootcamps or course trackers.
          </div>
        ) : (
          store.courses.map((course) => (
            <div key={course.id} className="glass-card rounded-2xl p-5 border border-white/5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-sm text-white">{course.name}</h3>
                    <span className="text-[10px] font-mono text-white/40">{course.platform}</span>
                  </div>
                </div>

                <button 
                  onClick={() => store.removeCourse(course.id)}
                  className="p-1 hover:bg-red-950/40 text-white/20 hover:text-red-400 rounded-lg transition"
                  title="Remove course"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Slider Controller */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[10px] font-mono text-white/50">
                  <span>PROGRESS_METER</span>
                  <span className="text-cyan-400 font-bold">{course.progress}%</span>
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={course.progress}
                  onChange={(e) => handleProgressChange(course.id, parseInt(e.target.value))}
                  className="w-full accent-purple-500 bg-white/10 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-white/40 pt-2 border-t border-white/5">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Target: {course.weeklyGoal}h/wk</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Due: {course.deadline}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Course Modal */}
      <AnimatePresence>
        {showAddCourse && (
          <>
            <div onClick={() => setShowAddCourse(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel-neon p-6 rounded-2xl z-50 border border-purple-500/20"
            >
              <h3 className="text-sm font-mono font-bold text-purple-300 border-b border-white/5 pb-2 mb-4">LOG_ONLINE_COURSE</h3>
              
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">COURSE_TITLE</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Next.js 15 Web Apps"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">PLATFORM_OR_ACADEMY</label>
                  <input
                    type="text"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    placeholder="E.g., Coursera, Udemy, YouTube"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">INITIAL_PROGRESS %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={progress}
                      onChange={(e) => setProgress(parseInt(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">WEEKLY_GOAL (HRS)</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={goal}
                      onChange={(e) => setGoal(parseInt(e.target.value) || 2)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">DEADLINE</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddCourse(false)} 
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 text-xs font-mono cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-500 rounded-lg py-2 text-xs font-mono font-bold cursor-pointer"
                  >
                    LOG_COURSE
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
