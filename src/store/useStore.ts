import { create } from 'zustand';
import type { Cohort } from '@/lib/cohorts';
import {
  DEFAULT_POMODORO_SETTINGS, normalizeSettings, recordSession,
  type PomodoroDay, type PomodoroSettings,
} from '@/lib/pomodoro';
import { recordActivity, mergeActivityLogs, type ActivityDay, type ActivityDelta } from '@/lib/activityLog';
import { 
  Subject, 
  Activity, 
  Course, 
  Routine, 
  TimetableBlock, 
  generateLocalWeeklySchedule,
  resolveScheduleOverlaps,
  DEFAULT_ROUTINE
} from '@/lib/scheduler';

export interface Task {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  deadline: string;
  estimatedMinutes: number;
  actualMinutesSpent: number;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
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
  freeBlocks: { id: string; start: string; end: string; label?: string }[];
  lastActiveDate?: string;
  leetcodeUsername?: string | null;
  githubUsername?: string | null;
  codechefUsername?: string | null;
  linkedinUrl?: string | null;
  timezone?: string;
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
  freeBlocks: { id: string; start: string; end: string; label?: string }[];
  lastActiveDate?: string;
  leetcodeUsername?: string | null;
  githubUsername?: string | null;
  codechefUsername?: string | null;
  linkedinUrl?: string | null;
  timezone?: string;
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
  checkAndUpdateStreak: () => void;

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
  updateCourse: (id: string, updatedFields: Partial<Course>) => void;
  removeCourse: (id: string) => void;

  // Tasks & Ticking Timer
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'actualMinutesSpent' | 'status'>) => void;
  removeTask: (id: string) => void;
  updateTask: (id: string, updatedFields: Partial<Task>) => void;
  toggleTaskStatus: (id: string) => void;
  activeTaskId: string | null;
  activeTimerStart: number | null; // Timestamp in ms
  activeTimerElapsed: number; // seconds
  startTaskTimer: (taskId: string) => void;
  stopTaskTimer: (saveProgress?: boolean, markCompleted?: boolean) => void;
  updateTimerSecond: () => void;

  // Timetable
  timetable: TimetableBlock[];
  setTimetable: (blocks: TimetableBlock[]) => void;
  updateTimetableBlock: (id: string, updatedFields: Partial<TimetableBlock>) => void;
  generateSchedule: () => Promise<void>;

  // Settings
  themeAccent: 'purple' | 'blue' | 'pink' | 'emerald';
  setThemeAccent: (theme: 'purple' | 'blue' | 'pink' | 'emerald') => void;
  themeMode: 'dark' | 'light';
  setThemeMode: (mode: 'dark' | 'light') => void;
  calendarSynced: boolean;
  setCalendarSynced: (synced: boolean) => void;
  is24HourFormat: boolean;
  setIs24HourFormat: (val: boolean) => void;

  /**
   * Pomodoro rhythm, shared by the Zen mode timer and the weekly scheduler —
   * change the focus length here and study blocks resize to match.
   */
  pomodoroSettings: PomodoroSettings;
  setPomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  /** One row per day of completed focus sessions, trimmed to the last 60 days. */
  pomodoroLog: PomodoroDay[];
  recordPomodoroSession: (focusMinutes: number) => void;

  /**
   * One row per day of finished work — tasks, blocks and logged minutes.
   *
   * Kept because the workspace forgets on purpose: completed tasks are pruned
   * the next day and block flags are overwritten when the week regenerates, so
   * without this there is nothing left to report a week from.
   */
  activityLog: ActivityDay[];
  recordActivityEvent: (delta: ActivityDelta) => void;

  /**
   * Whether timetable blocks announce themselves on this device.
   *
   * Layora no longer emails anyone; reminders are browser notifications on
   * whatever machine has the workspace open, so this is a per-student setting
   * that only means anything once the browser permission is granted.
   */
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  /**
   * The weekly planner's own switch. Scoped to timetable blocks only — course
   * reminders and today's-events have their own switches. `notificationsEnabled`
   * above sits over all of them as the single off switch in Settings.
   */
  plannerNotificationsEnabled: boolean;
  setPlannerNotificationsEnabled: (enabled: boolean) => void;
  globalResources: { id: string; name: string; url: string; type: string; uploadedBy: string; uploaderName: string; createdAt: string }[];
  setGlobalResources: (resources: any[]) => void;
  addGlobalResource: (res: any) => void;
  removeGlobalResource: (id: string) => void;

  // Dynamic planning guide insights
  planningGuideInsights: string[];
  setPlanningGuideInsights: (insights: string[]) => void;
  resetStore: () => void;
  setFullState: (state: Partial<AppState>) => void;
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  isCloudLoaded: boolean;
  setIsCloudLoaded: (val: boolean) => void;
  /**
   * The signed-in student's academic year, resolved server-side from the CSE
   * roster. Null for admins and before /api/me has answered. Transient — never
   * persisted, because the roster is the only source of truth for it.
   */
  cohort: Cohort | null;
  setCohort: (cohort: Cohort | null) => void;
}

