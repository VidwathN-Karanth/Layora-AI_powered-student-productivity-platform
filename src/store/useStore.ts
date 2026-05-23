import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Subject, 
  Activity, 
  Course, 
  Routine, 
  TimetableBlock, 
  AIKeys,
  generateLocalWeeklySchedule 
} from '@/lib/aiService';

export interface Task {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  deadline: string;
  estimatedMinutes: number;
  actualMinutesSpent: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Website {
  id: string;
  name: string;
  url: string;
  timeSpentGoal: number; // in minutes
}

export interface UserProfile {
  name: string;
  email: string;
  streakCount: number;
  totalStudyHours: number;
  isOnboarded: boolean;
  wakeTime: string;
  sleepTime: string;
  collegeStart: string;
  collegeEnd: string;
  freeBlocks: { id: string; start: string; end: string; label?: string }[];
}

export interface RegisteredUser {
  email: string;
  name: string;
  passwordVal: string;
  subjects: Subject[];
  resources: { [subjectId: string]: { id: string; name: string; url: string; type: string }[] };
  activities: Activity[];
  websites: Website[];
  courses: Course[];
  tasks: Task[];
  timetable: TimetableBlock[];
  totalStudyHours: number;
  streakCount: number;
  isOnboarded: boolean;
  wakeTime: string;
  sleepTime: string;
  collegeStart: string;
  collegeEnd: string;
  freeBlocks: { id: string; start: string; end: string; label?: string }[];
}

interface AppState {
  // Auth state
  user: UserProfile | null;
  isAuthenticated: boolean;
  registeredUsers: RegisteredUser[];
  login: (email: string, name: string) => void;
  loginWithCredentials: (email: string, passwordVal: string) => { success: boolean; error?: string };
  registerUser: (email: string, name: string, passwordVal: string) => { success: boolean; error?: string };
  logout: () => void;
  updateOnboardingStatus: (status: boolean) => void;
  updateRoutine: (routine: Partial<UserProfile>) => void;
  incrementStreak: () => void;

  // Subjects & Uploads
  subjects: Subject[];
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  removeSubject: (id: string) => void;
  resources: { [subjectId: string]: { id: string; name: string; url: string; type: string }[] };
  uploadResource: (subjectId: string, resource: { name: string; url: string; type: string }) => void;
  removeResource: (subjectId: string, resourceId: string) => void;


  // Extracurriculars & Sites
  activities: Activity[];
  addActivity: (activity: Omit<Activity, 'id'>) => void;
  removeActivity: (id: string) => void;
  websites: Website[];
  addWebsite: (site: Omit<Website, 'id'>) => void;
  removeWebsite: (id: string) => void;

  // Active Courses
  courses: Course[];
  addCourse: (course: Omit<Course, 'id'>) => void;
  updateCourseProgress: (id: string, progress: number) => void;
  removeCourse: (id: string) => void;

  // Tasks & Ticking Timer
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'actualMinutesSpent' | 'status'>) => void;
  removeTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  activeTaskId: string | null;
  activeTimerStart: number | null; // Timestamp in ms
  activeTimerElapsed: number; // seconds
  startTaskTimer: (taskId: string) => void;
  stopTaskTimer: (saveProgress?: boolean) => void;
  updateTimerSecond: () => void;

  // Timetable
  timetable: TimetableBlock[];
  setTimetable: (blocks: TimetableBlock[]) => void;
  updateTimetableBlock: (id: string, updatedFields: Partial<TimetableBlock>) => void;
  generateSchedule: () => void;

  // Settings
  themeAccent: 'purple' | 'blue' | 'pink' | 'emerald';
  setThemeAccent: (theme: 'purple' | 'blue' | 'pink' | 'emerald') => void;
  apiKeys: AIKeys;
  setApiKeys: (keys: Partial<AIKeys>) => void;
  selectedModel: 'gemini' | 'openai' | 'claude' | 'grok';
  setSelectedModel: (model: 'gemini' | 'openai' | 'claude' | 'grok') => void;
  calendarSynced: boolean;
  setCalendarSynced: (synced: boolean) => void;

  // Chat
  chatHistory: ChatMessage[];
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChat: () => void;
  resetStore: () => void;
}

const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub-math', name: 'Advanced Calculus', code: 'MATH201', credits: 4, difficulty: 'Hard', priority: 'High' },
  { id: 'sub-cs', name: 'Data Structures & Algorithms', code: 'CS202', credits: 4, difficulty: 'Hard', priority: 'High' },
  { id: 'sub-phy', name: 'Quantum Physics', code: 'PHY102', credits: 3, difficulty: 'Medium', priority: 'Medium' }
];

