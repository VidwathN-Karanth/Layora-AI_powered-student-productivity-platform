'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { 
  BookMarked, PlusCircle, Trash, Award, 
  BookOpen, Calendar, HelpCircle, GraduationCap, Clock, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlatformDisplay, formatCourseLink } from '@/lib/courseUtils';

export default function CoursesPage() {
  const store = useStore();

  const [showAddCourse, setShowAddCourse] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [progress, setProgress] = useState(0);
  const [goal, setGoal] = useState(2);
  const [deadline, setDeadline] = useState('2026-06-30');
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = "This field cannot be empty";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const formattedLink = formatCourseLink(platform) || 'Self-Study';

    store.addCourse({
      name,
      platform: formattedLink,
      progress,
      weeklyGoal: goal,
      deadline
    });

    setName('');
    setPlatform('');
    setProgress(0);
    setGoal(2);
    setFormErrors({});
    setShowAddCourse(false);
  };

  const handleProgressChange = (id: string, val: number) => {
    store.updateCourseProgress(id, val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">Active Courses</h2>
          <p className="text-xs text-outline font-mono mt-0.5">Manage external platforms, bootcamps, and certification milestones.</p>
        </div>

        <button
          onClick={() => {
            setFormErrors({});
            setShowAddCourse(true);
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-on-surface rounded-xl px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/10"
        >
          <PlusCircle className="w-4 h-4" />
          Add Online Course
        </button>
      </div>

      {/* Courses Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {store.courses.length === 0 ? (
          <div className="col-span-2 text-center py-20 border border-dashed border-outline-variant rounded-2xl font-mono text-xs text-outline-variant">
            No courses logged yet. Add online bootcamps or course trackers.
          </div>
        ) : (
          store.courses.map((course) => (
            <div key={course.id} className="glass-card rounded-2xl p-5 border border-outline-variant space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed border border-primary flex items-center justify-center text-primary shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-sm text-on-surface">{course.name}</h3>
                      <span className="text-[10px] font-mono text-outline truncate block max-w-[200px]" title={course.platform}>
                        {getPlatformDisplay(course.platform)}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => store.removeCourse(course.id)}
                    className="p-1 hover:bg-red-950/40 text-on-surface/20 hover:text-red-400 rounded-lg transition shrink-0"
                    title="Remove course"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Slider Controller */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] font-mono text-outline">
                    <span>Progress Meter</span>
                    <span className="text-secondary font-bold">{course.progress}%</span>
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={course.progress}
                    onChange={(e) => handleProgressChange(course.id, parseInt(e.target.value))}
                    className="w-full accent-purple-500 bg-surface-container-high rounded-lg cursor-pointer h-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-outline-variant gap-4 mt-auto">
                <div className="flex flex-col gap-1 text-[10px] font-mono text-outline">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Target: {course.weeklyGoal}h/wk</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Due: {course.deadline}</span>
                </div>

                {course.platform && course.platform.startsWith('http') && (
                  <a
                    href={course.platform}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary text-primary px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm shrink-0"
                  >
                    Continue Course <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Course Modal */}
      <AnimatePresence>
        {showAddCourse && (
          <>
            <div onClick={() => setShowAddCourse(false)} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel-neon p-6 rounded-2xl z-50 border border-primary"
            >
              <h3 className="text-sm font-mono font-bold text-primary border-b border-outline-variant pb-2 mb-4">Log Online Course</h3>
              
              <form onSubmit={handleCreateCourse} noValidate className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Course Title</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder="E.g., Next.js 15 Web Apps"
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                  />
                  {formErrors.name && <p className="text-red-500 text-[10px] font-mono mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Course Link (URL)</label>
                  <input
                    type="text"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    placeholder="E.g., https://coursera.org/learn/..."
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-outline mb-1">Initial Progress %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={progress}
                      onChange={(e) => setProgress(parseInt(e.target.value) || 0)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1 text-xs text-on-surface text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-outline mb-1">Weekly Goal (Hours)</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={goal}
                      onChange={(e) => setGoal(parseInt(e.target.value) || 2)}
                      className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1 text-xs text-on-surface text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddCourse(false)} 
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg py-2 text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-container rounded-lg py-2 text-xs font-mono font-bold cursor-pointer"
                  >
                    Log Course
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