const DEFAULT_SUBJECTS: Subject[] = [];

const DEFAULT_RESOURCES: { [subjectId: string]: { id: string; name: string; url: string; type: string }[] } = {};

const DEFAULT_ACTIVITIES: Activity[] = [];

const DEFAULT_WEBSITES: Website[] = [];

const DEFAULT_COURSES: Course[] = [];

const DEFAULT_TASKS: Task[] = [];

const DEFAULT_REGISTERED_USERS: RegisteredUser[] = [];

export const useStore = create<AppState>()(
  (set, get) => ({
      // Auth Default State
      user: null,
      isAuthenticated: false,
      registeredUsers: DEFAULT_REGISTERED_USERS,
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),
      isCloudLoaded: false,
      setIsCloudLoaded: (val) => set({ isCloudLoaded: val }),
      cohort: null,
      setCohort: (cohort) => set({ cohort }),

      login: (email, name) => {
        const { registeredUsers, user: currentUser } = get();
        const normalizedEmail = email.trim().toLowerCase();

        // If already authenticated as this user, no-op
        if (currentUser && currentUser.email.toLowerCase() === normalizedEmail) {
          set({ isAuthenticated: true });
          return;
        }

        const existing = registeredUsers.find(
          (u) => u.email.toLowerCase() === normalizedEmail
        );

        // Build user profile from existing record OR create a minimal new one.
        // IMPORTANT: We do NOT restore data arrays (subjects, tasks, etc.) from
        // registeredUsers here — Supabase is the source of truth for those.
        // SyncProvider will load them from Supabase after authentication.
        const profileDefaults = {
          streakCount: 0,
          totalStudyHours: 0,
          isOnboarded: false,
          freeBlocks: [
            { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
            { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
          ]
        };

        if (existing) {
          set({
            isAuthenticated: true,
            user: {
              name: existing.name,
              email: existing.email,
              streakCount: existing.streakCount,
              totalStudyHours: existing.totalStudyHours,
              isOnboarded: existing.isOnboarded,
              freeBlocks: existing.freeBlocks,
              lastActiveDate: existing.lastActiveDate,
              leetcodeUsername: existing.leetcodeUsername,
              githubUsername: existing.githubUsername,
              codechefUsername: existing.codechefUsername,
              linkedinUrl: existing.linkedinUrl
            }
            // No data arrays — SyncProvider loads those from Supabase
          });
        } else {
          const newGoogleUser: RegisteredUser = {
            email: normalizedEmail,
            name: name || normalizedEmail.split('@')[0],
            passwordVal: 'google-sso',
            subjects: [],
            resources: {},
            activities: [],
            websites: [],
            courses: [],
            tasks: [],
            timetable: [],
            leetcodeUsername: null,
            githubUsername: null,
            codechefUsername: null,
            linkedinUrl: null,
            ...profileDefaults
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
              freeBlocks: newGoogleUser.freeBlocks,
              lastActiveDate: newGoogleUser.lastActiveDate,
              leetcodeUsername: null,
              githubUsername: null,
              codechefUsername: null,
              linkedinUrl: null
            }
            // No data arrays — SyncProvider loads those from Supabase
          });
        }
      },

      loginWithCredentials: (email, passwordVal) => {
        const { registeredUsers, user: currentUser } = get();
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

        if (currentUser && currentUser.email.toLowerCase() === normalizedEmail) {
          set({ isAuthenticated: true });
          return { success: true };
        }

        // Only restore profile metadata — data arrays come from Supabase via SyncProvider
        set({
          isAuthenticated: true,
          user: {
            name: matched.name,
            email: matched.email,
            streakCount: matched.streakCount,
            totalStudyHours: matched.totalStudyHours,
            isOnboarded: matched.isOnboarded,
            freeBlocks: matched.freeBlocks,
            lastActiveDate: matched.lastActiveDate,
            leetcodeUsername: matched.leetcodeUsername,
            githubUsername: matched.githubUsername,
            codechefUsername: matched.codechefUsername,
            linkedinUrl: matched.linkedinUrl
          }
          // No data arrays — SyncProvider loads those from Supabase
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
          freeBlocks: [
            { id: 'free-1', start: '17:00', end: '19:00', label: 'Evening Study' },
            { id: 'free-2', start: '20:00', end: '22:00', label: 'Night Review' }
          ],
          leetcodeUsername: null,
          githubUsername: null,
          codechefUsername: null,
          linkedinUrl: null
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
                freeBlocks: user.freeBlocks,
                lastActiveDate: user.lastActiveDate,
                leetcodeUsername: user.leetcodeUsername,
                githubUsername: user.githubUsername,
                codechefUsername: user.codechefUsername,
                linkedinUrl: user.linkedinUrl,
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
          isCloudLoaded: false,
          user: null,
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
      checkAndUpdateStreak: () => {
        const { user, tasks, timetable } = get();
        if (!user) return;

        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
        const todayNum = new Date().getDay();

        // Helper to check if a completed timestamp is from a previous day
        const isPreviousDay = (dateStr: string | undefined) => {
          if (!dateStr) return true; // Treat tasks without timestamp as previous day tasks
          try {
            const completedDate = new Date(dateStr);
            const today = new Date();
            return (
              completedDate.getFullYear() < today.getFullYear() ||
              (completedDate.getFullYear() === today.getFullYear() && completedDate.getMonth() < today.getMonth()) ||
              (completedDate.getFullYear() === today.getFullYear() && completedDate.getMonth() === today.getMonth() && completedDate.getDate() < today.getDate())
            );
          } catch (e) {
            return true;
          }
        };

        const updatedTasks = tasks.filter((t) => t.status !== 'completed');
        const updatedTimetable = timetable.map((b) => ({ ...b, completed: false }));

        if (!user.lastActiveDate) {
          set({
            user: {
              ...user,
              lastActiveDate: todayStr,
              streakCount: user.streakCount || 1
            },
            tasks: updatedTasks,
            timetable: updatedTimetable
          });
          return;
        }

        if (user.lastActiveDate === todayStr) {
          // If the day is already updated, we should still clear completed tasks and blocks from previous days
          const hasOldCompletedTasks = tasks.some((t) => t.status === 'completed' && isPreviousDay(t.completedAt));
          const hasCompletedBlocksOnOtherDays = timetable.some((b) => b.completed && b.day !== todayNum);

          if (hasOldCompletedTasks || hasCompletedBlocksOnOtherDays) {
            const filteredTasks = tasks.filter((t) => !(t.status === 'completed' && isPreviousDay(t.completedAt)));
            
            // Collect IDs of blocks completed in previous days
            const oldCompletedBlockIds = new Set(
              tasks
                .filter((t) => t.status === 'completed' && isPreviousDay(t.completedAt) && t.id.startsWith('task-from-block-'))
                .map((t) => t.id.replace('task-from-block-', ''))
            );

            const filteredTimetable = timetable.map((b) => {
              if (b.day !== todayNum || oldCompletedBlockIds.has(b.id)) {
                return { ...b, completed: false };
              }
              return b;
            });

            set({
              tasks: filteredTasks,
              timetable: filteredTimetable
            });
          }
          return;
        }

        const lastActive = new Date(user.lastActiveDate);
        const today = new Date(todayStr);
        const diffTime = Math.abs(today.getTime() - lastActive.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          set({
            user: {
              ...user,
              lastActiveDate: todayStr,
              streakCount: (user.streakCount || 0) + 1
            },
            tasks: updatedTasks,
            timetable: updatedTimetable
          });
        } else if (diffDays > 1) {
          set({
            user: {
              ...user,
              lastActiveDate: todayStr,
              streakCount: 1
            },
            tasks: updatedTasks,
            timetable: updatedTimetable
          });
        }
      },

      // Subjects & Resources
      subjects: [],
      addSubject: (subj) => set((state) => ({
        subjects: [...state.subjects, { ...subj, id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }]
      })),
      removeSubject: (id) => {
        try {
          const deletedSubject = (get().subjects || []).find((s) => s.id === id);
          
          set((state) => {
            const remainingSubjects = (state.subjects || []).filter((s) => s.id !== id);
            const updatedTasks = (state.tasks || []).filter((t) => t.subjectId !== id);
            const updatedResources = { ...(state.resources || {}) };
            delete updatedResources[id];
            
            let updatedTimetable = state.timetable || [];
            if (deletedSubject) {
              const deletedCode = (deletedSubject.code || '').toLowerCase();
              const deletedName = (deletedSubject.name || '').toLowerCase();

              updatedTimetable = (state.timetable || []).filter((b) => {
                const blockCode = (b.subjectCode || '').toLowerCase();
                const blockTitle = (b.title || '').toLowerCase();
                
                const isMatch = (deletedSubject.code && blockCode === deletedSubject.code.toLowerCase()) || 
                                (deletedCode && blockTitle.includes(deletedCode)) ||
                                (deletedName && blockTitle.includes(deletedName));
                return !isMatch;
              });
            }
            
            return {
              subjects: remainingSubjects,
              tasks: updatedTasks,
              resources: updatedResources,
              timetable: updatedTimetable
            };
          });
        } catch (error: any) {
          console.error("Failed to remove subject from store:", error);
          alert("Error removing subject: " + error.message);
        }
        
        // Asynchronously regenerate the schedule to fill the gaps
        get().generateSchedule();
      },
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
      updateCourse: (id, updatedFields) => set((state) => {
        const hasTimeOrEnabledChange = 'reminderTime' in updatedFields || 'reminderEnabled' in updatedFields;
        return {
          courses: state.courses.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...updatedFields,
                  ...(hasTimeOrEnabledChange ? { lastReminderSentDate: undefined } : {})
                }
              : c
          )
        };
      }),
      removeCourse: (id) => set((state) => ({
        courses: state.courses.filter((c) => c.id !== id)
      })),

      // Task items
      // Task items
      tasks: [],
      addTask: (task) => {
        set((state) => ({
          tasks: [...state.tasks, { ...task, id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, actualMinutesSpent: 0, status: 'pending' }]
        }));
        get().generateSchedule();
      },
      removeTask: (id) => {
        set((state) => {
          let blockIdToUpdate: string | null = null;
          if (id.startsWith('task-from-block-')) {
            blockIdToUpdate = id.replace('task-from-block-', '');
          }

          const updatedTasks = state.tasks.filter((t) => t.id !== id);
          const updatedTimetable = blockIdToUpdate
            ? state.timetable.map((b) => b.id === blockIdToUpdate ? { ...b, completed: false } : b)
            : state.timetable;

          return {
            tasks: updatedTasks,
            timetable: updatedTimetable
          };
        });
        get().generateSchedule();
      },
      updateTask: (id, updatedFields) => {
        set((state) => ({
          tasks: state.tasks.map((t) => t.id === id ? { ...t, ...updatedFields } : t)
        }));
        get().generateSchedule();
      },
      toggleTaskStatus: (id) => {
        set((state) => {
          let blockIdToUpdate: string | null = null;
          let isBlockCompleted = false;

          if (id.startsWith('task-from-block-')) {
            blockIdToUpdate = id.replace('task-from-block-', '');
          }

          const exists = state.tasks.some((t) => t.id === id);
          let updatedTasks;
          let activityDelta: ActivityDelta | null = null;

          if (!exists && blockIdToUpdate) {
            const block = state.timetable.find((b) => b.id === blockIdToUpdate);
            if (block) {
              let subjectId = '';
              let subjectName = 'General study';
              if (block.subjectCode) {
                const matchedSubject = state.subjects.find((s) => s.code === block.subjectCode);
                if (matchedSubject) {
                  subjectId = matchedSubject.id;
                  subjectName = matchedSubject.name;
                }
              }

              const timeToMin = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
              };
              const startMin = timeToMin(block.start);
              const endMin = timeToMin(block.end);
              const duration = endMin >= startMin ? (endMin - startMin) : (1440 - startMin + endMin);

              const newTask: Task = {
                id: id,
                subjectId: subjectId || 'sub-general',
                subjectName: subjectName,
                title: block.title,
                deadline: new Date().toISOString().split('T')[0],
                estimatedMinutes: duration,
                actualMinutesSpent: duration,
                status: 'completed',
                completedAt: new Date().toISOString()
              };
              isBlockCompleted = true;
              updatedTasks = [...state.tasks, newTask];
            } else {
              updatedTasks = state.tasks;
            }
          } else {
            updatedTasks = state.tasks.map((t) => {
              if (t.id === id) {
                const nextStatus: 'pending' | 'in_progress' | 'completed' = t.status === 'completed' ? 'pending' : 'completed';
                isBlockCompleted = nextStatus === 'completed';
                return { 
                  ...t, 
                  status: nextStatus,
                  completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined
                };
              }
              return t;
            });
          }

          const updatedTimetable = blockIdToUpdate
            ? state.timetable.map((b) => b.id === blockIdToUpdate ? { ...b, completed: isBlockCompleted } : b)
            : state.timetable;

          // Only a transition INTO completed counts. Un-ticking leaves the
          // record alone: the work did happen, and a report that could be
          // driven down by toggling a checkbox would be worth nothing.
          if (isBlockCompleted) {
            const finished = updatedTasks.find((t) => t.id === id);
            activityDelta = {
              tasksCompleted: 1,
              blocksCompleted: blockIdToUpdate ? 1 : 0,
              // A block ticked without ever starting the timer still bought its
              // own length; a normal task's minutes are logged by the timer when
              // it stops, so they are not counted twice here.
              taskMinutes: !exists && blockIdToUpdate ? (finished?.actualMinutesSpent || 0) : 0,
              subject: finished?.subjectName || null,
            };
          }

          return {
            tasks: updatedTasks,
            timetable: updatedTimetable,
            activityLog: activityDelta
              ? recordActivity(state.activityLog, activityDelta)
              : state.activityLog,
          };
        });
        get().generateSchedule();
      },

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

        let updatedTasks = state.tasks;
        const exists = state.tasks.some((t) => t.id === taskId);
        if (!exists && taskId.startsWith('task-from-block-')) {
          const blockId = taskId.replace('task-from-block-', '');
          const block = state.timetable.find((b) => b.id === blockId);
          if (block) {
            let subjectId = '';
            let subjectName = 'General study';
            if (block.subjectCode) {
              const matchedSubject = state.subjects.find((s) => s.code === block.subjectCode);
              if (matchedSubject) {
                subjectId = matchedSubject.id;
                subjectName = matchedSubject.name;
              }
            }

            const timeToMin = (t: string) => {
              const [h, m] = t.split(':').map(Number);
              return h * 60 + m;
            };
            const startMin = timeToMin(block.start);
            const endMin = timeToMin(block.end);
            const duration = endMin >= startMin ? (endMin - startMin) : (1440 - startMin + endMin);

            const newTask: Task = {
              id: taskId,
              subjectId: subjectId || 'sub-general',
              subjectName: subjectName,
              title: block.title,
              deadline: new Date().toISOString().split('T')[0],
              estimatedMinutes: duration,
              actualMinutesSpent: 0,
              status: 'in_progress'
            };
            updatedTasks = [...state.tasks, newTask];
          }
        } else {
          updatedTasks = state.tasks.map((t) => t.id === taskId ? { ...t, status: 'in_progress' } : t);
        }

        set({
          activeTaskId: taskId,
          activeTimerStart: Date.now(),
          activeTimerElapsed: 0,
          tasks: updatedTasks
        });
      },

      stopTaskTimer: (saveProgress = true, markCompleted = false) => {
        const { activeTaskId, activeTimerElapsed, tasks, timetable, user, activityLog } = get();
        if (!activeTaskId) return;

        const minutesElapsed = Math.round(activeTimerElapsed / 60);
        
        let blockIdToUpdate: string | null = null;
        if (markCompleted && activeTaskId.startsWith('task-from-block-')) {
          blockIdToUpdate = activeTaskId.replace('task-from-block-', '');
        }

        const updatedTasks = tasks.map((t) => {
          if (t.id === activeTaskId) {
            const updatedMinutes = t.actualMinutesSpent + minutesElapsed;
            const nextStatus: 'pending' | 'in_progress' | 'completed' = markCompleted ? 'completed' : (saveProgress ? t.status : 'pending');
            return { 
              ...t, 
              actualMinutesSpent: updatedMinutes,
              status: nextStatus,
              completedAt: nextStatus === 'completed' ? new Date().toISOString() : t.completedAt
            };
          }
          return t;
        });

        const updatedTimetable = blockIdToUpdate
          ? timetable.map((b) => b.id === blockIdToUpdate ? { ...b, completed: true } : b)
          : timetable;

        // Minutes count whenever the sitting is kept, whether or not the task
        // was finished — the report is about time spent, not only wins. The
        // completion is counted on the same event when they ticked done, so a
        // finished session never has to be reconciled with the tick later.
        const finishedTask = tasks.find((t) => t.id === activeTaskId);
        const nextActivityLog = recordActivity(activityLog, {
          taskMinutes: saveProgress || markCompleted ? minutesElapsed : 0,
          tasksCompleted: markCompleted ? 1 : 0,
          blocksCompleted: blockIdToUpdate ? 1 : 0,
          subject: finishedTask?.subjectName || null,
        });

        set({
          activeTaskId: null,
          activeTimerStart: null,
          activeTimerElapsed: 0,
          tasks: updatedTasks,
          timetable: updatedTimetable,
          activityLog: nextActivityLog,
          user: user ? {
            ...user,
            totalStudyHours: parseFloat((user.totalStudyHours + (activeTimerElapsed / 3600)).toFixed(2))
          } : null
        });
        get().generateSchedule();
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
        // A block being ticked here is the same event as ticking it on the
        // dashboard, so it is recorded the same way — and only on the way in.
        activityLog:
          updatedFields.completed === true &&
          state.timetable.find((b) => b.id === id)?.completed !== true
            ? recordActivity(state.activityLog, { blocksCompleted: 1 })
            : state.activityLog,
        timetable: state.timetable.map((b) => b.id === id ? { ...b, ...updatedFields } : b)
      })),
      generateSchedule: async () => {
        try {
          const { user, subjects, activities, courses, timetable, tasks } = get();
          if (!user) return;
          
          // The four routine questions are gone from onboarding and Settings;
          // one department on one timetable shares the same day.
          const routine: Routine = {
            wakeTime: DEFAULT_ROUTINE.wakeTime,
            sleepTime: DEFAULT_ROUTINE.sleepTime,
            collegeTimings: {
              start: DEFAULT_ROUTINE.collegeStart,
              end: DEFAULT_ROUTINE.collegeEnd
            },
            freeBlocks: user.freeBlocks || []
          };

          // Preserve manually placed blocks (and any left over from the
          // removed AI planner) across a regeneration.
          const customBlocks = timetable.filter(
            (b) => b.id && (b.id.startsWith('custom-block-') || b.id.startsWith('ai-block-'))
          );

          const result = generateLocalWeeklySchedule(routine, subjects, activities, courses, tasks, get().pomodoroSettings);
          
          // Merge base schedule with custom/AI blocks and resolve overlaps
          const combined = [...customBlocks, ...result.schedule];
          set({ 
            timetable: resolveScheduleOverlaps(combined),
            planningGuideInsights: result.insights || []
          });
        } catch (error) {
          console.error("Failed to generate weekly schedule:", error);
        }
      },

      // Accent settings & API Keys
      themeAccent: 'purple',
      setThemeAccent: (theme) => set({ themeAccent: theme }),
      themeMode: 'dark',
      setThemeMode: (mode) => set({ themeMode: mode }),
      calendarSynced: false,
      setCalendarSynced: (synced) => set({ calendarSynced: synced }),
      is24HourFormat: false,
      setIs24HourFormat: (val) => set({ is24HourFormat: val }),

      pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
      // Normalised on the way in, so a stale or hand-edited synced value can
      // never hand the timer a 0-minute phase.
      setPomodoroSettings: (settings) =>
        set((state) => ({ pomodoroSettings: normalizeSettings({ ...state.pomodoroSettings, ...settings }) })),
      pomodoroLog: [],
      recordPomodoroSession: (focusMinutes) =>
        set((state) => ({ pomodoroLog: recordSession(state.pomodoroLog, focusMinutes) })),

      activityLog: [],
      recordActivityEvent: (delta) =>
        set((state) => ({ activityLog: recordActivity(state.activityLog, delta) })),

      // On by default: a student who signs in should get their reminders without
      // hunting for a switch. It still does nothing until the browser permission
      // is granted, which Settings asks for.
      notificationsEnabled: true,
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      plannerNotificationsEnabled: true,
      setPlannerNotificationsEnabled: (enabled) => set({ plannerNotificationsEnabled: enabled }),

      globalResources: [],
      setGlobalResources: (resources) => set({ globalResources: resources }),
      addGlobalResource: (res) => set((state) => ({ globalResources: [...state.globalResources, res] })),
      removeGlobalResource: (id) => set((state) => ({ globalResources: state.globalResources.filter(r => r.id !== id) })),

      // Proactive recommendations

      // Dynamic planning guide insights
      planningGuideInsights: [
        'Allocated college class hours as mandatory locked blocks.',
        'Balanced self-study slots around your extracurricular activities.',
        'Synced algorithmic study blocks to ensure daily coding consistency.'
      ],
      setPlanningGuideInsights: (insights) => set({ planningGuideInsights: insights }),

      resetStore: () => {
        const { user, registeredUsers } = get();

        // Remove the current user from the registered users list
        const updatedRegisteredUsers = user
          ? registeredUsers.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase())
          : registeredUsers;

        // Wipe in-memory state first so the persist middleware serializes an empty slate
        set({
          user: null,
          isAuthenticated: false,
          isCloudLoaded: false,
          registeredUsers: updatedRegisteredUsers,
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
          themeMode: 'dark',
          calendarSynced: false,
          is24HourFormat: false,
          pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
          pomodoroLog: [],
          activityLog: [],
          notificationsEnabled: true,
          plannerNotificationsEnabled: true
        });

        // After set() persists the cleaned state, overwrite the key entirely to remove any leftovers
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('layora-productivity-store');
        }
      },
      setFullState: (newState) => set((state) => {
        let mergedUser = state.user;
        if (newState.user !== undefined) {
          if (newState.user === null) {
            mergedUser = null;
          } else if (!mergedUser) {
            mergedUser = newState.user;
          } else {
            mergedUser = {
              ...newState.user,
              streakCount: Math.max(mergedUser.streakCount || 0, newState.user.streakCount || 0),
              totalStudyHours: Math.max(mergedUser.totalStudyHours || 0, newState.user.totalStudyHours || 0),
              lastActiveDate: (mergedUser.lastActiveDate && newState.user.lastActiveDate)
                ? (new Date(mergedUser.lastActiveDate) > new Date(newState.user.lastActiveDate) ? mergedUser.lastActiveDate : newState.user.lastActiveDate)
                : (mergedUser.lastActiveDate || newState.user.lastActiveDate),
            };
          }
        }
        // Apply completed task and timetable block cleanup on state hydration/merge
        let tasks = newState.tasks !== undefined ? newState.tasks : state.tasks;
        let timetable = newState.timetable !== undefined ? newState.timetable : state.timetable;

        if (mergedUser && mergedUser.lastActiveDate) {
          const todayStr = new Date().toLocaleDateString('en-CA');
          const todayNum = new Date().getDay();

          const isPreviousDay = (dateStr: string | undefined) => {
            if (!dateStr) return true;
            try {
              const completedDate = new Date(dateStr);
              const today = new Date();
              return (
                completedDate.getFullYear() < today.getFullYear() ||
                (completedDate.getFullYear() === today.getFullYear() && completedDate.getMonth() < today.getMonth()) ||
                (completedDate.getFullYear() === today.getFullYear() && completedDate.getMonth() === today.getMonth() && completedDate.getDate() < today.getDate())
              );
            } catch (e) {
              return true;
            }
          };

          if (mergedUser.lastActiveDate !== todayStr) {
            tasks = tasks.filter((t) => t.status !== 'completed');
            timetable = timetable.map((b) => ({ ...b, completed: false }));
          } else {
            tasks = tasks.filter((t) => !(t.status === 'completed' && isPreviousDay(t.completedAt)));
            
            const oldCompletedBlockIds = new Set(
              tasks
                .filter((t) => t.status === 'completed' && isPreviousDay(t.completedAt) && t.id.startsWith('task-from-block-'))
                .map((t) => t.id.replace('task-from-block-', ''))
            );

            timetable = timetable.map((b) => {
              if (b.day !== todayNum || oldCompletedBlockIds.has(b.id)) {
                return { ...b, completed: false };
              }
              return b;
            });
          }
        }

        return {
          ...state,
          ...newState,
          user: mergedUser,
          tasks,
          timetable,
          // The report's record is merged, not replaced: a day recorded on this
          // device before the cloud state arrived would otherwise vanish.
          activityLog: newState.activityLog !== undefined
            ? mergeActivityLogs(state.activityLog, newState.activityLog)
            : state.activityLog,
        };
      })
    })
);