const DEFAULT_RESOURCES: { [subjectId: string]: { id: string; name: string; url: string; type: string }[] } = {
  'sub-math': [
    { id: 'res-1', name: 'Calculus Limits CheatSheet.pdf', url: '#', type: 'pdf' },
    { id: 'res-2', name: 'Lecture Notes Differentiation.pptx', url: '#', type: 'ppt' }
  ],
  'sub-cs': [
    { id: 'res-3', name: 'Binary Trees Complete Guide.pdf', url: '#', type: 'pdf' }
  ]
};

const DEFAULT_ACTIVITIES: Activity[] = [
  { id: 'act-gym', name: 'Gym Training', duration: 60, preferredTimings: 'evening', priority: 'High' },
  { id: 'act-med', name: 'Meditation', duration: 15, preferredTimings: 'morning', priority: 'Medium' }
];

const DEFAULT_WEBSITES: Website[] = [
  { id: 'site-lc', name: 'LeetCode', url: 'https://leetcode.com', timeSpentGoal: 45 },
  { id: 'site-gh', name: 'GitHub', url: 'https://github.com', timeSpentGoal: 30 }
];

const DEFAULT_COURSES: Course[] = [
  { id: 'course-1', name: 'Next.js 15 Foundations', platform: 'Vercel Academy', progress: 65, weeklyGoal: 3, deadline: '2026-06-15' },
  { id: 'course-2', name: 'React Native for Beginners', platform: 'Udemy', progress: 40, weeklyGoal: 5, deadline: '2026-07-01' }
];

const DEFAULT_TASKS: Task[] = [
  { id: 'task-1', subjectId: 'sub-math', subjectName: 'Advanced Calculus', title: 'Complete Integration Assignment Sheet', deadline: '2026-05-24', estimatedMinutes: 90, actualMinutesSpent: 0, status: 'pending' },
  { id: 'task-2', subjectId: 'sub-cs', subjectName: 'Data Structures & Algorithms', title: 'Implement Red-Black Tree Balance Rotation', deadline: '2026-05-26', estimatedMinutes: 120, actualMinutesSpent: 45, status: 'in_progress' },
  { id: 'task-3', subjectId: 'sub-phy', subjectName: 'Quantum Physics', title: 'Review Photoelectric Effect Lab Report', deadline: '2026-05-28', estimatedMinutes: 60, actualMinutesSpent: 60, status: 'completed' }
];

