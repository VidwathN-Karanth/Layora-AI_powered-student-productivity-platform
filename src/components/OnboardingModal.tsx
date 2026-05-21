'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { 
  Clock, BookOpen, UploadCloud, Dumbbell, Globe, Award, CheckCircle, 
  Plus, Trash, ChevronRight, ChevronLeft, File, X, Info
} from 'lucide-react';

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
    0: [{ name: 'Calculus_Syllabus.pdf', type: 'pdf' }],
    1: [{ name: 'Algorithms_Sorting_Notes.docx', type: 'docx' }]
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

  const handleSave = () => {
    // 1. Commit routines
    store.updateRoutine({
      wakeTime,
      sleepTime,
      collegeStart,
      collegeEnd,
      freeBlocks
    });

    // Clean subjects
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

    // Mark as Onboarded -> closes popup modal instantly!
    store.updateOnboardingStatus(true);

    // 2. Generate optimized schedule blocks inside store
    store.generateSchedule();
  };

  if (!store.user || store.user.isOnboarded) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col glass-panel-neon border border-purple-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/5 z-10">
        
        {/* Dynamic Glowing Border Line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-cyan-400 to-blue-500"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded bg-purple-500 animate-pulse"></span>
            <span className="font-mono text-xs font-bold tracking-wider text-purple-300">INITIALIZE_ACADEMIC_PROFILE</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-cyan-400 border border-cyan-500/20 bg-cyan-950/20 px-2.5 py-0.5 rounded-full">
              STEP_0{step}_OF_0{totalSteps}
            </span>
          </div>
        </div>

        {/* Notice alert */}
        <div className="bg-purple-950/25 border-b border-purple-900/30 px-5 py-2.5 flex items-center gap-2.5 text-[11px] text-purple-200/80 font-mono">
          <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Please complete these details to construct your interactive dashboard and custom AI timetable.</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-[2px] bg-white/5">
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
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <Clock className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white">ROUTINE_CYCLE_SETUP</h3>
                      <p className="text-[10px] text-white/50">Determine sleep windows, mandatory lecture schedules, and study blocks.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono text-purple-300/70 mb-1">WAKE_TIME</label>
                          <input 
                            type="time" 
                            value={wakeTime}
                            onChange={(e) => setWakeTime(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-purple-500 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-purple-300/70 mb-1">SLEEP_TIME</label>
                          <input 
                            type="time" 
                            value={sleepTime}
                            onChange={(e) => setSleepTime(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-purple-500 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-[10px] font-mono text-cyan-300/70 mb-1">COLLEGE_START</label>
                          <input 
                            type="time" 
                            value={collegeStart}
                            onChange={(e) => setCollegeStart(e.target.value)}
                            className="bg-white/5 border border-cyan-500/20 rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-cyan-500 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-cyan-300/70 mb-1">COLLEGE_END</label>
                          <input 
                            type="time" 
                            value={collegeEnd}
                            onChange={(e) => setCollegeEnd(e.target.value)}
                            className="bg-white/5 border border-cyan-500/20 rounded-xl px-3 py-2 text-xs text-center w-full focus:outline-none focus:border-cyan-500 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                      <label className="block text-[10px] font-mono text-purple-300/70 mb-1 uppercase">Free Work & Study Slots</label>
                      
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {freeBlocks.map((b) => (
                          <div key={b.id} className="flex justify-between items-center bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-[11px]">
                            <span className="font-mono text-purple-200">{b.label || 'Study Block'}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-white/50">{b.start} - {b.end}</span>
                              <button onClick={() => handleRemoveFreeBlock(b.id)} className="text-red-400 hover:text-red-300">
                                <Trash className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-end bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="Study slot label" 
                            value={newFreeLabel}
                            onChange={(e) => setNewFreeLabel(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs w-full mb-1 text-white placeholder-white/30"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-white/40 block mb-0.5">START</span>
                          <input type="time" value={newFreeStart} onChange={(e) => setNewFreeStart(e.target.value)} className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 text-xs w-full text-white" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-white/40 block mb-0.5">END</span>
                          <input type="time" value={newFreeEnd} onChange={(e) => setNewFreeEnd(e.target.value)} className="bg-white/10 border border-white/10 rounded px-1.5 py-0.5 text-xs w-full text-white" />
                        </div>
                        <button 
                          type="button" 
                          onClick={handleAddFreeBlock} 
                          className="bg-purple-600 hover:bg-purple-500 rounded p-1.5 flex items-center justify-center cursor-pointer text-white"
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
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <BookOpen className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white">ACADEMIC_SUBJECTS</h3>
                      <p className="text-[10px] text-white/50">Add subjects, credits, difficulty, and scheduling priorities.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add subject form */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                      <h4 className="text-[10px] font-mono text-purple-400 font-bold mb-1">ADD_SUBJECT_ENTRY</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-white/50 mb-0.5">SUBJECT_NAME</label>
                        <input 
                          type="text" 
                          value={newSubName} 
                          onChange={(e) => setNewSubName(e.target.value)}
                          placeholder="Introduction to Calculus"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">CODE</label>
                          <input 
                            type="text" 
                            value={newSubCode} 
                            onChange={(e) => setNewSubCode(e.target.value)}
                            placeholder="MATH101"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">CREDITS</label>
                          <input 
                            type="number" 
                            value={newSubCredits} 
                            onChange={(e) => setNewSubCredits(parseInt(e.target.value) || 3)}
                            min={1} 
                            max={6}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-center text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">DIFFICULTY</label>
                          <select 
                            value={newSubDiff} 
                            onChange={(e) => setNewSubDiff(e.target.value as any)}
                            className="w-full bg-[#0d0d16] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">PRIORITY</label>
                          <select 
                            value={newSubPriority} 
                            onChange={(e) => setNewSubPriority(e.target.value as any)}
                            className="w-full bg-[#0d0d16] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
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
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> ADD_SUBJECT
                      </button>
                    </div>

                    {/* Subjects Listing Table */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {subjects.map((sub, index) => (
                        <div key={index} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-purple-200">{sub.name}</span>
                              <span className="text-[9px] font-mono bg-purple-950/40 text-purple-300 px-2 py-0.5 rounded border border-purple-800/30">{sub.code}</span>
                            </div>
                            <div className="flex gap-4 text-[9px] text-white/50 mt-1 font-mono">
                              <span>Credits: {sub.credits}</span>
                              <span>Diff: <span className={sub.difficulty === 'Hard' ? 'text-red-400' : 'text-emerald-400'}>{sub.difficulty}</span></span>
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
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <UploadCloud className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white">STUDY_MATERIALS_UPLOAD</h3>
                      <p className="text-[10px] text-white/50">Upload syllabus notes, PDFs, or slides to associate resources with subjects.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[240px] overflow-y-auto pr-1">
                    {subjects.map((sub, sIdx) => {
                      const files = uploadedFiles[sIdx] || [];
                      return (
                        <div key={sIdx} className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                          <div className="flex justify-between items-center border-b border-white/5 pb-1">
                            <span className="font-mono font-bold text-xs text-purple-300">{sub.name}</span>
                            <span className="text-[9px] font-mono text-white/40">{sub.code}</span>
                          </div>

                          {/* File list */}
                          <div className="space-y-1 min-h-[40px]">
                            {files.length === 0 ? (
                              <p className="text-[9px] text-white/30 font-mono py-2 text-center">No reference files uploaded yet</p>
                            ) : (
                              files.map((f, fIdx) => (
                                <div key={fIdx} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg text-[9px] font-mono border border-white/5">
                                  <File className="w-3 h-3 text-cyan-400 shrink-0" />
                                  <span className="truncate text-white/70 flex-1">{f.name}</span>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Mock file upload field */}
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Notes_Chap_01.pdf" 
                              value={mockFileName}
                              onChange={(e) => setMockFileName(e.target.value)}
                              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[9px] flex-1 focus:outline-none text-white placeholder-white/30"
                            />
                            <button 
                              onClick={() => handleMockUpload(sIdx)}
                              className="bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-mono font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                            >
                              UPLOAD
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
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <Dumbbell className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white">EXTRA_CURRICULAR_ACTIVITIES</h3>
                      <p className="text-[10px] text-white/50">Register hobbies, gym, music, or physical routines to avoid study burnout.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add activity form */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                      <h4 className="text-[10px] font-mono text-purple-400 font-bold mb-1">ADD_ACTIVITY_ENTRY</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-white/50 mb-0.5">ACTIVITY_NAME</label>
                        <input 
                          type="text" 
                          value={newActName} 
                          onChange={(e) => setNewActName(e.target.value)}
                          placeholder="Gym, Chess..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">DURATION (MINS)</label>
                          <input 
                            type="number" 
                            value={newActDuration} 
                            onChange={(e) => setNewActDuration(parseInt(e.target.value) || 30)}
                            min={10} 
                            max={180}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-center text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">TIMING</label>
                          <select 
                            value={newActTiming} 
                            onChange={(e) => setNewActTiming(e.target.value as any)}
                            className="w-full bg-[#0d0d16] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            <option value="morning">Morning</option>
                            <option value="afternoon">Afternoon</option>
                            <option value="evening">Evening</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-white/50 mb-0.5">PRIORITY</label>
                        <select 
                          value={newActPriority} 
                          onChange={(e) => setNewActPriority(e.target.value as any)}
                          className="w-full bg-[#0d0d16] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddActivity}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> ADD_ACTIVITY
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {activities.map((act, index) => (
                        <div key={index} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
                          <div>
                            <span className="font-mono font-bold text-xs text-purple-200">{act.name}</span>
                            <div className="flex gap-4 text-[9px] text-white/50 mt-1 font-mono">
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
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <Globe className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white">FREQUENT_WEBSITES</h3>
                      <p className="text-[10px] text-white/50">Register URLs and target daily focus goals for quick-access launchers.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Form */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                      <h4 className="text-[10px] font-mono text-purple-400 font-bold mb-1">ADD_WEBSITE_ENTRY</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-white/50 mb-0.5">PLATFORM_NAME</label>
                        <input 
                          type="text" 
                          value={newWebName} 
                          onChange={(e) => setNewWebName(e.target.value)}
                          placeholder="LeetCode, GitHub"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-white/50 mb-0.5">URL</label>
                        <input 
                          type="url" 
                          value={newWebUrl} 
                          onChange={(e) => setNewWebUrl(e.target.value)}
                          placeholder="https://leetcode.com"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-white/50 mb-0.5">DAILY FOCUS (MINS)</label>
                        <input 
                          type="number" 
                          value={newWebGoal} 
                          onChange={(e) => setNewWebGoal(parseInt(e.target.value) || 30)}
                          min={5} 
                          max={240}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-center text-white"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddWebsite}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> ADD_LAUNCHER
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {websites.map((site, index) => (
                        <div key={index} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
                          <div>
                            <span className="font-mono font-bold text-xs text-purple-200">{site.name}</span>
                            <div className="flex gap-4 text-[9px] text-white/50 mt-1 font-mono">
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
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <Award className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-mono font-bold text-white">ACTIVE_ONLINE_COURSES</h3>
                      <p className="text-[10px] text-white/50">Track Coursera, Udemy, or platform courses, progress, and goals.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Add form */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                      <h4 className="text-[10px] font-mono text-purple-400 font-bold mb-1">ADD_COURSE_ENTRY</h4>
                      <div>
                        <label className="block text-[9px] font-mono text-white/50 mb-0.5">COURSE_NAME</label>
                        <input 
                          type="text" 
                          value={newCourseName} 
                          onChange={(e) => setNewCourseName(e.target.value)}
                          placeholder="Next.js 15 Web Apps"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">PLATFORM</label>
                          <input 
                            type="text" 
                            value={newCoursePlatform} 
                            onChange={(e) => setNewCoursePlatform(e.target.value)}
                            placeholder="Udemy"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">PROGRESS %</label>
                          <input 
                            type="number" 
                            value={newCourseProgress} 
                            onChange={(e) => setNewCourseProgress(parseInt(e.target.value) || 0)}
                            min={0} 
                            max={100}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-center text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">GOAL (HRS/WK)</label>
                          <input 
                            type="number" 
                            value={newCourseGoal} 
                            onChange={(e) => setNewCourseGoal(parseInt(e.target.value) || 2)}
                            min={1} 
                            max={40}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-center text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-white/50 mb-0.5">DEADLINE</label>
                          <input 
                            type="date" 
                            value={newCourseDeadline} 
                            onChange={(e) => setNewCourseDeadline(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-xs w-full text-white"
                          />
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleAddCourse}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-lg py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1 cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> ADD_COURSE
                      </button>
                    </div>

                    {/* Listing */}
                    <div className="md:col-span-2 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {courses.map((c, index) => (
                        <div key={index} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
                          <div className="flex-1 mr-4">
                            <span className="font-mono font-bold text-xs text-purple-200">{c.name}</span>
                            <div className="flex gap-4 text-[9px] text-white/50 mt-1 font-mono">
                              <span>Platform: {c.platform}</span>
                              <span>Weekly Target: {c.weeklyGoal}h</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1.5">
                              <div className="bg-cyan-500 h-full" style={{ width: `${c.progress}%` }}></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono font-bold text-cyan-400">{c.progress}%</span>
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
                  <div className="w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse mb-1">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  
                  <div className="text-center max-w-md space-y-1">
                    <h3 className="text-lg font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">INITIALIZATION_READY</h3>
                    <p className="text-[11px] text-white/60 leading-relaxed font-mono">
                      Click save to write changes, configure your weekly classes, distribute your {subjects.length} subjects, and set up your study timetable.
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="w-full max-w-md bg-white/5 rounded-xl border border-white/5 p-4 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="text-white/50">Wake/Sleep cycles:</div>
                    <div className="text-right text-purple-300">{wakeTime} - {sleepTime}</div>
                    <div className="text-white/50">Subjects loaded:</div>
                    <div className="text-right text-purple-300">{subjects.length} modules</div>
                    <div className="text-white/50">Extra activities:</div>
                    <div className="text-right text-purple-300">{activities.length} entries</div>
                    <div className="text-white/50">Quick-Access Sites:</div>
                    <div className="text-right text-purple-300">{websites.length} launchers</div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex justify-between items-center p-5 border-t border-white/5 bg-white/2">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition cursor-pointer text-white ${
              step === 1 ? 'opacity-30 pointer-events-none' : ''
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> PREV_PHASE
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(Math.min(totalSteps, step + 1))}
              className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white px-5 py-2 rounded-xl text-xs font-mono font-bold active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/10"
            >
              NEXT_PHASE <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-emerald-500 hover:from-purple-500 hover:to-emerald-400 text-white px-6 py-2.5 rounded-xl text-xs font-mono font-bold active:scale-95 transition cursor-pointer shadow-lg shadow-purple-500/20"
            >
              FINALIZE_AND_LAUNCH <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
