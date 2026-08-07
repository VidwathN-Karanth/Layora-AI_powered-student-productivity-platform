'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { 
  BookMarked, PlusCircle, Trash, Award, 
  BookOpen, Calendar, HelpCircle, GraduationCap, Clock, ExternalLink,
  Mail, Bell, Pencil
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
  // Helper to calculate the next 15-minute boundary
  const getNext15MinBoundary = () => {
    const now = new Date();
    let minutes = now.getMinutes();
    let hour = now.getHours();

    let nextMin = Math.ceil((minutes + 1) / 15) * 15;
    if (nextMin === 60) {
      nextMin = 0;
      hour = (hour + 1) % 24;
    }
    return `${String(hour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
  };

  const getNext15MinDisplay = () => {
    const timeStr = getNext15MinBoundary();
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    let displayHour = h % 12;
    if (displayHour === 0) displayHour = 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${mStr} ${ampm}`;
  };

  const roundToNearest15Minutes = (timeStr: string): string => {
    if (!timeStr) return '09:00';
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);

    const roundedM = Math.round(m / 15) * 15;
    if (roundedM === 60) {
      m = 0;
      h = (h + 1) % 24;
    } else {
      m = roundedM;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatTimeToAMPM = (timeStr: string) => {
    if (!timeStr) return '09:00 AM';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    let displayHour = h % 12;
    if (displayHour === 0) displayHour = 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${mStr} ${ampm}`;
  };

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(() => {
    const now = new Date();
    let minutes = now.getMinutes();
    let hour = now.getHours();
    let nextMin = Math.ceil((minutes + 1) / 15) * 15;
    if (nextMin === 60) {
      nextMin = 0;
      hour = (hour + 1) % 24;
    }
    return `${String(hour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
  });
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  // Edit course state
  const [showEditCourse, setShowEditCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlatform, setEditPlatform] = useState('');
  const [editReminderEnabled, setEditReminderEnabled] = useState(false);
  const [editReminderTime, setEditReminderTime] = useState('09:00');
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string | undefined>>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const handleOpenEditModal = (course: any) => {
    setEditingCourseId(course.id);
    setEditName(course.name);
    setEditPlatform(course.platform || '');
    setEditReminderEnabled(course.reminderEnabled || false);
    // Ensure we force round the initial time from DB to standard 15m intervals
    setEditReminderTime(course.reminderTime ? roundToNearest15Minutes(course.reminderTime) : getNext15MinBoundary());
    setEditFormErrors({});
    setDeleteConfirmation('');
    setShowEditCourse(true);
  };

  const handleSaveEditCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourseId) return;

    const errors: Record<string, string> = {};
    if (!editName.trim()) {
      errors.name = "This field cannot be empty";
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    const formattedLink = formatCourseLink(editPlatform) || 'Self-Study';

    store.updateCourse(editingCourseId, {
      name: editName,
      platform: formattedLink,
      reminderEnabled: editReminderEnabled,
      reminderTime: editReminderEnabled ? roundToNearest15Minutes(editReminderTime) : undefined
    });

    setShowEditCourse(false);
    setEditingCourseId(null);
  };

  const handleDeleteCourse = () => {
    if (!editingCourseId || deleteConfirmation !== 'Delete') return;
    store.removeCourse(editingCourseId);
    setShowEditCourse(false);
    setEditingCourseId(null);
    setDeleteConfirmation('');
  };

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
      deadline,
      reminderEnabled,
      reminderTime: reminderEnabled ? roundToNearest15Minutes(reminderTime) : undefined
    });

    setName('');
    setPlatform('');
    setProgress(0);
    setGoal(2);
    setReminderEnabled(false);
    setReminderTime(getNext15MinBoundary());
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
                    onClick={() => handleOpenEditModal(course)}
                    className="p-1 hover:bg-primary/20 text-on-surface/20 hover:text-primary rounded-lg transition shrink-0 cursor-pointer"
                    title="Edit course"
                  >
                    <Pencil className="w-3.5 h-3.5" />
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

                {/* Daily Email Reminder Settings */}
                <div className="space-y-2 pt-3 border-t border-outline-variant/30">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-outline flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-primary" /> Daily Email Reminder
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={course.reminderEnabled || false}
                        onChange={(e) => store.updateCourse(course.id, { reminderEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-outline after:border-outline-variant after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-blue-500 peer-checked:after:bg-on-primary"></div>
                    </label>
                  </div>
                  {course.reminderEnabled && (
                    <div className="flex items-center justify-between gap-2 bg-surface-container-low/50 p-2 rounded-xl border border-outline-variant/20">
                      <span className="text-[9px] font-mono text-outline">Reminder Time:</span>
                      <span className="text-[10px] text-primary font-mono font-bold px-2.5 py-1 bg-surface-container border border-outline-variant/30 rounded-lg select-none">
                        {formatTimeToAMPM(course.reminderTime || '09:00')}
                      </span>
                    </div>
                  )}
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

                {/* Daily Email Reminder Fields */}
                <div className="bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-outline flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-primary" /> Daily Email Reminder
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(e) => setReminderEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-outline after:border-outline-variant after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-blue-500 peer-checked:after:bg-on-primary"></div>
                    </label>
                  </div>
                  {reminderEnabled && (
                    <div className="flex flex-col gap-1.5 pt-1 border-t border-outline-variant/20">
                      <div className="flex justify-between items-center text-[10px] font-mono text-outline">
                        <span>Preferred Time (15m step):</span>
                        <span className="text-[9px] text-primary">Next 15m Mark: {getNext15MinDisplay()}</span>
                      </div>
                      <input
                        type="time"
                        step="900"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(roundToNearest15Minutes(e.target.value))}
                        onBlur={(e) => setReminderTime(roundToNearest15Minutes(e.target.value))}
                        className="bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1 text-xs text-on-surface font-mono focus:outline-none focus:border-primary w-full text-center cursor-pointer"
                      />
                    </div>
                  )}
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

      {/* Edit Course Modal */}
      <AnimatePresence>
        {showEditCourse && (
          <>
            <div onClick={() => { setShowEditCourse(false); setEditingCourseId(null); }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel-neon p-6 rounded-2xl z-50 border border-primary overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-sm font-mono font-bold text-primary border-b border-outline-variant pb-2 mb-4">Edit Course Settings</h3>
              
              <form onSubmit={handleSaveEditCourse} noValidate className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Course Title</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      setEditFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder="E.g., Next.js 15 Web Apps"
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                  {editFormErrors.name && <p className="text-red-500 text-[10px] font-mono mt-1">{editFormErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Course Link (URL)</label>
                  <input
                    type="text"
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    placeholder="E.g., https://coursera.org/learn/..."
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                {/* Daily Email Reminder Fields */}
                <div className="bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-outline flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-primary" /> Daily Email Reminder
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editReminderEnabled}
                        onChange={(e) => setEditReminderEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-outline after:border-outline-variant after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-blue-500 peer-checked:after:bg-on-primary"></div>
                    </label>
                  </div>
                  
                  {editReminderEnabled && (
                    <div className="space-y-3 pt-2 border-t border-outline-variant/20">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-mono text-outline">
                          <span>Reminder Time (15m step):</span>
                          <span className="text-[9px] text-primary">Next 15m Mark: {getNext15MinDisplay()}</span>
                        </div>
                        <input
                          type="time"
                          step="900"
                          value={editReminderTime}
                          onChange={(e) => setEditReminderTime(roundToNearest15Minutes(e.target.value))}
                          onBlur={(e) => setEditReminderTime(roundToNearest15Minutes(e.target.value))}
                          className="bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary w-full text-center cursor-pointer"
                        />
                        <p className="text-[8px] font-mono text-outline-variant text-right mt-0.5">
                          Time will snap to the nearest 15-minute interval.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => { setShowEditCourse(false); setEditingCourseId(null); }} 
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg py-2 text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-container rounded-lg py-2 text-xs font-mono font-bold cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>

                {/* Danger Zone: Delete Course */}
                <div className="border-t border-outline-variant/30 pt-4 mt-6">
                  <div className="bg-red-950/10 border border-red-500/20 rounded-xl p-3 flex flex-col gap-2">
                    <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-bold">Danger Zone</span>
                    <p className="text-[9px] font-mono text-red-300/80 leading-normal">
                      To delete this course, type <strong className="text-red-400 font-bold">Delete</strong> below and click the delete button.
                    </p>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="Type 'Delete'"
                        className="flex-1 bg-red-950/20 border border-red-500/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface placeholder:text-red-300/30 focus:outline-none focus:border-red-500 font-mono"
                      />
                      <button
                        type="button"
                        disabled={deleteConfirmation !== 'Delete'}
                        onClick={handleDeleteCourse}
                        className="bg-red-600 hover:bg-red-700 text-white disabled:bg-red-950/40 disabled:text-red-300/50 disabled:border-red-500/10 border border-red-500/30 hover:border-red-500 rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
