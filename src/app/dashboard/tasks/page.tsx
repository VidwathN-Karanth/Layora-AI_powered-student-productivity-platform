'use client';

import { useState, useEffect } from 'react';
import { useStore, Task } from '@/store/useStore';
import { 
  CheckSquare, Plus, Clock, Play, Pause, Check, 
  Trash, Calendar, Sparkles, PlusCircle, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TasksPage() {
  const store = useStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('pending');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubjectId, setNewTaskSubjectId] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('2026-05-30');
  const [newTaskEstimate, setNewTaskEstimate] = useState(60);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20 font-mono text-xs text-white/50">
        Loading Task Manager telemetry...
      </div>
    );
  }

  const filteredTasks = store.tasks.filter((t) => {
    if (activeTab === 'pending') return t.status !== 'completed';
    if (activeTab === 'completed') return t.status === 'completed';
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskSubjectId) return;

    const matchedSubject = store.subjects.find((s) => s.id === newTaskSubjectId);
    const subjectName = matchedSubject ? matchedSubject.name : 'General study';

    store.addTask({
      subjectId: newTaskSubjectId,
      subjectName,
      title: newTaskTitle,
      deadline: newTaskDeadline,
      estimatedMinutes: newTaskEstimate,
    });

    setNewTaskTitle('');
    setShowAddTask(false);
  };

  const handleTimerToggle = (taskId: string) => {
    if (store.activeTaskId === taskId) {
      store.stopTaskTimer(true);
    } else {
      store.startTaskTimer(taskId);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(Math.abs(totalSeconds) / 3600);
    const mins = Math.floor((Math.abs(totalSeconds) % 3600) / 60);
    const secs = Math.abs(totalSeconds) % 60;
    const sign = totalSeconds < 0 ? '-' : '';
    return `${sign}${hours > 0 ? hours + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-geist font-bold tracking-tight text-white">Task Manager</h2>
          <p className="text-xs text-white/50 font-mono mt-0.5 uppercase tracking-widest">Track study milestones, execute live timers, and analyze core durations.</p>
        </div>

        <button
          onClick={() => {
            if (store.subjects.length > 0) {
              setNewTaskSubjectId(store.subjects[0].id);
            }
            setShowAddTask(true);
          }}
          className="btn-neon px-4 py-2.5 text-xs flex items-center gap-2 active:scale-95 transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
          Create New Task
        </button>
      </div>

      {/* Timer Hero Widget if active */}
      {store.activeTaskId && (
        (() => {
          const tickingTask = store.tasks.find((t) => t.id === store.activeTaskId);
          if (!tickingTask) return null;
          return (
            <div className="glass-panel-neon rounded-2xl p-5 border border-cyber-blue flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse-glow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyber-blue/10 border border-cyber-blue/40 flex items-center justify-center text-cyber-blue">
                  <Clock className="w-6 h-6 animate-pulse" strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-[9px] font-mono bg-cyber-purple/20 text-cyber-blue px-2 py-0.5 rounded border border-cyber-blue font-bold uppercase">
                    Focus Session Active
                  </span>
                  <h3 className="text-sm font-geist font-bold text-white mt-1 text-glow-cyan">{tickingTask.title}</h3>
                  <p className="text-xs text-white/50 font-sans mt-0.5">{tickingTask.subjectName}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-2xl md:text-3xl font-mono font-black text-cyber-blue text-glow-cyan bg-cyber-blue/10 px-4 py-1.5 rounded-xl border border-cyber-blue/30">
                  {formatTimer(Math.max(0, (tickingTask.estimatedMinutes * 60) - store.activeTimerElapsed))}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => store.stopTaskTimer(true, true)}
                    className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 px-3 py-2 rounded-xl text-xs font-mono font-bold border border-emerald-500/50 cursor-pointer transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" strokeWidth={1.5} /> Complete
                  </button>
                  <button 
                    onClick={() => store.stopTaskTimer(false)}
                    className="bg-white/5 border border-white/10 text-white/70 p-2 rounded-xl text-xs font-mono cursor-pointer hover:bg-white/10"
                    title="Pause timer"
                  >
                    <Pause className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-white/10 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2.5 px-4 text-xs font-mono font-bold transition relative ${
            activeTab === 'pending' ? 'text-cyber-blue text-glow-cyan' : 'text-white/50 hover:text-white'
          }`}
        >
          Pending Tasks
          {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyber-blue shadow-[0_0_10px_#00F0FF]"></div>}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-2.5 px-4 text-xs font-mono font-bold transition relative ${
            activeTab === 'completed' ? 'text-cyber-blue text-glow-cyan' : 'text-white/50 hover:text-white'
          }`}
        >
          Completed Tasks
          {activeTab === 'completed' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyber-blue shadow-[0_0_10px_#00F0FF]"></div>}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 px-4 text-xs font-mono font-bold transition relative ${
            activeTab === 'all' ? 'text-cyber-blue text-glow-cyan' : 'text-white/50 hover:text-white'
          }`}
        >
          All Tasks
          {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyber-blue shadow-[0_0_10px_#00F0FF]"></div>}
        </button>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-2 text-center py-20 border border-dashed border-white/20 rounded-2xl font-mono text-xs text-white/40">
            No milestones matching status selection.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isTicking = store.activeTaskId === task.id;
            const progressRatio = task.estimatedMinutes > 0 
              ? Math.min(100, Math.round((task.actualMinutesSpent / task.estimatedMinutes) * 100))
              : 0;

            return (
              <div 
                key={task.id} 
                className={`glass-card rounded-2xl p-5 border relative overflow-hidden transition ${
                  task.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-sm' : 'bg-white/5 border-white/10 shadow-sm'
                } ${
                  isTicking ? 'border-cyber-blue ring-2 ring-cyber-blue/20' : ''
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <span className="text-[10px] font-mono bg-cyber-blue/10 text-cyber-blue px-2 py-0.5 rounded border border-cyber-blue/30">
                      {task.subjectName}
                    </span>
                    <div className="flex items-center gap-3 mt-2">
                      <input 
                        type="checkbox" 
                        checked={task.status === 'completed'}
                        onChange={() => store.toggleTaskStatus(task.id)}
                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-cyber-blue focus:ring-cyber-blue cursor-pointer accent-emerald-500"
                      />
                      <h3 className={`font-geist font-bold text-sm transition ${task.status === 'completed' ? 'text-white/40 line-through' : 'text-white'}`}>
                        {task.title}
                      </h3>
                    </div>
                  </div>

                  <button 
                    onClick={() => store.removeTask(task.id)}
                    className="p-1 hover:bg-red-950/40 text-on-surface/20 hover:text-red-400 rounded-lg transition"
                    title="Delete milestone"
                  >
                    <Trash className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Estimation & deadlines progress */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-white/50">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-cyber-purple" strokeWidth={1.5} /> Due: {task.deadline}</span>
                    <span>
                      Spent: {isTicking 
                        ? Math.floor(task.actualMinutesSpent + (store.activeTimerElapsed / 60)) 
                        : task.actualMinutesSpent} / {task.estimatedMinutes} mins
                    </span>
                  </div>

                  {/* Progress Indicator Slider */}
                  <div className="progress-track bg-white/10">
                    <div 
                      className={`progress-fill ${
                        task.status === 'completed' ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyber-purple to-cyber-blue shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                      }`}
                      style={{ width: `${task.status === 'completed' ? 100 : progressRatio}%` }}
                    ></div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center mt-5 pt-3 border-t border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-semibold text-white/50">
                      Status: <span className={`capitalize ${task.status === 'completed' ? 'text-emerald-400 text-glow-cyan' : 'text-cyber-purple text-glow-purple'}`}>{task.status === 'in_progress' ? 'In Progress' : task.status}</span>
                    </span>
                    {task.status === 'completed' && task.completedAt && (
                      <span className="text-[9px] font-mono text-white/30 mt-0.5">
                        Done: {new Date(task.completedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => handleTimerToggle(task.id)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                          isTicking 
                            ? 'bg-red-500/20 border border-red-500/50 text-red-400' 
                            : 'bg-cyber-blue/10 hover:bg-cyber-blue/20 border border-cyber-blue/30 text-cyber-blue'
                        }`}
                      >
                        {isTicking ? <Pause className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Play className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        {isTicking ? 'Pause Clock' : 'Start Clock'}
                      </button>
                    )}

                    <button
                      onClick={() => store.toggleTaskStatus(task.id)}
                      className={`p-1.5 rounded-xl border transition cursor-pointer ${
                        task.status === 'completed'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-white/5 border-white/20 hover:bg-emerald-500/10 hover:border-emerald-500/50 hover:text-emerald-400 text-white/50'
                      }`}
                      title={task.status === 'completed' ? 'Mark Pending' : 'Mark Completed'}
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Task Modal Overlay */}
      <AnimatePresence>
        {showAddTask && (
          <>
            <div onClick={() => setShowAddTask(false)} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel p-6 rounded-2xl z-50 border border-white/10"
            >
              <h3 className="text-sm font-geist font-bold text-cyber-blue border-b border-white/10 pb-2 mb-4">Create Academic Milestone</h3>
              
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">Milestone Title</label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="E.g., Complete calculus integration exercises"
                    className="w-full input-hud"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">Associated Subject</label>
                  {store.subjects.length === 0 ? (
                    <div className="text-[10px] text-red-400 font-mono py-1">
                      No subjects configured. Add subjects first in Settings.
                    </div>
                  ) : (
                    <select
                      value={newTaskSubjectId}
                      onChange={(e) => setNewTaskSubjectId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      {store.subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} ({sub.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">Est. Duration (Mins)</label>
                    <input
                      type="number"
                      value={newTaskEstimate}
                      onChange={(e) => setNewTaskEstimate(parseInt(e.target.value) || 60)}
                      min={10}
                      max={480}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white text-center"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddTask(false)} 
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-2 text-xs font-mono cursor-pointer transition text-white/70 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={store.subjects.length === 0}
                    className="flex-1 btn-neon py-2 text-xs cursor-pointer disabled:opacity-40"
                  >
                    Insert
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