const DEFAULT_REGISTERED_USERS: RegisteredUser[] = [
  {
    email: 'vidwan@gmail.com',
    name: 'Vidwan',
    passwordVal: 'password123',
    subjects: DEFAULT_SUBJECTS,
    resources: DEFAULT_RESOURCES,
    activities: DEFAULT_ACTIVITIES,
    websites: DEFAULT_WEBSITES,
    courses: DEFAULT_COURSES,
    tasks: DEFAULT_TASKS,
    timetable: [],
    totalStudyHours: 12.5,
    streakCount: 5,
    isOnboarded: false,
    wakeTime: '06:00',
    sleepTime: '22:00',
    collegeStart: '09:00',
    collegeEnd: '16:00',
    freeBlocks: [
      { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
      { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
    ]
  },
  {
    email: 'alex.mercer@gmail.com',
    name: 'Alex Mercer',
    passwordVal: 'password123',
    subjects: DEFAULT_SUBJECTS,
    resources: DEFAULT_RESOURCES,
    activities: DEFAULT_ACTIVITIES,
    websites: DEFAULT_WEBSITES,
    courses: DEFAULT_COURSES,
    tasks: DEFAULT_TASKS,
    timetable: [],
    totalStudyHours: 12.5,
    streakCount: 5,
    isOnboarded: false,
    wakeTime: '06:00',
    sleepTime: '22:00',
    collegeStart: '09:00',
    collegeEnd: '16:00',
    freeBlocks: [
      { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
      { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
    ]
  }
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth Default State
      user: null,
      isAuthenticated: false,
      registeredUsers: DEFAULT_REGISTERED_USERS,

      login: (email, name) => {
        const { registeredUsers } = get();
        const normalizedEmail = email.trim().toLowerCase();

        const existing = registeredUsers.find(
          (u) => u.email.toLowerCase() === normalizedEmail
        );

        if (existing) {
          set({
            isAuthenticated: true,
            user: {
              name: existing.name,
              email: existing.email,
              streakCount: existing.streakCount,
              totalStudyHours: existing.totalStudyHours,
              isOnboarded: existing.isOnboarded,
              wakeTime: existing.wakeTime,
              sleepTime: existing.sleepTime,
              collegeStart: existing.collegeStart,
              collegeEnd: existing.collegeEnd,
              freeBlocks: existing.freeBlocks
            },
            subjects: existing.subjects || [],
            resources: existing.resources || {},
            activities: existing.activities || [],
            websites: existing.websites || [],
            courses: existing.courses || [],
            tasks: existing.tasks || [],
            timetable: existing.timetable || []
          });
        } else {
          const newGoogleUser: RegisteredUser = {
            email: normalizedEmail,
            name: name || normalizedEmail.split('@')[0],
            passwordVal: 'google-sso',
            subjects: DEFAULT_SUBJECTS,
            resources: DEFAULT_RESOURCES,
            activities: DEFAULT_ACTIVITIES,
            websites: DEFAULT_WEBSITES,
            courses: DEFAULT_COURSES,
            tasks: DEFAULT_TASKS,
            timetable: [],
            totalStudyHours: 12.5,
            streakCount: 5,
            isOnboarded: false,
            wakeTime: '06:00',
            sleepTime: '22:00',
            collegeStart: '09:00',
            collegeEnd: '16:00',
            freeBlocks: [
              { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
              { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
            ]
          };

          set({
            registeredUsers: [...registeredUsers, newGoogleUser],
            isAuthenticated: true,
            user: {
              name: newGoogleUser.name,
              email: newGoogleUser.email,
              streakCount: newGoogleUser.streakCount,
              totalStudyHours: newGoogleUser.totalStudyHours,
              isOnboarded: newGoogleUser.isOnboarded,
              wakeTime: newGoogleUser.wakeTime,
              sleepTime: newGoogleUser.sleepTime,
              collegeStart: newGoogleUser.collegeStart,
              collegeEnd: newGoogleUser.collegeEnd,
              freeBlocks: newGoogleUser.freeBlocks
            },
            subjects: newGoogleUser.subjects,
            resources: newGoogleUser.resources,
            activities: newGoogleUser.activities,
            websites: newGoogleUser.websites,
            courses: newGoogleUser.courses,
            tasks: newGoogleUser.tasks,
            timetable: newGoogleUser.timetable
          });
        }
      },

      loginWithCredentials: (email, passwordVal) => {
        const { registeredUsers } = get();
        const normalizedEmail = email.trim().toLowerCase();

        const matched = registeredUsers.find(
          (u) => u.email.toLowerCase() === normalizedEmail
        );

        if (!matched) {
          return { success: false, error: 'User not registered. Please create an account first.' };
        }

        if (matched.passwordVal !== passwordVal) {
          return { success: false, error: 'Incorrect password.' };
        }

        set({
          isAuthenticated: true,
          user: {
            name: matched.name,
            email: matched.email,
            streakCount: matched.streakCount,
            totalStudyHours: matched.totalStudyHours,
            isOnboarded: matched.isOnboarded,
            wakeTime: matched.wakeTime,
            sleepTime: matched.sleepTime,
            collegeStart: matched.collegeStart,
            collegeEnd: matched.collegeEnd,
            freeBlocks: matched.freeBlocks
          },
          subjects: matched.subjects || [],
          resources: matched.resources || {},
          activities: matched.activities || [],
          websites: matched.websites || [],
          courses: matched.courses || [],
          tasks: matched.tasks || [],
          timetable: matched.timetable || []
        });

        return { success: true };
      },

      registerUser: (email, name, passwordVal) => {
        const { registeredUsers } = get();
        const normalizedEmail = email.trim().toLowerCase();

        const exists = registeredUsers.some(
          (u) => u.email.toLowerCase() === normalizedEmail
        );

        if (exists) {
          return { success: false, error: 'Email already registered. Please login instead.' };
        }

        const newUser: RegisteredUser = {
          email: normalizedEmail,
          name: name || normalizedEmail.split('@')[0],
          passwordVal,
          subjects: [],
          resources: {},
          activities: [],
          websites: DEFAULT_WEBSITES,
          courses: [],
          tasks: [],
          timetable: [],
          totalStudyHours: 0,
          streakCount: 0,
          isOnboarded: false,
          wakeTime: '06:00',
          sleepTime: '22:00',
          collegeStart: '09:00',
          collegeEnd: '16:00',
          freeBlocks: [
            { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
            { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
          ]
        };

        set({
          registeredUsers: [...registeredUsers, newUser]
        });

        return { success: true };
      },

      logout: () => {
        const { user, registeredUsers, subjects, resources, activities, websites, courses, tasks, timetable } = get();

        let updatedUsers = registeredUsers;
        if (user) {
          updatedUsers = registeredUsers.map((u) => {
            if (u.email.toLowerCase() === user.email.toLowerCase()) {
              return {
                ...u,
                name: user.name,
                streakCount: user.streakCount,
                totalStudyHours: user.totalStudyHours,
                isOnboarded: user.isOnboarded,
                wakeTime: user.wakeTime,
                sleepTime: user.sleepTime,
                collegeStart: user.collegeStart,
                collegeEnd: user.collegeEnd,
                freeBlocks: user.freeBlocks,
                subjects,
                resources,
                activities,
                websites,
                courses,
                tasks,
                timetable
              };
            }
            return u;
          });
        }

        set({
          registeredUsers: updatedUsers,
          isAuthenticated: false,
          user: null,
          chatHistory: [],
          activeTaskId: null,
          activeTimerStart: null,
          activeTimerElapsed: 0,
          subjects: [],
          resources: {},
          activities: [],
          websites: [],
          courses: [],
          tasks: [],
          timetable: []
        });
      },

      updateOnboardingStatus: (status) => set((state) => {
        if (!state.user) return {};
        return { user: { ...state.user, isOnboarded: status } };
      }),
      updateRoutine: (routine) => set((state) => {
        if (!state.user) return {};
        return { user: { ...state.user, ...routine } };
      }),
      incrementStreak: () => set((state) => {
        if (!state.user) return {};
        return { user: { ...state.user, streakCount: state.user.streakCount + 1 } };
      }),

      // Subjects & Resources
      subjects: [],
      addSubject: (subj) => set((state) => ({
        subjects: [...state.subjects, { ...subj, id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }]
      })),
      removeSubject: (id) => set((state) => ({
        subjects: state.subjects.filter((s) => s.id !== id)
      })),
      resources: {},
      uploadResource: (subjectId, res) => set((state) => {
        const subResources = state.resources[subjectId] || [];
        return {
          resources: {
            ...state.resources,
            [subjectId]: [...subResources, { ...res, id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }]
          }
        };
      }),
      removeResource: (subjectId, resourceId) => set((state) => {
        const subResources = state.resources[subjectId] || [];
        return {
          resources: {
            ...state.resources,
            [subjectId]: subResources.filter((r) => r.id !== resourceId)
          }
        };
      }),

      // Extra activities
      activities: [],
      addActivity: (act) => set((state) => ({
        activities: [...state.activities, { ...act, id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }]
      })),
      removeActivity: (id) => set((state) => ({
        activities: state.activities.filter((a) => a.id !== id)
      })),

      // Frequently used sites
      websites: [],
      addWebsite: (site) => set((state) => ({
        websites: [...state.websites, { ...site, id: `site-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }]
      })),
      removeWebsite: (id) => set((state) => ({
        websites: state.websites.filter((w) => w.id !== id)
      })),

      // Active Courses
      courses: [],
      addCourse: (course) => set((state) => ({
        courses: [...state.courses, { ...course, id: `course-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }]
      })),
      updateCourseProgress: (id, progress) => set((state) => ({
        courses: state.courses.map((c) => c.id === id ? { ...c, progress } : c)
      })),
      removeCourse: (id) => set((state) => ({
        courses: state.courses.filter((c) => c.id !== id)
      })),

      // Task items
      tasks: [],
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, { ...task, id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, actualMinutesSpent: 0, status: 'pending' }]
      })),
      removeTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id)
      })),
      toggleTaskStatus: (id) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id === id) {
            const nextStatus = t.status === 'completed' ? 'pending' : 'completed';
            return { ...t, status: nextStatus };
          }
          return t;
        })
      })),

      // Timer variables
      activeTaskId: null,
      activeTimerStart: null,
      activeTimerElapsed: 0,

      startTaskTimer: (taskId) => {
        const state = get();
        // Stop current active timer if any
        if (state.activeTaskId) {
          state.stopTaskTimer(true);
        }
        set({
          activeTaskId: taskId,
          activeTimerStart: Date.now(),
          activeTimerElapsed: 0,
          tasks: state.tasks.map((t) => t.id === taskId ? { ...t, status: 'in_progress' } : t)
        });
      },

      stopTaskTimer: (saveProgress = true) => {
        const { activeTaskId, activeTimerElapsed, tasks, user } = get();
        if (!activeTaskId) return;

        const minutesElapsed = Math.round(activeTimerElapsed / 60);

        set({
          activeTaskId: null,
          activeTimerStart: null,
          activeTimerElapsed: 0,
          tasks: tasks.map((t) => {
            if (t.id === activeTaskId) {
              const updatedMinutes = t.actualMinutesSpent + minutesElapsed;
              return { 
                ...t, 
                actualMinutesSpent: updatedMinutes,
                status: saveProgress ? t.status : 'pending' 
              };
            }
            return t;
          }),
          user: user ? {
            ...user,
            totalStudyHours: parseFloat((user.totalStudyHours + (activeTimerElapsed / 3600)).toFixed(2))
          } : null
        });
      },

      updateTimerSecond: () => {
        const { activeTimerStart } = get();
        if (!activeTimerStart) return;
        const totalElapsed = Math.floor((Date.now() - activeTimerStart) / 1000);
        set({ activeTimerElapsed: totalElapsed });
      },

      // Timetable layout
      timetable: [],
      setTimetable: (blocks) => set({ timetable: blocks }),
      updateTimetableBlock: (id, updatedFields) => set((state) => ({
        timetable: state.timetable.map((b) => b.id === id ? { ...b, ...updatedFields } : b)
      })),
      generateSchedule: () => {
        const { user, subjects, activities, courses } = get();
        if (!user) return;
        
        const routine: Routine = {
          wakeTime: user.wakeTime,
          sleepTime: user.sleepTime,
          collegeTimings: {
            start: user.collegeStart,
            end: user.collegeEnd
          },
          freeBlocks: user.freeBlocks
        };

        const schedule = generateLocalWeeklySchedule(routine, subjects, activities, courses);
        set({ timetable: schedule });
      },

      // Accent settings & API Keys
      themeAccent: 'purple',
      setThemeAccent: (theme) => set({ themeAccent: theme }),
      apiKeys: {},
      setApiKeys: (keys) => set((state) => ({
        apiKeys: { ...state.apiKeys, ...keys }
      })),
      selectedModel: 'gemini',
      setSelectedModel: (model) => set({ selectedModel: model }),
      calendarSynced: false,
      setCalendarSynced: (synced) => set({ calendarSynced: synced }),

      // Chat history
      chatHistory: [
        { id: 'msg-welcome', role: 'assistant', content: 'Welcome to your AI Academic Dashboard! I am your student co-pilot. I can help analyze your weekly load, suggest breaks, or resolve complex study questions. Let me know how I can assist you today.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ],
      addChatMessage: (role, content) => set((state) => ({
        chatHistory: [
          ...state.chatHistory,
          {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            role,
            content,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      })),
      clearChat: () => set({
        chatHistory: [
          { id: 'msg-welcome', role: 'assistant', content: 'Chat history cleared. What study goals do we have now?', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]
      }),
      resetStore: () => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('layora-productivity-store');
        }
        set({
          user: null,
          isAuthenticated: false,
          registeredUsers: DEFAULT_REGISTERED_USERS,
          subjects: [],
          resources: {},
          activities: [],
          websites: [],
          courses: [],
          tasks: [],
          timetable: [],
          activeTaskId: null,
          activeTimerStart: null,
          activeTimerElapsed: 0,
          themeAccent: 'purple',
          apiKeys: {},
          selectedModel: 'gemini',
          calendarSynced: false,
          chatHistory: [
            { id: 'msg-welcome', role: 'assistant', content: 'Welcome to your AI Academic Dashboard! I am your student co-pilot. I can help analyze your weekly load, suggest breaks, or resolve complex study questions. Let me know how I can assist you today.', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]
        });
      }
    }),
    {
      name: 'layora-productivity-store',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        registeredUsers: state.registeredUsers,
        subjects: state.subjects,
        resources: state.resources,
        activities: state.activities,
        websites: state.websites,
        courses: state.courses,
        tasks: state.tasks,
        timetable: state.timetable,
        themeAccent: state.themeAccent,
        apiKeys: state.apiKeys,
        selectedModel: state.selectedModel,
        calendarSynced: state.calendarSynced,
        chatHistory: state.chatHistory
      }),
    }
  )
);
