'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { TimetableBlock } from '@/lib/scheduler';
import { apiFetch } from '@/lib/apiClient';
import { 
  CalendarRange, Sparkles, CalendarDays, Plus, Trash, 
  RefreshCw, Check, ArrowRight, Play, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTimeStr } from '@/lib/timeUtils';

export default function PlannerPage() {
  const store = useStore();

  const [mounted, setMounted] = useState(false);
  const [activeDay, setActiveDay] = useState(1); // 1 = Monday by default

  useEffect(() => {
    setMounted(true);
    setActiveDay(new Date().getDay());
  }, []);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  
  // Delete Schedule confirmation states
  const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
  const [deleteDayInput, setDeleteDayInput] = useState('');
  const [deletingDay, setDeletingDay] = useState(false);

  const [showDeleteWeekConfirm, setShowDeleteWeekConfirm] = useState(false);
  const [deleteWeekInput, setDeleteWeekInput] = useState('');
  const [deletingWeek, setDeletingWeek] = useState(false);
  
  // Custom manual block states
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockStart, setNewBlockStart] = useState('17:00');
  const [newBlockEnd, setNewBlockEnd] = useState('18:00');
  const [newBlockType, setNewBlockType] = useState<'class' | 'study' | 'extracurricular' | 'break'>('study');

  const daysOfWeek = [
    { num: 1, label: 'MON' },
    { num: 2, label: 'TUE' },
    { num: 3, label: 'WED' },
    { num: 4, label: 'THU' },
    { num: 5, label: 'FRI' },
    { num: 6, label: 'SAT' },
    { num: 0, label: 'SUN' }
  ];

  // Get current blocks for active day
  const activeDayBlocks = store.timetable
    .filter((b) => b.day === activeDay)
    .sort((a, b) => a.start.localeCompare(b.start));

  const handleDeleteDaySchedule = async () => {
    try {
      setDeletingDay(true);
      const res = await apiFetch('/api/calendar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'day', day: activeDay })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete day schedule.');
      }

      const data = await res.json();
      alert(`Wiped ${data.deletedCount} Layora events for this day from Google Calendar.`);
      setShowDeleteDayConfirm(false);
      setDeleteDayInput('');
    } catch (e: any) {
      alert(`Delete Day Error: ${e.message}`);
    } finally {
      setDeletingDay(false);
    }
  };

  const handleDeleteWeekSchedule = async () => {
    try {
      setDeletingWeek(true);
      const res = await apiFetch('/api/calendar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'week' })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete week schedule.');
      }

      const data = await res.json();
      alert(`Wiped ${data.deletedCount} Layora events for the entire week from Google Calendar.`);
      setShowDeleteWeekConfirm(false);
      setDeleteWeekInput('');
    } catch (e: any) {
      alert(`Delete Week Error: ${e.message}`);
    } finally {
      setDeletingWeek(false);
    }
  };

  const handleGoogleSync = async () => {
    try {
      setSyncingCalendar(true);
      setSyncSuccess(false);

      const res = await apiFetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timetable: store.timetable })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to sync schedule. Please verify your Google account permissions.');
      }

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 6000);
    } catch (e: any) {
      alert(`Sync Error: ${e.message}`);
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleAddCustomBlock = () => {
    if (!newBlockTitle) return;

    const colors = {
      class: 'border-l-4 border-secondary bg-secondary-fixed text-on-surface',
      study: 'border-l-4 border-primary bg-primary-fixed text-on-surface',
      extracurricular: 'border-l-4 border-pink-500 bg-pink-950/20 text-pink-200',
      break: 'border-l-4 border-emerald-500 bg-emerald-950/20 text-emerald-200',
    };

    const customBlock: TimetableBlock = {
      id: `custom-block-${Date.now()}`,
      day: activeDay,
      start: newBlockStart,
      end: newBlockEnd,
      title: newBlockTitle,
      type: newBlockType,
      color: colors[newBlockType],
      details: 'Manually logged custom block'
    };

    store.setTimetable([...store.timetable, customBlock]);
    setNewBlockTitle('');
    setShowAddBlock(false);
  };

  const handleDeleteBlock = (id: string) => {
    store.setTimetable(store.timetable.filter((b) => b.id !== id));
  };

  // Simple drag rearrangement simulation
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const blocks = [...activeDayBlocks];
    // swap timing fields slightly to re-sort
    const temp = blocks[index].start;
    blocks[index].start = blocks[index - 1].start;
    blocks[index - 1].start = temp;

    // update state
    store.setTimetable([
      ...store.timetable.filter((b) => b.day !== activeDay),
      ...blocks
    ]);
  };

  const handleMoveDown = (index: number) => {
    if (index === activeDayBlocks.length - 1) return;
    const blocks = [...activeDayBlocks];
    const temp = blocks[index].start;
    blocks[index].start = blocks[index + 1].start;
    blocks[index + 1].start = temp;

    store.setTimetable([
      ...store.timetable.filter((b) => b.day !== activeDay),
      ...blocks
    ]);
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20 font-mono text-xs text-white/50">
        Loading planner telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Weekly Planner</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Button */}
          <button
            onClick={handleGoogleSync}
            disabled={syncingCalendar || store.timetable.length === 0}
            className="disabled:opacity-40 rounded-lg px-4 py-2.5 text-xs font-semibold flex items-center gap-2 active:scale-95 transition cursor-pointer"
            style={{ backgroundColor: '#d4a76a', color: '#ffffff', border: '1px solid #c4975a' }}
          >
            {syncingCalendar ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" strokeWidth={1.5} />
                Syncing Calendar...
              </>
            ) : (
              <>
                <CalendarRange className="w-4 h-4 text-white" strokeWidth={1.5} />
                Sync to Google Calendar
              </>
            )}
          </button>

          {/* Delete Week Sync Button */}
          <button
            onClick={() => setShowDeleteWeekConfirm(true)}
            className="border border-red-500/20 bg-red-950/10 hover:bg-red-950/20 text-red-400 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <Trash className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            Wipe Week from Google Calendar
          </button>
        </div>
      </div>

      {/* Sync Success Dialog */}
      <AnimatePresence>
        {syncSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-lg text-xs flex items-center gap-2"
          >
            <Check className="w-4 h-4" strokeWidth={1.5} />
            SUCCESS: Exported {store.timetable.length} schedule events & deadlines directly to Google Calendar account!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-outline-variant pb-2">
        {daysOfWeek.map((day) => (
          <button
            key={day.num}
            onClick={() => setActiveDay(day.num)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all relative cursor-pointer ${
              activeDay === day.num ? 'bg-primary text-black' : 'bg-surface-container text-outline hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            {day.label}
            {activeDay === day.num && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {/* Timetable Blocks Listing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timetable schedule grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex justify-between items-center bg-white/2 p-3 rounded-lg border border-outline-variant">
            <span className="text-xs text-outline">Sequence Timeline ({activeDayBlocks.length} Blocks)</span>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowAddBlock(true)} 
                className="text-primary hover:underline text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Add Custom Block
              </button>
              <button 
                onClick={() => setShowDeleteDayConfirm(true)} 
                className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1.5 cursor-pointer border-l border-white/10 pl-4"
              >
                <Trash className="w-3.5 h-3.5" strokeWidth={1.5} /> Clear Day from Google Calendar
              </button>
            </div>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {store.timetable.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-outline-variant rounded-xl p-6">
                <AlertCircle className="w-10 h-10 text-on-surface/20 mb-3" strokeWidth={1.5} />
                <h3 className="text-sm font-bold text-on-surface/70">Planner is empty</h3>
                <p className="text-xs text-outline max-w-sm mt-1">
                  Click the **Add Custom Block** link to build your weekly schedule and push it to Google Calendar.
                </p>
              </div>
            ) : activeDayBlocks.length === 0 ? (
              <div className="text-center text-xs text-outline-variant py-20 font-mono">
                No blocks logged for this day.
              </div>
            ) : (
              activeDayBlocks.map((block, index) => (
                <div 
                  key={block.id} 
                  className={`flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl ${block.color} border-l-4 relative group`}
                >
                  {/* Time columns */}
                  <div className="text-center w-16 sm:w-20 shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-on-surface">{formatTimeStr(block.start, store.is24HourFormat)}</span>
                    <span className="text-xs text-outline block leading-tight">{formatTimeStr(block.end, store.is24HourFormat)}</span>
                  </div>

                  <div className="border-l border-outline-variant pl-3 sm:pl-4 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-on-surface truncate">{block.title}</span>
                      {block.subjectCode && (
                        <span className="text-xs bg-surface-container border border-outline-variant px-1.5 py-0.5 rounded text-on-surface-variant">
                          {block.subjectCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-outline leading-relaxed font-sans mt-0.5 truncate">{block.details}</p>
                  </div>

                  {/* Drag re-arrange arrows and delete button */}
                  <div className="flex items-center gap-1.5 sm:gap-2 border-l border-outline-variant pl-2 sm:pl-3 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => handleMoveUp(index)} className="p-0.5 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition text-[10px]">
                        ▲
                      </button>
                      <button onClick={() => handleMoveDown(index)} className="p-0.5 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition text-[10px]">
                        ▼
                      </button>
                    </div>

                    <button 
                      onClick={() => handleDeleteBlock(block.id)}
                      className="p-1 hover:bg-red-950/40 text-outline-variant hover:text-red-400 rounded transition"
                      title="Delete block"
                    >
                      <Trash className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info panel / instructions */}
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-primary border-b border-outline-variant pb-2 uppercase">Planning Guide</h4>
            
            <ul className="space-y-3 text-xs font-sans text-on-surface/70">
              {store.planningGuideInsights && store.planningGuideInsights.length > 0 ? (
                store.planningGuideInsights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary font-mono font-bold">{(idx + 1).toString().padStart(2, '0')}.</span>
                    <span>{insight}</span>
                  </li>
                ))
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-mono font-bold">01.</span>
                    <span>Formulate study routines, college lectures, and gym breaks on your timeline.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-mono font-bold">02.</span>
                    <span>Sync to Google Calendar exports study slots so you receive mobile calendar push notifications.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-mono font-bold">03.</span>
                    <span>Wipe day schedules or the entire week sync directly if you need to reorganize your calendar.</span>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Add custom block Modal */}
      <AnimatePresence>
        {showAddBlock && (
          <>
            <div onClick={() => setShowAddBlock(false)} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 rounded-xl z-50 border border-white/10 bg-[#1A1D22]/95 shadow-2xl"
            >
              <h3 className="text-sm font-bold text-white border-b border-outline-variant pb-2 mb-4">Add Custom Timetable Block</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-outline mb-1">Block Title</label>
                  <input
                    type="text"
                    value={newBlockTitle}
                    onChange={(e) => setNewBlockTitle(e.target.value)}
                    placeholder="E.g., Self-Study Mathematics"
                    className="w-full input-hud"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-outline mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newBlockStart}
                      onChange={(e) => setNewBlockStart(e.target.value)}
                      className="w-full input-hud"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-outline mb-1">End Time</label>
                    <input
                      type="time"
                      value={newBlockEnd}
                      onChange={(e) => setNewBlockEnd(e.target.value)}
                      className="w-full input-hud"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-outline mb-1">Block Type</label>
                  <select
                    value={newBlockType}
                    onChange={(e) => setNewBlockType(e.target.value as any)}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface"
                  >
                    <option value="class">Class Lecture (Cyan)</option>
                    <option value="study">Study Session (Purple)</option>
                    <option value="extracurricular">Extracurricular (Pink)</option>
                    <option value="break">Rest Break (Emerald)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setShowAddBlock(false)} 
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg py-2 text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddCustomBlock} 
                    className="flex-1 btn-neon py-2 text-xs cursor-pointer"
                  >
                    Insert
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Day Confirmation Modal */}
      <AnimatePresence>
        {showDeleteDayConfirm && (
          <>
            <div onClick={() => { setShowDeleteDayConfirm(false); setDeleteDayInput(''); }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 rounded-xl z-50 border border-red-500/50 bg-[#1A1D22]/95 shadow-2xl"
            >
              <h3 className="text-sm font-bold text-red-400 border-b border-red-500/20 pb-2 mb-4 uppercase tracking-wide flex items-center gap-2">
                <Trash className="w-4 h-4" /> Wipe Day Schedule
              </h3>
              
              <div className="space-y-4">
                <p className="text-xs text-outline leading-relaxed">
                  This will remove all Layora-synced calendar events for <strong>{daysOfWeek.find(d => d.num === activeDay)?.label || ''}</strong> from your primary Google Calendar.
                </p>
                <div className="bg-red-950/15 border border-red-500/10 p-3 rounded-lg text-xs text-red-300">
                  Type <strong>DELETE</strong> below to confirm.
                </div>
                
                <div>
                  <input
                    type="text"
                    value={deleteDayInput}
                    onChange={(e) => setDeleteDayInput(e.target.value)}
                    placeholder="DELETE"
                    className="w-full input-hud text-center tracking-wider border-red-500/20 focus:border-red-500 uppercase"
                  />
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button 
                    onClick={() => { setShowDeleteDayConfirm(false); setDeleteDayInput(''); }} 
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg py-2 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteDaySchedule} 
                    disabled={deleteDayInput !== 'DELETE' || deletingDay}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-lg py-2 text-xs font-bold cursor-pointer transition active:scale-95 animate-none"
                  >
                    {deletingDay ? 'Deleting...' : 'Wipe Day'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Week Confirmation Modal */}
      <AnimatePresence>
        {showDeleteWeekConfirm && (
          <>
            <div onClick={() => { setShowDeleteWeekConfirm(false); setDeleteWeekInput(''); }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 rounded-xl z-50 border border-red-500/50 bg-[#1A1D22]/95 shadow-2xl"
            >
              <h3 className="text-sm font-bold text-red-400 border-b border-red-500/20 pb-2 mb-4 uppercase tracking-wide flex items-center gap-2">
                <Trash className="w-4 h-4" /> Wipe Week Sync
              </h3>
              
              <div className="space-y-4">
                <p className="text-xs text-outline leading-relaxed font-mono">
                  This will remove all Layora-synced calendar events for the <strong>entire week</strong> from your primary Google Calendar.
                </p>
                <div className="bg-red-950/15 border border-red-500/10 p-3 rounded-xl text-[10px] text-red-300 font-mono">
                  Type <strong>DELETE WEEK PLANNER</strong> below to confirm.
                </div>
                
                <div>
                  <input
                    type="text"
                    value={deleteWeekInput}
                    onChange={(e) => setDeleteWeekInput(e.target.value)}
                    placeholder="DELETE WEEK PLANNER"
                    className="w-full input-hud text-center tracking-wider border-red-500/20 focus:border-red-500 uppercase"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button 
                    onClick={() => { setShowDeleteWeekConfirm(false); setDeleteWeekInput(''); }} 
                    className="flex-1 bg-surface-container border border-outline-variant rounded-lg py-2 text-xs font-mono cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteWeekSchedule} 
                    disabled={deleteWeekInput !== 'DELETE WEEK PLANNER' || deletingWeek}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-lg py-2 text-xs font-mono font-bold cursor-pointer transition active:scale-95 animate-none"
                  >
                    {deletingWeek ? 'Deleting...' : 'Wipe Week'}
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


