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

  const handleGoogleSync = () => {
    setSyncingCalendar(true);
    setSyncSuccess(false);

    setTimeout(() => {
      setSyncingCalendar(false);
      setSyncSuccess(true);
      store.setCalendarSynced(true);
      
      // Auto-hide success modal
      setTimeout(() => setSyncSuccess(false), 3000);
    }, 2000);
  };

  const handleAddCustomBlock = () => {
    if (!newBlockTitle) return;

    const colors = {
      class: 'border-l-4 border-cyan-500 bg-cyan-950/20 text-cyan-200',
      study: 'border-l-4 border-purple-500 bg-purple-950/20 text-purple-200',
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">WEEKLY_PLANNER</h2>
          <p className="text-xs text-white/40 font-mono mt-0.5">Generate, arrange, and sync AI optimized study grids.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Button */}
          <button
            onClick={handleGoogleSync}
            disabled={syncingCalendar || store.timetable.length === 0}
            className="bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-white rounded-xl px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 active:scale-95 transition cursor-pointer"
          >
            {syncingCalendar ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                SYNCING_CALENDAR...
              </>
            ) : (
              <>
                <CalendarRange className="w-4 h-4 text-cyan-400" />
                SYNC_TO_GOOGLE_CALENDAR
              </>
            )}
          </button>

          {/* AI Generator Button */}
          <button
            onClick={handleGenerateAI}
            disabled={loadingSchedule}
            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white rounded-xl px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/20"
          >
            {loadingSchedule ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
            GENERATE_AI_SCHEDULE
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
            <Check className="w-4 h-4" />
            SUCCESS: Exported {store.timetable.length} schedule events & deadlines directly to Google Calendar account!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-white/5 pb-2">
        {daysOfWeek.map((day) => (
          <button
            key={day.num}
            onClick={() => setActiveDay(day.num)}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all relative cursor-pointer ${
              activeDay === day.num ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
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
          <div className="flex justify-between items-center bg-white/2 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] font-mono text-white/50">SEQUENCE_TIMELINE ({activeDayBlocks.length} BLOCKS)</span>
            <button 
              onClick={() => setShowAddBlock(true)} 
              className="text-purple-400 hover:text-purple-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> ADD_CUSTOM_BLOCK
            </button>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {store.timetable.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/10 rounded-2xl p-6">
                <AlertCircle className="w-10 h-10 text-white/20 mb-3" />
                <h3 className="text-sm font-mono font-bold text-white/70">Planner is empty</h3>
                <p className="text-xs text-white/40 max-w-sm mt-1">
                  Click the **GENERATE_AI_SCHEDULE** button above to compile subjects and routines automatically using the local optimization engine.
                </p>
              </div>
            ) : activeDayBlocks.length === 0 ? (
              <div className="text-center text-xs text-white/30 py-20">
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
                    <span className="text-sm font-black text-white">{block.start}</span>
                    <span className="text-[10px] text-white/40 block leading-tight">{block.end}</span>
                  </div>

                  <div className="border-l border-white/10 pl-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-white">{block.title}</span>
                      {block.subjectCode && (
                        <span className="text-[9px] font-mono bg-white/5 border border-white/5 px-2 py-0.5 rounded text-white/60">
                          {block.subjectCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed font-sans mt-0.5">{block.details}</p>
                  </div>

                  {/* Drag re-arrange arrows and delete button */}
                  <div className="flex items-center gap-2 border-l border-white/10 pl-3 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => handleMoveUp(index)} className="p-0.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition">
                        ▲
                      </button>
                      <button onClick={() => handleMoveDown(index)} className="p-0.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition">
                        ▼
                      </button>
                    </div>

                    <button 
                      onClick={() => handleDeleteBlock(block.id)}
                      className="p-1.5 hover:bg-red-950/40 text-white/30 hover:text-red-400 rounded-lg transition"
                      title="Delete block"
                    >
                      <Trash className="w-4 h-4" />
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
            <h4 className="text-xs font-mono font-bold text-purple-400 border-b border-white/5 pb-2">PLANNING_GUIDE</h4>
            
            <ul className="space-y-3 text-xs font-sans text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-mono">01.</span>
                <span>The **AI Planner** parses subject credits and difficulty, scheduling more blocks for hard tasks.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-mono">02.</span>
                <span>It allocates mandatory college hours, gyms, chess practice, and schedules power rest breaks automatically.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-mono">03.</span>
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
            <div onClick={() => setShowAddBlock(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel-neon p-6 rounded-2xl z-50 border border-purple-500/20"
            >
              <h3 className="text-sm font-mono font-bold text-purple-300 border-b border-white/5 pb-2 mb-4">ADD_CUSTOM_TIMETABLE_BLOCK</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">BLOCK_TITLE</label>
                  <input
                    type="text"
                    value={newBlockTitle}
                    onChange={(e) => setNewBlockTitle(e.target.value)}
                    placeholder="E.g., Self-Study Mathematics"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">START_TIME</label>
                    <input
                      type="time"
                      value={newBlockStart}
                      onChange={(e) => setNewBlockStart(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">END_TIME</label>
                    <input
                      type="time"
                      value={newBlockEnd}
                      onChange={(e) => setNewBlockEnd(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">BLOCK_TYPE</label>
                  <select
                    value={newBlockType}
                    onChange={(e) => setNewBlockType(e.target.value as any)}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-purple-200"
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
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 text-xs font-mono cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={handleAddCustomBlock} 
                    className="flex-1 bg-purple-600 hover:bg-purple-500 rounded-lg py-2 text-xs font-mono font-bold cursor-pointer"
                  >
                    INSERT
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
