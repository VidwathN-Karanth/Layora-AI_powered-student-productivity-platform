'use client';

import { useState } from 'react';
import { useStore, Task } from '@/store/useStore';
import { 
  CheckSquare, Plus, Clock, Play, Pause, Check, 
  Trash, Calendar, Sparkles, PlusCircle, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TasksPage() {
  const store = useStore();

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('pending');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubjectId, setNewTaskSubjectId] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('2026-05-30');
  const [newTaskEstimate, setNewTaskEstimate] = useState(60);

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
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours > 0 ? hours + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl font-geist font-bold tracking-tight">Task Manager</h2>
          <p className="text-xs text-white/40 font-mono mt-0.5 uppercase tracking-widest">Track study milestones, execute live timers, and analyze core durations.</p>
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
            <div className="glass-panel-neon rounded-2xl p-5 border border-purple-500/30 flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse-glow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Clock className="w-6 h-6 animate-pulse" strokeWidth={1.5} />
                </div>
                <div>
                  <span className="text-[9px] font-mono bg-purple-950/50 text-purple-300 px-2 py-0.5 rounded border border-purple-800/30 font-bold uppercase">
                    Focus Session Active
                  </span>
                  <h3 className="text-sm font-geist font-bold text-white mt-1">{tickingTask.title}</h3>
                  <p className="text-xs text-white/50 font-sans mt-0.5">{tickingTask.subjectName}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-2xl md:text-3xl font-mono font-black text-cyan-400 text-glow-cyan bg-cyan-950/20 px-4 py-1.5 rounded-xl border border-cyan-800/20">
                  {formatTimer(store.activeTimerElapsed)}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => store.stopTaskTimer(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition flex items-center gap-1.5"
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
      <div className="flex border-b border-white/5 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2.5 px-4 text-xs font-mono font-bold transition relative ${
            activeTab === 'pending' ? 'text-purple-400' : 'text-white/40 hover:text-white'
          }`}
        >
          Pending Tasks
          {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500"></div>}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-2.5 px-4 text-xs font-mono font-bold transition relative ${
            activeTab === 'completed' ? 'text-purple-400' : 'text-white/40 hover:text-white'
          }`}
        >
          Completed Tasks
          {activeTab === 'completed' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500"></div>}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 px-4 text-xs font-mono font-bold transition relative ${
            activeTab === 'all' ? 'text-purple-400' : 'text-white/40 hover:text-white'
          }`}
        >
          All Tasks
          {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500"></div>}
        </button>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-2 text-center py-20 border border-dashed border-white/5 rounded-2xl font-mono text-xs text-white/30">
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
                  isTicking ? 'border-purple-500/50 shadow-lg shadow-purple-500/5' : 'border-white/5'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] font-mono bg-purple-950/40 text-purple-300 px-2 py-0.5 rounded border border-purple-800/30">
                      {task.subjectName}
                    </span>
                    <h3 className="font-geist font-bold text-sm text-white/90 mt-2">{task.title}</h3>
                  </div>

                  <button 
                    onClick={() => store.removeTask(task.id)}
                    className="p-1 hover:bg-red-950/40 text-white/20 hover:text-red-400 rounded-lg transition"
                    title="Delete milestone"
                  >
                    <Trash className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Estimation & deadlines progress */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-white/40">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-purple-400" strokeWidth={1.5} /> Due: {task.deadline}</span>
                    <span>Spent: {task.actualMinutesSpent} / {task.estimatedMinutes} mins</span>
                  </div>

                  {/* Progress Indicator Slider */}
                  <div className="progress-track">
                    <div 
                      className={`progress-fill ${
                        task.status === 'completed' ? '!bg-emerald-500' : ''
                      }`}
                      style={{ width: `${task.status === 'completed' ? 100 : progressRatio}%` }}
                    ></div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center mt-5 pt-3 border-t border-white/5">
                  <span className="text-[10px] font-mono text-white/30">
                    Status: <span className={`capitalize ${task.status === 'completed' ? 'text-emerald-400' : 'text-cyan-400'}`}>{task.status === 'in_progress' ? 'In Progress' : task.status}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => handleTimerToggle(task.id)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                          isTicking 
                            ? 'bg-red-600/30 border border-red-500/40 text-red-200' 
                            : 'bg-cyan-950/30 hover:bg-cyan-950/55 border border-cyan-500/30 text-cyan-200'
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
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                          : 'bg-white/5 border-white/10 hover:border-emerald-500/30 text-white/40 hover:text-white'
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
            <div onClick={() => setShowAddTask(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel-neon p-6 rounded-2xl z-50 border border-purple-500/20"
            >
              <h3 className="text-sm font-geist font-bold text-purple-300 border-b border-white/5 pb-2 mb-4">Create Academic Milestone</h3>
              
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
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-purple-200"
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
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
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
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white text-center"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowAddTask(false)} 
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 text-xs font-mono cursor-pointer"
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
