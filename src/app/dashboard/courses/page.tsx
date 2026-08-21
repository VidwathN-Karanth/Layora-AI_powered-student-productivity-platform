'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { apiFetch, readJson, errorMessage } from '@/lib/apiClient';
import { clearNotificationMark } from '@/lib/notifications';
import { formatDate, toDateKey } from '@/lib/dateFormat';
import { 
  BookMarked, PlusCircle, Trash, Award, 
  BookOpen, Calendar, HelpCircle, GraduationCap, Clock, ExternalLink,
  Bell, Pencil, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlatformDisplay, formatCourseLink } from '@/lib/courseUtils';
import DateField from '@/components/DateField';

/** What the card shows when a course has no reminder time of its own. */
const DEFAULT_REMINDER_TIME = '09:00';

/**
 * Lets a course's reminder fire again today.
 *
 * Reminders are announced once a day. Changing the time is a statement that it
 * should happen at the *new* time, so the old day's mark has to go — otherwise
 * editing a reminder to five minutes from now would do nothing until tomorrow.
 */
function rearmReminder(courseId: string) {
  clearNotificationMark(`course-${courseId}`, toDateKey(new Date()));
}

export default function CoursesPage() {
  const store = useStore();

  const [showAddCourse, setShowAddCourse] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [progress, setProgress] = useState(0);
  const [goal, setGoal] = useState(2);
  const [deadline, setDeadline] = useState('2026-06-30');
  /** A sensible default when no reminder time is set yet: one minute from now. */
  const nextMinuteTime = () => {
    const next = new Date(Date.now() + 60_000);
    return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
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

  const isTimeInPast = (timeStr: string): boolean => {
    if (!timeStr) return true;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [hStr, mStr] = timeStr.split(':');
    const timeMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);

    return timeMins <= currentMins;
  };

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(() => {
    // One minute from now, rounded to nothing — any time is valid.
    const next = new Date(Date.now() + 60_000);
    return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
  });
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null);

  /** Pushes each reminder-enabled course into Google Calendar as a daily series. */
  const syncCoursesToGoogle = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const data = await readJson<{ syncedCount: number; skipped: number; skippedNames: string[] }>(
        await apiFetch('/api/calendar/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Google needs a zone for a recurring timed event, and the browser
            // is the only thing that knows where the student is.
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            courses: store.courses.map((c) => ({
              id: c.id,
              name: c.name,
              platform: c.platform,
              reminderEnabled: c.reminderEnabled,
              reminderTime: c.reminderTime || DEFAULT_REMINDER_TIME,
              deadline: c.deadline,
            })),
          }),
        })
      );

      const skippedNote = data.skippedNames?.length ? ` Skipped — ${data.skippedNames.join('; ')}.` : '';
      setSyncMessage({
        ok: data.syncedCount > 0,
        text: data.syncedCount > 0
          ? `Added a daily reminder for ${data.syncedCount} course${data.syncedCount === 1 ? '' : 's'} to your Google Calendar.${skippedNote}`
          : `Nothing was synced.${skippedNote || ' Turn on Daily Notification for a course first.'}`,
      });
      setTimeout(() => setSyncMessage(null), 9000);
    } catch (err) {
      setSyncMessage({ ok: false, text: errorMessage(err, 'Could not sync to Google Calendar.') });
    } finally {
      setSyncing(false);
    }
  };

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
    
    // If the saved time has already passed today, start from the next minute.
    const useDefaultFuture = !course.reminderTime || isTimeInPast(course.reminderTime);
    const initialTime = useDefaultFuture ? nextMinuteTime() : course.reminderTime;

    setEditReminderTime(initialTime);
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
      reminderTime: editReminderEnabled ? editReminderTime : undefined
    });
    // The new time applies today, not tomorrow.
    rearmReminder(editingCourseId);

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
      reminderTime: reminderEnabled ? reminderTime : undefined
    });

    setName('');
    setPlatform('');
    setProgress(0);
    setGoal(2);
    setReminderEnabled(false);
    setReminderTime(nextMinuteTime());
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
          <h2 className="text-xl font-bold tracking-wide">Active Courses</h2>
          <p className="text-xs text-outline mt-0.5">Manage external platforms, bootcamps, and certification milestones.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* A browser reminder only fires while Layora is open. Pushing the
              same reminder into Google Calendar as a real daily recurrence
              means the phone still buzzes with the site closed. */}
          <button
            onClick={syncCoursesToGoogle}
            disabled={syncing || !store.courses.some((c) => c.reminderEnabled)}
            title="Add a daily reminder for each course to your Google Calendar, repeating until its deadline"
            className="rounded-lg px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {syncing
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Syncing...</>
              : <><Calendar className="w-4 h-4" /> Sync reminders to Google Calendar</>}
          </button>

          <button
            onClick={() => {
              setFormErrors({});
              setShowAddCourse(true);
            }}
            className="bg-primary hover:brightness-110 text-black rounded-lg px-4 py-2.5 text-xs font-semibold flex items-center gap-2 active:scale-95 transition cursor-pointer shadow-lg"
          >
            <PlusCircle className="w-4 h-4" />
            Add Online Course
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-mono flex items-center gap-2 border ${
          syncMessage.ok
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-red-950/20 border-red-500/25 text-red-300'
        }`}>
          <Calendar className="w-3.5 h-3.5 shrink-0" /> {syncMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {store.courses.length === 0 ? (
          <div className="col-span-2 text-center py-20 border border-dashed border-outline-variant rounded-xl text-xs text-outline-variant">
            No courses logged yet. Add online bootcamps or course trackers.
          </div>
        ) : (
          store.courses.map((course) => (
            <div key={course.id} className="border border-white/10 bg-[#1A1D22]/40 rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary border border-white/10 flex items-center justify-center text-white shrink-0">
                      <GraduationCap className="w-5 h-5" strokeWidth={3} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-on-surface">{course.name}</h3>
                      <span className="text-xs text-outline truncate block max-w-[200px]" title={course.platform}>
                        {getPlatformDisplay(course.platform)}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleOpenEditModal(course)}
                    /* Solid, not a 20%-opacity ghost: a card action you cannot
                       see is a card action nobody uses. */
                    className="p-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary transition shrink-0 cursor-pointer"
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
                    className="w-full accent-purple-500 bg-transparent rounded-lg cursor-pointer h-1.5"
                    style={{
                      background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${course.progress}%, var(--color-surface-container-high) ${course.progress}%, var(--color-surface-container-high) 100%)`
                    }}
                  />
                </div>

                {/* Daily notification settings */}
                <div className="space-y-2 pt-3 border-t border-outline-variant/30">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-outline flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-primary" /> Daily Notification
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!course.reminderEnabled}
                      aria-label="Daily Notification"
                      data-on={course.reminderEnabled ? 'true' : 'false'}
                      onClick={() => {
                        store.updateCourse(course.id, {
                          reminderEnabled: !course.reminderEnabled,
                          // Without this the switch turned the reminder on but left
                          // reminderTime undefined, so it never fired — while the row
                          // below happily displayed the 09:00 fallback as if it were set.
                          reminderTime: course.reminderTime || DEFAULT_REMINDER_TIME,
                        });
                        rearmReminder(course.id);
                      }}
                      className={`layora-switch relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                        course.reminderEnabled ? 'bg-primary border-primary' : ''
                      }`}
                    >
                      <span
                        className={`layora-switch-knob h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200 ${
                          course.reminderEnabled ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  {course.reminderEnabled && (
                    <div className="flex items-center justify-between gap-2 bg-surface-container-low/50 p-2 rounded-xl border border-outline-variant/20">
                      <span className="text-[9px] font-mono text-outline">Reminder Time:</span>
                      <span className="text-[10px] text-primary font-mono font-bold px-2.5 py-1 bg-surface-container border border-outline-variant/30 rounded-lg select-none">
                        {formatTimeToAMPM(course.reminderTime || DEFAULT_REMINDER_TIME)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-outline-variant gap-4 mt-auto">
                <div className="flex flex-col gap-1 text-[10px] font-mono text-outline">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Target: {course.weeklyGoal}h/wk</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Due: {formatDate(course.deadline)}</span>
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
                  <label htmlFor="course-deadline" className="block text-[10px] font-mono text-outline mb-1">Deadline</label>
                  {/* Chrome renders <input type="date"> in the browser's own
                      locale whatever lang says, so this is a dd/mm/yyyy text
                      field with the native picker behind the calendar button. */}
                  <DateField id="course-deadline" value={deadline} onChange={setDeadline} />
                </div>

                {/* Daily notification fields */}
                <div className="bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-outline flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-primary" /> Daily Notification
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(e) => setReminderEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-outline after:border-outline-variant after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-on-primary"></div>
                    </label>
                  </div>
                  {reminderEnabled && (
                    <div className="flex flex-col gap-1.5 pt-1 border-t border-outline-variant/20">
                      <div className="flex justify-between items-center text-[10px] font-mono text-outline">
                        <span>Preferred Time:</span>
                        <span className="text-[9px] text-outline">Any time</span>
                      </div>
                      <input
                        type="time"
                        step="60"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 rounded-xl z-50 border border-white/10 bg-[#1A1D22]/95 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <h3 className="text-sm font-bold text-white border-b border-outline-variant pb-2 mb-4">Edit Course Settings</h3>
              
              <form onSubmit={handleSaveEditCourse} noValidate className="space-y-4">
                <div>
                  <label className="block text-xs text-outline mb-1">Course Title</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      setEditFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder="E.g., Next.js 15 Web Apps"
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                  {editFormErrors.name && <p className="text-red-500 text-xs mt-1">{editFormErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs text-outline mb-1">Course Link (URL)</label>
                  <input
                    type="text"
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    placeholder="E.g., https://coursera.org/learn/..."
                    className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Daily notification fields */}
                <div className="bg-surface-container-low/50 p-3 rounded-xl border border-outline-variant/30 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-outline flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-primary" /> Daily Notification
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editReminderEnabled}
                      aria-label="Daily Notification"
                      onClick={() => setEditReminderEnabled((v) => !v)}
                      data-on={editReminderEnabled ? 'true' : 'false'}
                      className={`layora-switch relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                        editReminderEnabled ? 'bg-primary border-primary' : ''
                      }`}
                    >
                      <span
                        className={`layora-switch-knob h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
                          editReminderEnabled ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {editReminderEnabled && (
                    <div className="space-y-3 pt-2 border-t border-outline-variant/20">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-xs text-outline">
                          <span>Reminder Time:</span>
                          <span className="text-[11px] text-outline">Any time</span>
                        </div>
                        <input
                          type="time"
                          step="60"
                          value={editReminderTime}
                          onChange={(e) => setEditReminderTime(e.target.value)}
                          className="bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary w-full text-center cursor-pointer"
                        />
                        <p className="text-[11px] text-outline-variant text-right mt-0.5">
                          Type a time, or pick one with the clock.
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
                        className="layora-danger-btn rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Trash className="w-3.5 h-3.5 shrink-0" /> Delete
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
