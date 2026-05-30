'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { 
  Clock, BookOpen, UploadCloud, Dumbbell, Globe, Award, CheckCircle, 
  Plus, Trash, ChevronRight, ChevronLeft, ArrowRight, ShieldCheck, File 
} from 'lucide-react';
import { formatTimeStr } from '@/lib/timeUtils';

export default function OnboardingPage() {
  const router = useRouter();
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
  }[]>([
    { name: 'Advanced Calculus', code: 'MATH201', credits: 4, difficulty: 'Hard', priority: 'High' },
    { name: 'Data Structures & Algorithms', code: 'CS202', credits: 4, difficulty: 'Hard', priority: 'High' },
    { name: 'Quantum Physics', code: 'PHY102', credits: 3, difficulty: 'Medium', priority: 'Medium' }
  ]);
  const [newSubName, setNewSubName] = useState('');
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubCredits, setNewSubCredits] = useState(3);
  const [newSubDiff, setNewSubDiff] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [newSubPriority, setNewSubPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  // Study materials (simulated file names uploaded)
  const [uploadedFiles, setUploadedFiles] = useState<{ [subIndex: number]: { name: string; type: string }[] }>({
    0: [{ name: 'Calculus Syllabus.pdf', type: 'pdf' }],
    1: [{ name: 'Algorithms Sorting Notes.docx', type: 'docx' }]
  });
  const [mockFileName, setMockFileName] = useState('');

  const [activities, setActivities] = useState<{
    name: string;
    duration: number;
    preferredTimings: 'morning' | 'afternoon' | 'evening';
    priority: 'Low' | 'Medium' | 'High';
  }[]>([
    { name: 'Gym Training', duration: 60, preferredTimings: 'evening', priority: 'High' },
    { name: 'Meditation', duration: 15, preferredTimings: 'morning', priority: 'Medium' }
  ]);
  const [newActName, setNewActName] = useState('');
  const [newActDuration, setNewActDuration] = useState(45);
  const [newActTiming, setNewActTiming] = useState<'morning' | 'afternoon' | 'evening'>('evening');
  const [newActPriority, setNewActPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  const [websites, setWebsites] = useState([
    { name: 'LeetCode', url: 'https://leetcode.com', timeSpentGoal: 45 },
    { name: 'GitHub', url: 'https://github.com', timeSpentGoal: 30 }
  ]);
  const [newWebName, setNewWebName] = useState('');
  const [newWebUrl, setNewWebUrl] = useState('');
  const [newWebGoal, setNewWebGoal] = useState(30);

  const [courses, setCourses] = useState([
    { name: 'Next.js 15 Foundations', platform: 'Vercel Academy', progress: 65, weeklyGoal: 3, deadline: '2026-06-15' },
    { name: 'React Native for Beginners', platform: 'Udemy', progress: 40, weeklyGoal: 5, deadline: '2026-07-01' }
  ]);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCoursePlatform, setNewCoursePlatform] = useState('');
  const [newCourseProgress, setNewCourseProgress] = useState(0);
  const [newCourseGoal, setNewCourseGoal] = useState(2);
  const [newCourseDeadline, setNewCourseDeadline] = useState('2026-06-30');

  // Multi-step handlers
  const handleAddFreeBlock = () => {
    setFreeBlocks([...freeBlocks, { id: Date.now().toString(), start: newFreeStart, end: newFreeEnd, label: newFreeLabel }]);
  };
  const handleRemoveFreeBlock = (id: string) => {
    setFreeBlocks(freeBlocks.filter(b => b.id !== id));
  };

  const handleAddSubject = () => {
    if (!newSubName) return;
    setSubjects([...subjects, { name: newSubName, code: newSubCode || 'SUB101', credits: newSubCredits, difficulty: newSubDiff, priority: newSubPriority }]);
    setNewSubName('');
    setNewSubCode('');
  };
  const handleRemoveSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const handleMockUpload = (subIndex: number) => {
    if (!mockFileName) return;
    const currentFiles = uploadedFiles[subIndex] || [];
    setUploadedFiles({
      ...uploadedFiles,
      [subIndex]: [...currentFiles, { name: mockFileName.endsWith('.pdf') ? mockFileName : `${mockFileName}.pdf`, type: 'pdf' }]
    });
    setMockFileName('');
  };

  const handleAddActivity = () => {
    if (!newActName) return;
    setActivities([...activities, { name: newActName, duration: newActDuration, preferredTimings: newActTiming, priority: newActPriority }]);
    setNewActName('');
  };
  const handleRemoveActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  const handleAddWebsite = () => {
    if (!newWebName || !newWebUrl) return;
    setWebsites([...websites, { name: newWebName, url: newWebUrl, timeSpentGoal: newWebGoal }]);
    setNewWebName('');
    setNewWebUrl('');
  };
  const handleRemoveWebsite = (index: number) => {
    setWebsites(websites.filter((_, i) => i !== index));
  };

  const handleAddCourse = () => {
    if (!newCourseName) return;
    setCourses([...courses, { name: newCourseName, platform: newCoursePlatform || 'Coursera', progress: newCourseProgress, weeklyGoal: newCourseGoal, deadline: newCourseDeadline }]);
    setNewCourseName('');
    setNewCoursePlatform('');
  };
  const handleRemoveCourse = (index: number) => {
    setCourses(courses.filter((_, i) => i !== index));
  };

  // Complete Onboarding Flow
  const handleSaveAndRedirect = () => {
    // 1. Commit everything to global Zustand store
    store.updateRoutine({
      wakeTime,
      sleepTime,
      collegeStart,
      collegeEnd,
      freeBlocks
    });

    // Replace subjects
    store.subjects.forEach(s => store.removeSubject(s.id));
    subjects.forEach(s => store.addSubject(s));

    // Upload resource items
    subjects.forEach((s, sIdx) => {
      const files = uploadedFiles[sIdx] || [];
      const matchingSub = store.subjects.find(sub => sub.name === s.name);
      if (matchingSub) {
        files.forEach(f => store.uploadResource(matchingSub.id, { name: f.name, url: '#', type: 'pdf' }));
      }
    });

    // Extracurriculars
    store.activities.forEach(a => store.removeActivity(a.id));
    activities.forEach(a => store.addActivity(a));

    // Websites
    store.websites.forEach(w => store.removeWebsite(w.id));
    websites.forEach(w => store.addWebsite(w));

    // Courses
    store.courses.forEach(c => store.removeCourse(c.id));
    courses.forEach(c => store.addCourse(c));

    // Mark as Onboarded
    store.updateOnboardingStatus(true);

    // 2. Generate optimized schedule blocks inside store
    store.generateSchedule();

    // 3. Navigate
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center p-4 md:p-8 cyber-grid">
      {/* Glow Orbs */}
      <div className="hidden w-[400px] h-[400px] bg-purple-900/10 top-1/4 left-10"></div>
      <div className="hidden w-[400px] h-[400px] bg-blue-900/10 bottom-10 right-10"></div>

      <div className="w-full max-w-4xl z-10">
        {/* Onboarding Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono text-primary font-bold">Layora Onboarding</span>
            <span className="text-xs font-mono text-outline-variant">| v1.0.4</span>
          </div>
          <div className="text-xs font-mono text-secondary">
            Step {step} of {totalSteps}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden mb-8 relative border border-outline-variant">
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          ></div>
        </div>

        {/* Form panel container */}
        <div className="glass-panel-neon rounded-2xl p-6 md:p-10 min-h-[450px] flex flex-col justify-between relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              {/* STEP 1: ROUTINE SETUP */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <Clock className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-mono font-bold">Routine Setup</h3>
                      <p className="text-xs text-outline">Determine sleep windows, mandatory lecture schedules, and study blocks.</p>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono text-primary/70 mb-1">Wake Time</label>
                          <input 
                            type="time" 
                            value={wakeTime}
                            onChange={(e) => setWakeTime(e.target.value)}
                            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-sm text-center w-full focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-primary/70 mb-1">Sleep Time</label>
                          <input 
                            type="time" 
                            value={sleepTime}
                            onChange={(e) => setSleepTime(e.target.value)}
                            className="bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-sm text-center w-full focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
 
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-xs font-mono text-cyan-300/70 mb-1">College Start</label>
                          <input 
                            type="time" 
                            value={collegeStart}
                            onChange={(e) => setCollegeStart(e.target.value)}
                            className="bg-surface-container border border-secondary rounded-xl px-3 py-2 text-sm text-center w-full focus:outline-none focus:border-secondary"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-cyan-300/70 mb-1">College End</label>
                          <input 
                            type="time" 
                            value={collegeEnd}
                            onChange={(e) => setCollegeEnd(e.target.value)}
                            className="bg-surface-container border border-secondary rounded-xl px-3 py-2 text-sm text-center w-full focus:outline-none focus:border-secondary"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-l border-outline-variant pl-0 md:pl-6">
                      <label className="block text-xs font-mono text-primary/70 mb-1 uppercase">Free Work & Study Slots</label>
                      
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                        {freeBlocks.map((b) => (
                          <div key={b.id} className="flex justify-between items-center bg-surface-container border border-outline-variant rounded-xl px-3 py-1.5 text-xs">
                            <span className="font-mono text-on-surface">{b.label || 'Study Block'}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-outline">{formatTimeStr(b.start, store.is24HourFormat)} - {formatTimeStr(b.end, store.is24HourFormat)}</span>
                              <button onClick={() => handleRemoveFreeBlock(b.id)} className="text-red-400 hover:text-red-300">
                                <Trash className="w-3.5 h-3.5" />
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
                            onChange={(e) => setNewFreeLabel(e.target.value)}
                            className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-xs w-full mb-2"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-outline block mb-1">START</span>
                          <input type="time" value={newFreeStart} onChange={(e) => setNewFreeStart(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded px-1 py-0.5 text-xs w-full" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-outline block mb-1">END</span>
                          <input type="time" value={newFreeEnd} onChange={(e) => setNewFreeEnd(e.target.value)} className="bg-surface-container-high border border-outline-variant rounded px-1 py-0.5 text-xs w-full" />
                        </div>
                        <button 
                          type="button" 
                          onClick={handleAddFreeBlock} 
                          className="bg-primary hover:bg-primary-container rounded p-1.5 flex items-center justify-center cursor-pointer"
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
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <BookOpen className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-mono font-bold">Academic Subjects</h3>
                      <p className="text-xs text-outline">Add subjects, credits, difficulty, and scheduling priorities.</p>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add subject form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-xs font-mono text-primary font-bold mb-2">Add Subject Details</h4>
                      <div>
                        <label className="block text-[10px] font-mono text-outline mb-1">Subject Name</label>
                        <input 
                          type="text" 
                          value={newSubName} 
                          onChange={(e) => setNewSubName(e.target.value)}
                          placeholder="Introduction to Calculus"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">CODE</label>
                          <input 
                            type="text" 
                            value={newSubCode} 
                            onChange={(e) => setNewSubCode(e.target.value)}
                            placeholder="MATH101"
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">CREDITS</label>
                          <input 
                            type="number" 
                            value={newSubCredits} 
                            onChange={(e) => setNewSubCredits(parseInt(e.target.value) || 3)}
                            min={1} 
                            max={6}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">DIFFICULTY</label>
                          <select 
                            value={newSubDiff} 
                            onChange={(e) => setNewSubDiff(e.target.value as any)}
                            className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">PRIORITY</label>
                          <select 
                            value={newSubPriority} 
                            onChange={(e) => setNewSubPriority(e.target.value as any)}
                            className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-2 py-1 text-xs"
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
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-2 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer mt-3"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Subject
                      </button>
                    </div>

                    {/* Subjects Listing Table */}
                    <div className="lg:col-span-2 space-y-2 max-h-[280px] overflow-y-auto pr-2">
                      {subjects.map((sub, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-on-surface">{sub.name}</span>
                              <span className="text-[10px] font-mono bg-primary-fixed text-primary px-2 py-0.5 rounded border border-primary">{sub.code}</span>
                            </div>
                            <div className="flex gap-4 text-[10px] text-outline mt-1 font-mono">
                              <span>Credits: {sub.credits}</span>
                              <span>Diff: <span className={sub.difficulty === 'Hard' ? 'text-red-400' : 'text-emerald-600'}>{sub.difficulty}</span></span>
                              <span>Priority: {sub.priority}</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveSubject(index)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash className="w-4 h-4" />
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
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <UploadCloud className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-mono font-bold">Study Materials Upload</h3>
                      <p className="text-xs text-outline">Upload syllabus notes, PDFs, or slides to associate resources with subjects.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[300px] overflow-y-auto pr-2">
                    {subjects.map((sub, sIdx) => {
                      const files = uploadedFiles[sIdx] || [];
                      return (
                        <div key={sIdx} className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                          <div className="flex justify-between items-center border-b border-outline-variant pb-2">
                            <span className="font-mono font-bold text-xs text-primary">{sub.name}</span>
                            <span className="text-[10px] font-mono text-outline">{sub.code}</span>
                          </div>

                          {/* File list */}
                          <div className="space-y-1.5 min-h-[60px]">
                            {files.length === 0 ? (
                              <p className="text-[10px] text-outline-variant font-mono py-4 text-center">No reference files uploaded yet</p>
                            ) : (
                              files.map((f, fIdx) => (
                                <div key={fIdx} className="flex items-center gap-2 bg-surface-container px-2.5 py-1.5 rounded-lg text-[10px] font-mono border border-outline-variant">
                                  <File className="w-3.5 h-3.5 text-secondary shrink-0" />
                                  <span className="truncate text-on-surface/70 flex-1">{f.name}</span>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Mock file upload field */}
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Notes Chapter 01.pdf" 
                              value={mockFileName}
                              onChange={(e) => setMockFileName(e.target.value)}
                              className="bg-surface-container border border-outline-variant rounded-lg px-2 py-1 text-[10px] flex-1 focus:outline-none"
                            />
                            <button 
                              onClick={() => handleMockUpload(sIdx)}
                              className="bg-primary hover:bg-primary-container text-on-surface text-[10px] font-mono font-bold px-3 py-1 rounded-lg cursor-pointer"
                            >
                              Mock Upload
                            </button>
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
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <Dumbbell className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-mono font-bold">Extracurricular Activities</h3>
                      <p className="text-xs text-outline">Register hobbies, gym, music, or physical routines to avoid study burnout.</p>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add activity form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-xs font-mono text-primary font-bold mb-2">Add Activity Details</h4>
                      <div>
                        <label className="block text-[10px] font-mono text-outline mb-1">Activity Name</label>
                        <input 
                          type="text" 
                          value={newActName} 
                          onChange={(e) => setNewActName(e.target.value)}
                          placeholder="Gym, Coding Practice, Chess..."
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">Duration (mins)</label>
                          <input 
                            type="number" 
                            value={newActDuration} 
                            onChange={(e) => setNewActDuration(parseInt(e.target.value) || 30)}
                            min={10} 
                            max={180}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">Timing</label>
                          <select 
                            value={newActTiming} 
                            onChange={(e) => setNewActTiming(e.target.value as any)}
                            className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="morning">Morning</option>
                            <option value="afternoon">Afternoon</option>
                            <option value="evening">Evening</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-outline mb-1">PRIORITY</label>
                        <select 
                          value={newActPriority} 
                          onChange={(e) => setNewActPriority(e.target.value as any)}
                          className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-2 py-1 text-xs"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddActivity}
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-2 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Activity
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="lg:col-span-2 space-y-2 max-h-[280px] overflow-y-auto pr-2">
                      {activities.map((act, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div>
                            <span className="font-mono font-bold text-sm text-on-surface">{act.name}</span>
                            <div className="flex gap-4 text-[10px] text-outline mt-1 font-mono">
                              <span>Duration: {act.duration} mins</span>
                              <span>Preferred: {act.preferredTimings}</span>
                              <span>Priority: {act.priority}</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveActivity(index)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash className="w-4 h-4" />
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
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <Globe className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-mono font-bold">Frequently Visited Websites</h3>
                      <p className="text-xs text-outline">Register URLs and target daily focus goals for quick-access launchers.</p>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-xs font-mono text-primary font-bold mb-2">Add Website Details</h4>
                      <div>
                        <label className="block text-[10px] font-mono text-outline mb-1">Website Name</label>
                        <input 
                          type="text" 
                          value={newWebName} 
                          onChange={(e) => setNewWebName(e.target.value)}
                          placeholder="LeetCode, GitHub, etc."
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-outline mb-1">URL</label>
                        <input 
                          type="url" 
                          value={newWebUrl} 
                          onChange={(e) => setNewWebUrl(e.target.value)}
                          placeholder="https://leetcode.com"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-outline mb-1">DAILY TIME GOAL (MINUTES)</label>
                        <input 
                          type="number" 
                          value={newWebGoal} 
                          onChange={(e) => setNewWebGoal(parseInt(e.target.value) || 30)}
                          min={5} 
                          max={240}
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddWebsite}
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-2 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Launcher
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="lg:col-span-2 space-y-2 max-h-[280px] overflow-y-auto pr-2">
                      {websites.map((site, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div>
                            <span className="font-mono font-bold text-sm text-on-surface">{site.name}</span>
                            <div className="flex gap-4 text-[10px] text-outline mt-1 font-mono">
                              <span className="truncate max-w-[200px] block">{site.url}</span>
                              <span>Goal: {site.timeSpentGoal} mins/day</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveWebsite(index)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash className="w-4 h-4" />
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
                  <div className="flex items-center gap-3 border-b border-outline-variant pb-4">
                    <Award className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-mono font-bold">Active Online Courses</h3>
                      <p className="text-xs text-outline">Track Coursera, Udemy, or platform courses, progress, and goals.</p>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add form */}
                    <div className="bg-surface-container p-4 rounded-xl border border-outline-variant space-y-3">
                      <h4 className="text-xs font-mono text-primary font-bold mb-2">Add Course Details</h4>
                      <div>
                        <label className="block text-[10px] font-mono text-outline mb-1">Course Name</label>
                        <input 
                          type="text" 
                          value={newCourseName} 
                          onChange={(e) => setNewCourseName(e.target.value)}
                          placeholder="Next.js 15 Web Apps"
                          className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">PLATFORM</label>
                          <input 
                            type="text" 
                            value={newCoursePlatform} 
                            onChange={(e) => setNewCoursePlatform(e.target.value)}
                            placeholder="Udemy, Coursera"
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">Progress %</label>
                          <input 
                            type="number" 
                            value={newCourseProgress} 
                            onChange={(e) => setNewCourseProgress(parseInt(e.target.value) || 0)}
                            min={0} 
                            max={100}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">Goal (Hours/Week)</label>
                          <input 
                            type="number" 
                            value={newCourseGoal} 
                            onChange={(e) => setNewCourseGoal(parseInt(e.target.value) || 2)}
                            min={1} 
                            max={40}
                            className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-outline mb-1">DEADLINE</label>
                          <input 
                            type="date" 
                            value={newCourseDeadline} 
                            onChange={(e) => setNewCourseDeadline(e.target.value)}
                            className="bg-surface-container border border-outline-variant rounded-lg px-1.5 py-1 text-xs w-full"
                          />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddCourse}
                        className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-lg py-2 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Course
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="lg:col-span-2 space-y-2 max-h-[280px] overflow-y-auto pr-2">
                      {courses.map((c, index) => (
                        <div key={index} className="flex items-center justify-between bg-surface-container border border-outline-variant rounded-xl p-3">
                          <div className="flex-1 mr-4">
                            <span className="font-mono font-bold text-sm text-on-surface">{c.name}</span>
                            <div className="flex gap-4 text-[10px] text-outline mt-1 font-mono">
                              <span>Platform: {c.platform}</span>
                              <span>Weekly Target: {c.weeklyGoal}h</span>
                              <span>Ends: {c.deadline}</span>
                            </div>
                            {/* Simple Progress Bar */}
                            <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden mt-2">
                              <div className="bg-cyan-500 h-full" style={{ width: `${c.progress}%` }}></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-bold text-secondary">{c.progress}%</span>
                            <button onClick={() => handleRemoveCourse(index)} className="text-red-400 hover:text-red-300 p-1">
                              <Trash className="w-4 h-4" />
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
                <div className="space-y-6 flex flex-col items-center justify-center py-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center text-emerald-600 animate-pulse mb-2">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  
                  <div className="text-center max-w-md space-y-2">
                    <h3 className="text-xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">Setup Complete</h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed font-mono">
                      Our local scheduling engines are primed. Clicking save will organize your classes, distribute your {subjects.length} subjects based on credits, inject break intervals to avoid cognitive burnout, and construct your interactive timetable.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="w-full max-w-md bg-surface-container rounded-xl border border-outline-variant p-4 grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="text-outline">Wake/Sleep cycles:</div>
                    <div className="text-right text-primary">{formatTimeStr(wakeTime, store.is24HourFormat)} - {formatTimeStr(sleepTime, store.is24HourFormat)}</div>
                    <div className="text-outline">Subjects loaded:</div>
                    <div className="text-right text-primary">{subjects.length} courses</div>
                    <div className="text-outline">Extra activities:</div>
                    <div className="text-right text-primary">{activities.length} entries</div>
                    <div className="text-outline">Quick-Access Sites:</div>
                    <div className="text-right text-primary">{websites.length} launchers</div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center border-t border-outline-variant pt-6 mt-6">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-mono border border-outline-variant bg-surface-container hover:bg-surface-container-high active:scale-95 transition cursor-pointer ${
                step === 1 ? 'opacity-30 pointer-events-none' : ''
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
 
            {step < totalSteps ? (
              <button
                onClick={() => setStep(Math.min(totalSteps, step + 1))}
                className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-on-surface px-5 py-2 rounded-xl text-xs font-mono font-bold active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/10"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSaveAndRedirect}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-emerald-500 hover:from-purple-500 hover:to-emerald-400 text-on-surface px-6 py-2.5 rounded-xl text-xs font-mono font-bold active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/20"
              >
                Complete Onboarding <ShieldCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
