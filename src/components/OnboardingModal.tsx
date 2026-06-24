'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { 
  Clock, BookOpen, UploadCloud, Dumbbell, Globe, Award, CheckCircle, 
  Plus, Trash, ChevronRight, ChevronLeft, File, X, Info, ExternalLink
} from 'lucide-react';
import { getPlatformDisplay, formatCourseLink } from '@/lib/courseUtils';

export default function OnboardingModal() {
  const store = useStore();
  const [step, setStep] = useState(1);
  const totalSteps = 7;

  // Onboarding local states, pre-populated with realistic defaults
  const [wakeTime, setWakeTime] = useState('06:00');
  const [sleepTime, setSleepTime] = useState('22:00');
  const [collegeStart, setCollegeStart] = useState('09:00');
  const [collegeEnd, setCollegeEnd] = useState('16:00');
  const [freeBlocks, setFreeBlocks] = useState([
    { id: '1', start: '17:00', end: '19:00', label: 'Evening Study' },
    { id: '2', start: '20:00', end: '22:00', label: 'Night Work' }
  ]);
  const [newFreeStart, setNewFreeStart] = useState('17:00');
  const [newFreeEnd, setNewFreeEnd] = useState('19:00');
  const [newFreeLabel, setNewFreeLabel] = useState('Evening Study');

  const [subjects, setSubjects] = useState<{
    name: string;
    code: string;
    credits: number;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    priority: 'Low' | 'Medium' | 'High';
  }[]>([]);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubCredits, setNewSubCredits] = useState(3);
  const [newSubDiff, setNewSubDiff] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [newSubPriority, setNewSubPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  // Study materials (simulated file names uploaded)
  const [uploadedFiles, setUploadedFiles] = useState<{ [subIndex: number]: { name: string; type: string }[] }>({});
  const [mockFileName, setMockFileName] = useState('');
  const [stepErrors, setStepErrors] = useState<Record<string, string | undefined>>({});

  const [activities, setActivities] = useState<{
    name: string;
    duration: number;
    preferredTimings: 'morning' | 'afternoon' | 'evening';
    priority: 'Low' | 'Medium' | 'High';
  }[]>([]);
  const [newActName, setNewActName] = useState('');
  const [newActDuration, setNewActDuration] = useState(45);
  const [newActTiming, setNewActTiming] = useState<'morning' | 'afternoon' | 'evening'>('evening');
  const [newActPriority, setNewActPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  const [websites, setWebsites] = useState<{ id?: string; name: string; url: string; timeSpentGoal: number }[]>([]);
  const [newWebName, setNewWebName] = useState('');
  const [newWebUrl, setNewWebUrl] = useState('');
  const [newWebGoal, setNewWebGoal] = useState(30);

  const [courses, setCourses] = useState<{ name: string; platform: string; progress: number; weeklyGoal: number; deadline: string }[]>([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCoursePlatform, setNewCoursePlatform] = useState('');
  const [newCourseProgress, setNewCourseProgress] = useState(0);
  const [newCourseGoal, setNewCourseGoal] = useState(2);
  const [newCourseDeadline, setNewCourseDeadline] = useState('2026-06-30');

  const handleAddFreeBlock = () => {
    if (!newFreeLabel.trim()) {
      setStepErrors({ newFreeLabel: "This field cannot be empty" });
      return;
    }
    setFreeBlocks([...freeBlocks, { id: Date.now().toString(), start: newFreeStart, end: newFreeEnd, label: newFreeLabel }]);
    setStepErrors({});
  };
  const handleRemoveFreeBlock = (id: string) => {
    setFreeBlocks(freeBlocks.filter(b => b.id !== id));
  };

  const handleAddSubject = () => {
    const errors: Record<string, string> = {};
    if (!newSubName.trim()) errors.newSubName = "This field cannot be empty";
    if (!newSubCode.trim()) errors.newSubCode = "This field cannot be empty";
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      return;
    }
    setSubjects([...subjects, { name: newSubName, code: newSubCode || 'SUB101', credits: newSubCredits, difficulty: newSubDiff, priority: newSubPriority }]);
    setNewSubName('');
    setNewSubCode('');
    setStepErrors({});
  };
  const handleRemoveSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const handleMockUpload = (subIndex: number) => {
    if (!mockFileName.trim()) {
      setStepErrors({ [`mockFileName-${subIndex}`]: "This field cannot be empty" });
      return;
    }
    const currentFiles = uploadedFiles[subIndex] || [];
    setUploadedFiles({
      ...uploadedFiles,
      [subIndex]: [...currentFiles, { name: mockFileName.endsWith('.pdf') ? mockFileName : `${mockFileName}.pdf`, type: 'pdf' }]
    });
    setMockFileName('');
    setStepErrors({});
  };

  const handleAddActivity = () => {
    if (!newActName.trim()) {
      setStepErrors({ newActName: "This field cannot be empty" });
      return;
    }
    setActivities([...activities, { name: newActName, duration: newActDuration, preferredTimings: newActTiming, priority: newActPriority }]);
    setNewActName('');
    setStepErrors({});
  };
  const handleRemoveActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  const handleAddWebsite = () => {
    const errors: Record<string, string> = {};
    if (!newWebName.trim()) errors.newWebName = "This field cannot be empty";
    if (!newWebUrl.trim()) errors.newWebUrl = "This field cannot be empty";
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      return;
    }
    setWebsites([...websites, { name: newWebName, url: newWebUrl, timeSpentGoal: newWebGoal }]);
    setNewWebName('');
    setNewWebUrl('');
    setStepErrors({});
  };
  const handleRemoveWebsite = (index: number) => {
    setWebsites(websites.filter((_, i) => i !== index));
  };

  const handleAddCourse = () => {
    if (!newCourseName.trim()) {
      setStepErrors({ newCourseName: "This field cannot be empty" });
      return;
    }
    const formattedLink = formatCourseLink(newCoursePlatform) || 'Self-Study';
    setCourses([...courses, { name: newCourseName, platform: formattedLink, progress: newCourseProgress, weeklyGoal: newCourseGoal, deadline: newCourseDeadline }]);
    setNewCourseName('');
    setNewCoursePlatform('');
    setStepErrors({});
  };
  const handleRemoveCourse = (index: number) => {
    setCourses(courses.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Generate new lists with unique IDs to match store formats
    const newSubjects = subjects.map(s => ({
      ...s,
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));

    const newResources: { [subjectId: string]: { id: string; name: string; url: string; type: string }[] } = {};
    newSubjects.forEach((s, sIdx) => {
      const files = uploadedFiles[sIdx] || [];
      newResources[s.id] = files.map(f => ({
        id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: f.name,
        url: '#',
        type: 'pdf'
      }));
    });

    const newActivities = activities.map(a => ({
      ...a,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));

    const newWebsites = websites.map(w => ({
      ...w,
      id: `site-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));

    const newCourses = courses.map(c => ({
      ...c,
      id: `course-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }));

    const updatedUser = store.user ? {
      ...store.user,
      wakeTime,
      sleepTime,
      collegeStart,
      collegeEnd,
      freeBlocks,
      isOnboarded: true
    } : null;

    // Save all onboarded details to the global store in a single transaction
    store.setFullState({
      user: updatedUser,
      subjects: newSubjects,
      resources: newResources,
      activities: newActivities,
      websites: newWebsites,
      courses: newCourses
    });

    // Generate the initial study schedule blocks
    store.generateSchedule();
  };

  if (typeof window !== 'undefined') {
    fetch('/api/debug-log/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `OnboardingModal render - hasUser=${!!store.user}, isOnboarded=${store.user?.isOnboarded}, email=${store.user?.email}` })
    }).catch(() => {});
  }

  if (!store.user || store.user.isOnboarded) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md"></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col glass-panel-neon border border-primary rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/5 z-10">
        
        {/* Dynamic Glowing Border Line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-cyan-400 to-blue-500"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant bg-white/2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded bg-primary-container animate-pulse"></span>
            <span className="font-mono text-xs font-bold tracking-wider text-primary">Initialize Academic Profile</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-secondary border border-secondary bg-secondary-fixed px-2.5 py-0.5 rounded-full">
              Step 0{step} of 0{totalSteps}
            </span>
          </div>
        </div>

        {/* Notice alert */}
        <div className="bg-primary-fixed border-b border-primary px-5 py-2.5 flex items-center gap-2.5 text-[11px] text-on-surface/80 font-mono">
          <Info className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Please complete these details to construct your interactive dashboard and custom AI timetable.</span>
        </div>

        {/* Warning if Supabase is not configured */}
        {!isSupabaseConfigured && (
          <div className="bg-amber-950/45 border-b border-amber-500/30 px-5 py-2.5 flex items-center gap-2.5 text-[10px] text-amber-400 font-mono leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0"></span>
            <span>WARNING: Supabase database is not configured. The application is running in Local Demo Mode, and all settings/subjects will be lost upon refreshing the page. Please add the environment variables in your Vercel Project Settings or .env.local file.</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full h-[2px] bg-surface-container">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          ></div>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* STEP 1: ROUTINE SETUP */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-on-surface">Routine Setup</h3>
                      <p className="text-[10px] text-outline">Determine sleep windows, mandatory lecture schedules, and study blocks.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-primary/70 mb-1.5 uppercase">Wake Time</label>
                          <input 
                            type="time" 
                            value={wakeTime}
                            onChange={(e) => {
                              setWakeTime(e.target.value);
                              setStepErrors(prev => ({ ...prev, wakeTime: undefined }));
                            }}
                            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-primary text-on-surface"
                          />
                          {stepErrors.wakeTime && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.wakeTime}</p>}
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-primary/70 mb-1.5 uppercase">Sleep Time</label>
                          <input 
                            type="time" 
                            value={sleepTime}
                            onChange={(e) => {
                              setSleepTime(e.target.value);
                              setStepErrors(prev => ({ ...prev, sleepTime: undefined }));
                            }}
                            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-primary text-on-surface"
                          />
                          {stepErrors.sleepTime && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.sleepTime}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-[10px] font-mono text-cyan-300/70 mb-1.5 uppercase">College Start</label>
                          <input 
                            type="time" 
                            value={collegeStart}
                            onChange={(e) => {
                              setCollegeStart(e.target.value);
                              setStepErrors(prev => ({ ...prev, collegeStart: undefined }));
                            }}
                            className="bg-surface-container border border-secondary rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-secondary text-on-surface"
                          />
                          {stepErrors.collegeStart && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.collegeStart}</p>}
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-cyan-300/70 mb-1.5 uppercase">College End</label>
                          <input 
                            type="time" 
                            value={collegeEnd}
                            onChange={(e) => {
                              setCollegeEnd(e.target.value);
                              setStepErrors(prev => ({ ...prev, collegeEnd: undefined }));
                            }}
                            className="bg-surface-container border border-secondary rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-secondary text-on-surface"
                          />
                          {stepErrors.collegeEnd && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.collegeEnd}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-t md:border-t-0 md:border-l border-outline-variant pt-4 md:pt-0 md:pl-6">
                      <label className="block text-[10px] font-mono text-primary/70 mb-1 uppercase">Free Work & Study Slots</label>
                      
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {freeBlocks.map((b) => (
                          <div key={b.id} className="flex justify-between items-center bg-surface-container border border-outline-variant rounded-xl px-3 py-1.5 text-[11px]">
                            <span className="font-mono text-on-surface">{b.label || 'Study Block'}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-outline">{b.start} - {b.end}</span>
                              <button onClick={() => handleRemoveFreeBlock(b.id)} className="text-red-400 hover:text-red-300">
                                <Trash className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-end bg-surface-container p-3 rounded-xl border border-outline-variant">
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Study slot label" 
                            value={newFreeLabel}
                            onChange={(e) => {
                              setNewFreeLabel(e.target.value);
                              setStepErrors(prev => ({ ...prev, newFreeLabel: undefined }));
                            }}
                            className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs w-full mb-1 text-on-surface placeholder-white/30"
                          />
                          {stepErrors.newFreeLabel && <p className="text-red-500 text-[10px] font-mono mb-2">{stepErrors.newFreeLabel}</p>}
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-outline block mb-0.5">Start</span>
                          <input type="time" value={newFreeStart} onChange={(e) => setNewFreeStart(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded px-1.5 py-0.5 text-xs w-full text-on-surface" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-outline block mb-0.5">End</span>
                          <input type="time" value={newFreeEnd} onChange={(e) => setNewFreeEnd(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded px-1.5 py-0.5 text-xs w-full text-on-surface" />
                        </div>
                        <button 
                          type="button" 
                          onClick={handleAddFreeBlock} 
                          className="bg-primary hover:bg-primary-container rounded p-1.5 flex items-center justify-center cursor-pointer text-on-surface"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: SUBJECTS & CREDITS */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-on-surface">Academic Subjects</h3>
                      <p className="text-[10px] text-outline">Add subjects, credits, difficulty, and scheduling priorities.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add subject form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-[10px] font-mono text-primary font-bold mb-1">Add Subject</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-outline mb-0.5">Subject Name</label>
                        <input 
                          type="text" 
                          value={newSubName} 
                          onChange={(e) => {
                            setNewSubName(e.target.value);
                            setStepErrors(prev => ({ ...prev, newSubName: undefined }));
                          }}
                          placeholder="Subject Name"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        {stepErrors.newSubName && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.newSubName}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Code</label>
                          <input 
                            type="text" 
                            value={newSubCode} 
                            onChange={(e) => {
                              setNewSubCode(e.target.value);
                              setStepErrors(prev => ({ ...prev, newSubCode: undefined }));
                            }}
                            placeholder="Course Code"
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                          />
                          {stepErrors.newSubCode && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.newSubCode}</p>}
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Credits</label>
                          <select 
                            value={newSubCredits} 
                            onChange={(e) => setNewSubCredits(parseInt(e.target.value) || 3)}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2 py-1.5 text-xs text-on-surface"
                          >
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Difficulty</label>
                          <select 
                            value={newSubDiff} 
                            onChange={(e) => setNewSubDiff(e.target.value as any)}
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Priority</label>
                          <select 
                            value={newSubPriority} 
                            onChange={(e) => setNewSubPriority(e.target.value as any)}
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddSubject}
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Subject
                      </button>
                    </div>

                    {/* Subjects Listing Table */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {subjects.map((sub, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-on-surface">{sub.name}</span>
                              <span className="text-[9px] font-mono bg-primary-fixed text-primary px-2 py-0.5 rounded border border-primary">{sub.code}</span>
                            </div>
                            <div className="flex gap-4 text-[9px] text-outline mt-1 font-mono">
                              <span>Credits: {sub.credits}</span>
                              <span>Diff: <span className={sub.difficulty === 'Hard' ? 'text-red-400' : 'text-emerald-600'}>{sub.difficulty}</span></span>
                              <span>Priority: {sub.priority}</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveSubject(index)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: STUDY MATERIALS UPLOAD */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
                    <UploadCloud className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-on-surface">Upload Study Materials</h3>
                      <p className="text-[10px] text-outline">Upload syllabus notes, PDFs, or slides to associate resources with subjects.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[240px] overflow-y-auto pr-1">
                    {subjects.map((sub, sIdx) => {
                      const files = uploadedFiles[sIdx] || [];
                      return (
                        <div key={sIdx} className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-2">
                          <div className="flex justify-between items-center border-b border-outline-variant pb-1">
                            <span className="font-mono font-bold text-xs text-primary">{sub.name}</span>
                            <span className="text-[9px] font-mono text-outline">{sub.code}</span>
                          </div>

                          {/* File list */}
                          <div className="space-y-1 min-h-[40px]">
                            {files.length === 0 ? (
                              <p className="text-[9px] text-outline-variant font-mono py-2 text-center">No reference files uploaded yet</p>
                            ) : (
                              files.map((f, fIdx) => (
                                <div key={fIdx} className="flex items-center gap-2 bg-surface-container px-2 py-1 rounded-lg text-[9px] font-mono border border-outline-variant">
                                  <File className="w-3 h-3 text-secondary shrink-0" />
                                  <span className="truncate text-on-surface/70 flex-1">{f.name}</span>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Mock file upload field */}
                          <div>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Notes Chapter 1.pdf" 
                                value={mockFileName}
                                onChange={(e) => {
                                  setMockFileName(e.target.value);
                                  setStepErrors(prev => ({ ...prev, [`mockFileName-${sIdx}`]: undefined }));
                                }}
                                className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-[9px] flex-1 focus:outline-none text-on-surface placeholder-white/30"
                              />
                              <button 
                                onClick={() => handleMockUpload(sIdx)}
                                className="bg-primary hover:bg-primary-container text-on-surface text-[9px] font-mono font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                              >
                                Mock Upload
                              </button>
                            </div>
                            {stepErrors[`mockFileName-${sIdx}`] && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors[`mockFileName-${sIdx}`]}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: EXTRA ACTIVITIES */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
                    <Dumbbell className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-on-surface">Extracurricular Activities</h3>
                      <p className="text-[10px] text-outline">Register hobbies, gym, music, or physical routines to avoid study burnout.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add activity form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-[10px] font-mono text-primary font-bold mb-1">Add Activity</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-outline mb-0.5">Activity Name</label>
                        <input 
                          type="text" 
                          value={newActName} 
                          onChange={(e) => {
                            setNewActName(e.target.value);
                            setStepErrors(prev => ({ ...prev, newActName: undefined }));
                          }}
                          placeholder="Gym, Chess..."
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        {stepErrors.newActName && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.newActName}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Duration (mins)</label>
                          <input 
                            type="number" 
                            value={newActDuration} 
                            onChange={(e) => setNewActDuration(parseInt(e.target.value) || 30)}
                            min={10} 
                            max={180}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center text-on-surface"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Timing</label>
                          <select 
                            value={newActTiming} 
                            onChange={(e) => setNewActTiming(e.target.value as any)}
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                          >
                            <option value="morning">Morning</option>
                            <option value="afternoon">Afternoon</option>
                            <option value="evening">Evening</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-outline mb-0.5">Priority</label>
                        <select 
                          value={newActPriority} 
                          onChange={(e) => setNewActPriority(e.target.value as any)}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-2 py-1 text-xs text-on-surface"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddActivity}
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Activity
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {activities.map((act, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div>
                            <span className="font-mono font-bold text-xs text-on-surface">{act.name}</span>
                            <div className="flex gap-4 text-[9px] text-outline mt-1 font-mono">
                              <span>Duration: {act.duration} mins</span>
                              <span>Preferred: {act.preferredTimings}</span>
                              <span>Priority: {act.priority}</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveActivity(index)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: WEBSITES GOALS */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
                    <Globe className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-on-surface">Frequent Websites</h3>
                      <p className="text-[10px] text-outline">Register URLs and target daily focus goals for quick-access launchers.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-[10px] font-mono text-primary font-bold mb-1">Add Website</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-outline mb-0.5">Platform Name</label>
                        <input 
                          type="text" 
                          value={newWebName} 
                          onChange={(e) => {
                            setNewWebName(e.target.value);
                            setStepErrors(prev => ({ ...prev, newWebName: undefined }));
                          }}
                          placeholder="LeetCode, GitHub"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        {stepErrors.newWebName && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.newWebName}</p>}
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-outline mb-0.5">URL</label>
                        <input 
                          type="url" 
                          value={newWebUrl} 
                          onChange={(e) => {
                            setNewWebUrl(e.target.value);
                            setStepErrors(prev => ({ ...prev, newWebUrl: undefined }));
                          }}
                          placeholder="https://leetcode.com"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        {stepErrors.newWebUrl && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.newWebUrl}</p>}
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-outline mb-0.5">Daily Focus (mins)</label>
                        <input 
                          type="number" 
                          value={newWebGoal} 
                          onChange={(e) => setNewWebGoal(parseInt(e.target.value) || 30)}
                          min={5} 
                          max={240}
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center text-on-surface"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddWebsite}
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Website
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {websites.map((site, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div>
                            <span className="font-mono font-bold text-xs text-on-surface">{site.name}</span>
                            <div className="flex gap-4 text-[9px] text-outline mt-1 font-mono">
                              <span className="truncate max-w-[150px] block">{site.url}</span>
                              <span>Goal: {site.timeSpentGoal} mins/day</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveWebsite(index)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: ACTIVE COURSES */}
              {step === 6 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-3">
                    <Award className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-on-surface">Active Online Courses</h3>
                      <p className="text-[10px] text-outline">Track online courses, course links, progress, and goals.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-[10px] font-mono text-primary font-bold mb-1">Add Course</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-outline mb-0.5">Course Name</label>
                        <input 
                          type="text" 
                          value={newCourseName} 
                          onChange={(e) => {
                            setNewCourseName(e.target.value);
                            setStepErrors(prev => ({ ...prev, newCourseName: undefined }));
                          }}
                          placeholder="Next.js 15 Web Apps"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                        {stepErrors.newCourseName && <p className="text-red-500 text-[10px] font-mono mt-1">{stepErrors.newCourseName}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Course Link (URL)</label>
                          <input 
                            type="text" 
                            value={newCoursePlatform} 
                            onChange={(e) => setNewCoursePlatform(e.target.value)}
                            placeholder="https://coursera.org/..."
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Progress %</label>
                          <input 
                            type="number" 
                            value={newCourseProgress} 
                            onChange={(e) => setNewCourseProgress(parseInt(e.target.value) || 0)}
                            min={0} 
                            max={100}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center text-on-surface"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Goal (hrs/wk)</label>
                          <input 
                            type="number" 
                            value={newCourseGoal} 
                            onChange={(e) => setNewCourseGoal(parseInt(e.target.value) || 2)}
                            min={1} 
                            max={40}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center text-on-surface"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-outline mb-0.5">Deadline</label>
                          <input 
                            type="date" 
                            value={newCourseDeadline} 
                            onChange={(e) => setNewCourseDeadline(e.target.value)}
                            className="bg-surface-container border border-outline-variant rounded-lg px-1.5 py-1 text-xs w-full text-on-surface"
                          />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddCourse}
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Course
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {courses.map((c, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div className="flex-1 mr-4">
                            <span className="font-mono font-bold text-xs text-on-surface">{c.name}</span>
                            <div className="flex gap-4 text-[9px] text-outline mt-1 font-mono items-center">
                              <span>Link: {getPlatformDisplay(c.platform)}</span>
                              {c.platform && c.platform.startsWith('http') && (
                                <a 
                                  href={c.platform} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-primary hover:text-primary-container hover:underline flex items-center gap-0.5 transition cursor-pointer"
                                >
                                  Visit <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                              <span>Weekly Target: {c.weeklyGoal}h</span>
                            </div>
                            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden mt-1.5">
                              <div className="bg-cyan-500 h-full" style={{ width: `${c.progress}%` }}></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono font-bold text-secondary">{c.progress}%</span>
                            <button onClick={() => handleRemoveCourse(index)} className="text-red-400 hover:text-red-300 p-1">
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 7: SAVE CONFIG & READY */}
              {step === 7 && (
                <div className="space-y-6 flex flex-col items-center justify-center py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center text-emerald-600 animate-pulse mb-1">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  
                  <div className="text-center max-w-md space-y-1">
                    <h3 className="text-lg font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Setup Ready</h3>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed font-mono">
                      Click save to write changes, configure your weekly classes, distribute your {subjects.length} subjects, and set up your study timetable.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant p-4 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="text-outline">Wake/Sleep cycles:</div>
                    <div className="text-right text-primary">{wakeTime} - {sleepTime}</div>
                    <div className="text-outline">Subjects loaded:</div>
                    <div className="text-right text-primary">{subjects.length} modules</div>
                    <div className="text-outline">Extra activities:</div>
                    <div className="text-right text-primary">{activities.length} entries</div>
                    <div className="text-outline">Quick-Access Sites:</div>
                    <div className="text-right text-primary">{websites.length} launchers</div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex justify-between items-center p-5 border-t border-outline-variant bg-white/2">
          <button
            onClick={() => {
              setStepErrors({});
              setStep(Math.max(1, step - 1));
            }}
            disabled={step === 1}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono border border-outline-variant bg-surface-container hover:bg-surface-container-high active:scale-95 transition cursor-pointer text-on-surface ${
              step === 1 ? 'opacity-30 pointer-events-none' : ''
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => {
                setStepErrors({});
                setStep(Math.min(totalSteps, step + 1));
              }}
              className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-on-surface px-5 py-2 rounded-xl text-xs font-mono font-bold active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/10"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-emerald-500 hover:from-purple-500 hover:to-emerald-400 text-on-surface px-6 py-2.5 rounded-xl text-xs font-mono font-bold active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/20"
            >
              Finish <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
