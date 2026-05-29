'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { generateAISchedule, TimetableBlock } from '@/lib/aiService';
import { 
  CalendarRange, Sparkles, CalendarDays, Plus, Trash, 
  RefreshCw, Check, ArrowRight, Play, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PlannerPage() {
  const store = useStore();

  const [activeDay, setActiveDay] = useState(1); // 1 = Monday by default
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  
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

  const handleGenerateAI = async () => {
    setLoadingSchedule(true);
    
    // Setup routine config
    const routine = {
      wakeTime: store.user?.wakeTime || '06:00',
      sleepTime: store.user?.sleepTime || '22:00',
      collegeTimings: {
        start: store.user?.collegeStart || '09:00',
        end: store.user?.collegeEnd || '16:00'
      },
      freeBlocks: store.user?.freeBlocks || []
    };

    const newBlocks = await generateAISchedule(
      store.apiKeys,
      routine,
      store.subjects,
      store.activities,
      store.courses
    );

    store.setTimetable(newBlocks);
    setLoadingSchedule(false);
  };

  const handleGoogleSync = async () => {
    alert("Google Calendar Sync is currently disabled for public use to avoid Google OAuth security warnings.");
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant pb-4">
        <div>
          <h2 className="text-xl font-geist font-bold tracking-tight">Weekly Planner</h2>
          <p className="text-xs text-outline font-mono mt-0.5 uppercase tracking-widest">Generate, arrange, and sync AI optimized study grids.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Button */}
          <button
            onClick={handleGoogleSync}
            disabled={syncingCalendar || store.timetable.length === 0}
            className="bg-surface-container hover:bg-surface-container-high disabled:opacity-40 border border-outline-variant text-on-surface rounded-xl px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 active:scale-95 transition cursor-pointer"
          >
            {syncingCalendar ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-primary" strokeWidth={1.5} />
                Syncing Calendar...
              </>
            ) : (
              <>
                <CalendarRange className="w-4 h-4 text-secondary" strokeWidth={1.5} />
                Sync to Google Calendar
              </>
            )}
          </button>

          {/* AI Generator Button */}
          <button
            onClick={handleGenerateAI}
            disabled={loadingSchedule}
            className="btn-neon px-4 py-2.5 text-xs flex items-center gap-2 active:scale-95 transition cursor-pointer"
          >
            {loadingSchedule ? (
              <RefreshCw className="w-4 h-4 animate-spin text-black" strokeWidth={1.5} />
            ) : (
              <Sparkles className="w-4 h-4 text-black" strokeWidth={1.5} />
            )}
            Generate AI Schedule
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
            className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs font-mono flex items-center gap-2"
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
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all relative cursor-pointer ${
              activeDay === day.num ? 'bg-primary text-on-surface' : 'bg-surface-container text-outline hover:bg-surface-container-high hover:text-on-surface'
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
          <div className="flex justify-between items-center bg-white/2 p-3 rounded-xl border border-outline-variant">
            <span className="text-[10px] font-mono text-outline">Sequence Timeline ({activeDayBlocks.length} Blocks)</span>
            <button 
              onClick={() => setShowAddBlock(true)} 
              className="text-primary hover:text-primary text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> Add Custom Block
            </button>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {store.timetable.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-outline-variant rounded-2xl p-6">
                <AlertCircle className="w-10 h-10 text-on-surface/20 mb-3" strokeWidth={1.5} />
                <h3 className="text-sm font-geist font-bold text-on-surface/70">Planner is empty</h3>
                <p className="text-xs text-outline max-w-sm mt-1">
                  Click the **Generate AI Schedule** button above to compile subjects and routines automatically using the local optimization engine.
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
                  className={`flex items-center gap-3 p-4 rounded-2xl ${block.color} border-l-4 relative group`}
                >
                  {/* Time columns */}
                  <div className="font-mono text-center w-24 shrink-0">
                    <span className="text-sm font-black text-on-surface">{block.start}</span>
                    <span className="text-[10px] text-outline block leading-tight">{block.end}</span>
                  </div>

                  <div className="border-l border-outline-variant pl-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-on-surface">{block.title}</span>
                      {block.subjectCode && (
                        <span className="text-[9px] font-mono bg-surface-container border border-outline-variant px-2 py-0.5 rounded text-on-surface-variant">
                          {block.subjectCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-outline leading-relaxed font-sans mt-0.5">{block.details}</p>
                  </div>

                  {/* Drag re-arrange arrows and delete button */}
                  <div className="flex items-center gap-2 border-l border-outline-variant pl-3 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => handleMoveUp(index)} className="p-0.5 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition">
                        ▲
                      </button>
                      <button onClick={() => handleMoveDown(index)} className="p-0.5 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition">
                        ▼
                      </button>
                    </div>

                    <button 
                      onClick={() => handleDeleteBlock(block.id)}
                      className="p-1.5 hover:bg-red-950/40 text-outline-variant hover:text-red-400 rounded-lg transition"
                      title="Delete block"
                    >
                      <Trash className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info panel / instructions */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-geist font-bold text-primary border-b border-outline-variant pb-2 uppercase">Planning Guide</h4>
            
            <ul className="space-y-3 text-xs font-sans text-on-surface/70">
              <li className="flex items-start gap-2">
                <span className="text-primary font-mono font-bold">01.</span>
                <span>The **AI Planner** parses subject credits and difficulty, scheduling more blocks for hard tasks.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-mono font-bold">02.</span>
                <span>It allocates mandatory college hours, gyms, chess practice, and schedules power rest breaks automatically.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-mono font-bold">03.</span>
                <span>Sync to Google Calendar exports study slots so you receive mobile calendar push notifications.</span>
              </li>
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel-neon p-6 rounded-2xl z-50 border border-primary"
            >
              <h3 className="text-sm font-geist font-bold text-primary border-b border-outline-variant pb-2 mb-4">Add Custom Timetable Block</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Block Title</label>
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
                    <label className="block text-[10px] font-mono text-outline mb-1">Start Time</label>
                    <input
                      type="time"
                      value={newBlockStart}
                      onChange={(e) => setNewBlockStart(e.target.value)}
                      className="w-full input-hud"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-outline mb-1">End Time</label>
                    <input
                      type="time"
                      value={newBlockEnd}
                      onChange={(e) => setNewBlockEnd(e.target.value)}
                      className="w-full input-hud"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-outline mb-1">Block Type</label>
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
    </div>
  );
}


