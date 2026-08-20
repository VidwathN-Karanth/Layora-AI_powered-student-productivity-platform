// Scheduling logic.
//
// This module used to front the Groq-backed planner and chat copilot. Those
// features were removed; what remains is the deterministic local scheduler,
// which is now the only way a timetable gets built.

import {
  DEFAULT_POMODORO_SETTINGS, normalizeSettings, type PomodoroSettings,
} from './pomodoro';

/** Below this, a focus block is too short to be worth putting on a timetable. */
const MIN_FOCUS_MINUTES = 15;

/**
 * The day the scheduler assumes.
 *
 * Students used to be asked for their wake time, sleep time and college hours
 * during onboarding and in Settings. For one department on one timetable those
 * four questions never varied enough to earn the friction, so they are gone and
 * these values stand in.
 */
export const DEFAULT_ROUTINE = {
  wakeTime: '06:00',
  sleepTime: '22:00',
  collegeStart: '09:00',
  collegeEnd: '16:00',
} as const;


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


export interface Subject {
  id: string;
  name: string;
  code: string;
  credits: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  priority: 'Low' | 'Medium' | 'High';
}

export interface Activity {
  id: string;
  name: string;
  duration: number; // in minutes
  preferredTimings: 'morning' | 'afternoon' | 'evening';
  priority: 'Low' | 'Medium' | 'High';
}

export interface Course {
  id: string;
  name: string;
  platform: string;
  progress: number;
  weeklyGoal: number; // in hours
  deadline: string;
  reminderEnabled?: boolean;
  reminderTime?: string; // "HH:MM" format
  lastReminderSentDate?: string; // "YYYY-MM-DD" format
}

export interface Routine {
  wakeTime: string;
  sleepTime: string;
  collegeTimings: {
    start: string;
    end: string;
  };
  freeBlocks: {
    id: string;
    start: string;
    end: string;
    label?: string;
  }[];
}

export interface TimetableBlock {
  id: string;
  day: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
  title: string;
  type: 'class' | 'study' | 'extracurricular' | 'break';
  color: string;
  subjectCode?: string;
  details?: string;
  completed?: boolean;
  isSession?: boolean;
}

// Local smart algorithm that prioritizes credits, optimizes timings, balances breaks, and schedules studies.
export function generateLocalWeeklySchedule(
  routine: Routine,
  subjects: Subject[],
  activities: Activity[],
  courses: Course[],
  tasks?: Task[],
  pomodoroSettings?: PomodoroSettings
): { schedule: TimetableBlock[]; insights: string[] } {
  // Study time is laid out in the same focus/break rhythm as the Zen timer, so
  // a block on the timetable is exactly one sitting at the timer.
  const pomo = normalizeSettings(pomodoroSettings || DEFAULT_POMODORO_SETTINGS);
  const schedule: TimetableBlock[] = [];
  const days = [1, 2, 3, 4, 5, 6, 0]; // Monday to Saturday (rest on Sunday by default)
  const insights: string[] = [];

  const timeToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Clamped to the day, never wrapped. A late sleep time used to push the
  // fallback block negative ("-1:-30"), and a long activity past midnight came
  // back as an end time earlier than its own start.
  const minToTime = (m: number) => {
    const clamped = Math.min(1439, Math.max(0, Math.floor(m)));
    const h = Math.floor(clamped / 60);
    const min = clamped % 60;
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  const getUnoccupiedSegments = (start: number, end: number, occupied: { start: number; end: number }[]) => {
    let segments = [{ start, end }];
    
    occupied.forEach((occ) => {
      const nextSegments: { start: number; end: number }[] = [];
      segments.forEach((seg) => {
        // No overlap
        if (occ.end <= seg.start || occ.start >= seg.end) {
          nextSegments.push(seg);
        } else {
          // Overlap, split/shrink segment
          if (occ.start > seg.start) {
            nextSegments.push({ start: seg.start, end: occ.start });
          }
          if (occ.end < seg.end) {
            nextSegments.push({ start: occ.end, end: seg.end });
          }
        }
      });
      segments = nextSegments;
    });

    // Return segments that are at least 10 minutes long to be useful
    return segments.filter(seg => seg.end - seg.start >= 10);
  };

  const colors = {
    class: 'border-l-4 border-secondary bg-secondary-fixed text-on-surface',
    study: 'border-l-4 border-primary bg-primary-fixed text-on-surface',
    extracurricular: 'border-l-4 border-pink-500 bg-pink-950/20 text-pink-200',
    break: 'border-l-4 border-emerald-500 bg-emerald-950/20 text-emerald-200',
  };

  // Rule 4: Default schedule template if no user data exists yet
  if (subjects.length === 0 && (!tasks || tasks.length === 0)) {
    insights.push("No subjects or tasks found. Loaded default template.");
    insights.push("Add your subjects and tasks so I can personalize this further.");

    days.forEach((day) => {
      let blockIdCounter = 0;
      // Monday to Friday
      if (day >= 1 && day <= 5) {
        schedule.push({
          id: `block-${day}-class-${blockIdCounter++}`,
          day,
          start: '09:00',
          end: '16:00',
          title: 'College Class Hours',
          type: 'class',
          color: colors.class,
          details: 'Mandatory college class hours (locked)'
        });

        schedule.push({
          id: `block-${day}-break-${blockIdCounter++}`,
          day,
          start: '16:00',
          end: '16:30',
          title: 'Break',
          type: 'break',
          color: colors.break,
          details: 'Afternoon rest break (30 min)'
        });

        schedule.push({
          id: `block-${day}-study-1-${blockIdCounter++}`,
          day,
          start: '17:00',
          end: '18:00',
          title: 'Study: Review today\'s lecture notes',
          type: 'study',
          color: colors.study,
          details: 'Review lecture highlights and notes (60 min)'
        });

        schedule.push({
          id: `block-${day}-study-2-${blockIdCounter++}`,
          day,
          start: '18:30',
          end: '19:30',
          title: 'Study: Work on pending assignment',
          type: 'study',
          color: colors.study,
          details: 'Address homework or projects (60 min)'
        });

        schedule.push({
          id: `block-${day}-study-3-${blockIdCounter++}`,
          day,
          start: '20:00',
          end: '22:00',
          title: 'Night Work / Self-study',
          type: 'study',
          color: colors.study,
          details: 'Open hours for extra learning or revision'
        });
      } else if (day === 6) { // Saturday
        schedule.push({
          id: `block-${day}-study-1`,
          day,
          start: '10:00',
          end: '12:00',
          title: 'Study: Weekend Review',
          type: 'study',
          color: colors.study,
          details: 'Revise topics from the week'
        });
        schedule.push({
          id: `block-${day}-study-2`,
          day,
          start: '14:00',
          end: '14:45',
          title: 'Solve 1 LeetCode Problem',
          type: 'study',
          color: colors.study,
          details: 'Practice logic and coding tasks'
        });
      } else if (day === 0) { // Sunday
        schedule.push({
          id: `block-${day}-study-1`,
          day,
          start: '10:00',
          end: '12:00',
          title: 'Online Course Study',
          type: 'study',
          color: colors.study,
          details: 'Advance your active online courses'
        });
        schedule.push({
          id: `block-${day}-study-2`,
          day,
          start: '14:00',
          end: '14:45',
          title: 'Solve 1 LeetCode Problem',
          type: 'study',
          color: colors.study,
          details: 'Sundays logic practice'
        });
        schedule.push({
          id: `block-${day}-break-recap`,
          day,
          start: '16:00',
          end: '17:00',
          title: 'Weekly AI Recap & Planning',
          type: 'break',
          color: colors.break,
          details: 'Plan upcoming milestones and review hours'
        });
      }
    });

    return { schedule: resolveScheduleOverlaps(schedule), insights };
  }

  // 1. Filter active tasks and sort by priority order (Rule 3)
  const activeTasks = (tasks || []).filter(t => t.status !== 'completed');

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const getDaysUntil = (deadlineStr: string) => {
    if (!deadlineStr) return 999;
    const deadlineMs = new Date(deadlineStr).setHours(0, 0, 0, 0);
    return Math.ceil((deadlineMs - todayMs) / (1000 * 60 * 60 * 24));
  };

  const urgentTasks: Task[] = [];
  const highTasks: Task[] = [];
  const mediumTasks: Task[] = [];

  activeTasks.forEach((t) => {
    const days = getDaysUntil(t.deadline);
    if (days <= 1) {
      urgentTasks.push(t);
    } else if (days <= 3) {
      highTasks.push(t);
    } else {
      mediumTasks.push(t);
    }
  });

  // Calculate subject completed minutes from task history (Rule 2 point 4)
  const subjectStudyMinutes: { [subjectId: string]: number } = {};
  (tasks || []).forEach((t) => {
    if (t.status === 'completed') {
      subjectStudyMinutes[t.subjectId] = (subjectStudyMinutes[t.subjectId] || 0) + (t.actualMinutesSpent || 0);
    }
  });

  // Combine subjects and active online courses, then sort by priority/importance
  interface StudyItem {
    type: 'subject' | 'course';
    id: string;
    name: string;
    code?: string;
    details: string;
    priorityScore: number;
    credits?: number;
    difficulty?: string;
    priority?: string;
  }

  const studyItems: StudyItem[] = [];

  subjects.forEach((sub) => {
    const priorityWeight = { High: 3, Medium: 2, Low: 1 };
    let score = (priorityWeight[sub.priority] || 2) * 5 + sub.credits;

    // Hard subjects priority weight (Rule 5)
    if (sub.difficulty === 'Hard') score += 5;
    else if (sub.difficulty === 'Medium') score += 2;

    // Scale priority based on recent study hours history (Rule 2 point 4)
    const completedHours = (subjectStudyMinutes[sub.id] || 0) / 60;
    score -= Math.floor(completedHours) * 2; // Demote highly studied subjects to cycle priorities

    studyItems.push({
      type: 'subject',
      id: sub.id,
      name: sub.name,
      code: sub.code,
      details: `AI Mentor: Review credits (${sub.credits}) & assignments. Difficulty: ${sub.difficulty}. Keep pushing forward!`,
      priorityScore: score,
      credits: sub.credits,
      difficulty: sub.difficulty,
      priority: sub.priority
    });
  });

  courses.forEach((course) => {
    studyItems.push({
      type: 'course',
      id: course.id,
      name: course.name,
      details: `AI Mentor: Online course work on ${course.platform}. Current Progress: ${course.progress}%. Keep learning!`,
      priorityScore: 7, // moderate baseline priority
    });
  });

  const sortedStudyItems = studyItems.sort((a, b) => b.priorityScore - a.priorityScore);

  // What each task actually received, so the deadline check afterwards can be
  // about scheduled reality rather than intent.
  const taskAllocation: { [taskId: string]: { title: string; minutes: number; weekdays: Set<number> } } = {};

  const collegeStart = timeToMin(routine.collegeTimings?.start || '09:00');
  const collegeEnd = timeToMin(routine.collegeTimings?.end || '16:00');
  const currentDayOfWeek = new Date().getDay();

  days.forEach((day) => {
    let blockIdCounter = 0;
    const occupiedIntervals: { start: number; end: number }[] = [];

    // A. College Class Timing Block (Monday - Friday) (Rule 6: always locked)
    if (day >= 1 && day <= 5) {
      schedule.push({
        id: `block-${day}-class-${blockIdCounter++}`,
        day,
        start: routine.collegeTimings?.start || '09:00',
        end: routine.collegeTimings?.end || '16:00',
        title: 'College Lectures',
        type: 'class',
        color: colors.class,
        details: 'Mandatory college academic lectures'
      });
      occupiedIntervals.push({ start: collegeStart, end: collegeEnd });
    }

    // B. Place Extracurricular Activities based on preferred timings
    activities.forEach((activity, index) => {
      // Rotate placement to avoid overloading one day
      if ((day + index) % 2 === 0) {
        let actStart = '17:00';
        let actEnd = '18:00';

        if (activity.preferredTimings === 'morning') {
          const wakeMin = timeToMin(routine.wakeTime || '06:00');
          actStart = minToTime(wakeMin + 30);
          actEnd = minToTime(wakeMin + 30 + activity.duration);
        } else if (activity.preferredTimings === 'evening') {
          actStart = minToTime(collegeEnd + 60); // 1 hr after college
          actEnd = minToTime(collegeEnd + 60 + activity.duration);
        } else {
          actStart = '16:30';
          actEnd = minToTime(990 + activity.duration);
        }

        schedule.push({
          id: `block-${day}-act-${activity.id}`,
          day,
          start: actStart,
          end: actEnd,
          title: activity.name,
          type: 'extracurricular',
          color: colors.extracurricular,
          details: `Activity priority: ${activity.priority}`
        });

        occupiedIntervals.push({ start: timeToMin(actStart), end: timeToMin(actEnd) });
      }
    });

    // C. Daily LeetCode/coding practice session (Rule 3 point 3)
    let leetcodeScheduled = false;
    routine.freeBlocks.forEach((freeBlock) => {
      if (leetcodeScheduled) return;
      const freeStart = timeToMin(freeBlock.start);
      const freeEnd = timeToMin(freeBlock.end);
      const unoccupiedSegments = getUnoccupiedSegments(freeStart, freeEnd, occupiedIntervals);
      
      for (const segment of unoccupiedSegments) {
        const segStart = segment.start;
        const segEnd = segment.end;
        if (segEnd - segStart >= 45) {
          const leetcodeEnd = segStart + 45;
          schedule.push({
            id: `block-${day}-leetcode`,
            day,
            start: minToTime(segStart),
            end: minToTime(leetcodeEnd),
            title: 'Solve 1 LeetCode Problem',
            type: 'study',
            color: colors.study,
            details: 'AI Mentor: Daily coding practice keeps your technical problem-solving sharp. Solve at least 1 problem!'
          });
          occupiedIntervals.push({ start: segStart, end: leetcodeEnd });
          leetcodeScheduled = true;
          break;
        }
      }
    });

    if (!leetcodeScheduled) {
      const sleepMin = timeToMin(routine.sleepTime || '22:00');
      const startMin = Math.min(1200, sleepMin - 60);
      const endMin = startMin + 45;
      schedule.push({
        id: `block-${day}-leetcode-fallback`,
        day,
        start: minToTime(startMin),
        end: minToTime(endMin),
        title: 'Solve 1 LeetCode Problem',
        type: 'study',
        color: colors.study,
        details: 'AI Mentor: Daily coding practice. Maintain your study streak!'
      });
      occupiedIntervals.push({ start: startMin, end: endMin });
    }

    // D. Daily Study blocks in Free slots
    const wakeMin = timeToMin(routine.wakeTime || '06:00');
    const sleepMin = timeToMin(routine.sleepTime || '22:00');
    const totalAwake = sleepMin - wakeMin;
    const classMins = (day >= 1 && day <= 5) ? (collegeEnd - collegeStart) : 0;
    const availableMins = totalAwake - classMins;
    
    // Daily study limit (Rule 5: available hours after class * 0.75)
    const maxStudyMins = Math.floor(availableMins * 0.75);
    let dayStudyMins = 45; // baseline starting with LeetCode
    let studyBlocksScheduled = 0;

    routine.freeBlocks.forEach((freeBlock) => {
      const freeStart = timeToMin(freeBlock.start);
      const freeEnd = timeToMin(freeBlock.end);
      const unoccupiedSegments = getUnoccupiedSegments(freeStart, freeEnd, occupiedIntervals);

      unoccupiedSegments.forEach((segment) => {
        let segStart = segment.start;
        const segEnd = segment.end;
        let duration = segEnd - segStart;

        while (duration >= 30 && dayStudyMins < maxStudyMins) {
          const isTodayOrTomorrow = day === currentDayOfWeek || day === (currentDayOfWeek + 1) % 7;
          const isNext1To2Days = day === (currentDayOfWeek + 1) % 7 || day === (currentDayOfWeek + 2) % 7;

          let blockTitle = '';
          let blockDetails = '';
          let blockDuration = 60;
          let blockSubCode = '';
          let blockTaskId = '';
          let blockTaskTitle = '';

          // 1. Rule 3: URGENT Tasks due within 24 hours -> schedule immediately today
          if (isTodayOrTomorrow && urgentTasks.length > 0) {
            const t = urgentTasks[0];
            blockTitle = `Study: ${t.title}`;
            blockDuration = Math.min(duration, t.estimatedMinutes || 60);
            blockDetails = `Urgent Task: Due in 24 hours. Maintain focus!`;
            blockTaskId = t.id;
            blockTaskTitle = t.title;
            blockSubCode = subjects.find(s => s.id === t.subjectId)?.code || '';

            if (!insights.some(ins => ins.includes(t.title))) {
              insights.push(`Scheduled "${t.title}" first — it is urgent and due in 24 hours.`);
            }
            urgentTasks.shift();
          }
          // 2. Rule 3: HIGH Tasks due within 3 days -> schedule in the next 1-2 days
          else if (isNext1To2Days && highTasks.length > 0) {
            const t = highTasks[0];
            blockTitle = `Study: ${t.title}`;
            blockDuration = Math.min(duration, t.estimatedMinutes || 60);
            blockDetails = `High Priority Task: Due in 3 days. Focus!`;
            blockTaskId = t.id;
            blockTaskTitle = t.title;
            blockSubCode = subjects.find(s => s.id === t.subjectId)?.code || '';

            if (!insights.some(ins => ins.includes(t.title))) {
              insights.push(`Scheduled "${t.title}" — high priority task due in next few days.`);
            }
            highTasks.shift();
          }
          // 3. Rule 3: MEDIUM Tasks / leftover items
          else if (mediumTasks.length > 0) {
            const t = mediumTasks[0];
            blockTitle = `Study: ${t.title}`;
            blockDuration = Math.min(duration, t.estimatedMinutes || 60);
            blockDetails = `Milestone Study: ${t.title}`;
            blockTaskId = t.id;
            blockTaskTitle = t.title;
            blockSubCode = subjects.find(s => s.id === t.subjectId)?.code || '';
            mediumTasks.shift();
          }
          // 4. Rotating subjects based on credits/difficulty weights (Rule 5)
          else {
            const nextItem = sortedStudyItems[studyBlocksScheduled % Math.max(1, sortedStudyItems.length)];
            if (nextItem) {
              blockTitle = nextItem.type === 'subject' ? `Study: ${nextItem.name}` : `Course: ${nextItem.name}`;
              // Hard subjects get longer contiguous focus blocks (Rule 5)
              blockDuration = nextItem.difficulty === 'Hard' ? 90 : 60;
              blockDetails = nextItem.details;
              blockSubCode = nextItem.code || '';
              
              studyBlocksScheduled++;
            } else {
              break;
            }
          }

          blockDuration = Math.min(blockDuration, duration, maxStudyMins - dayStudyMins);
          if (blockDuration < MIN_FOCUS_MINUTES) break;

          // Lay the work out as Pomodoro rounds rather than one long block: a
          // focus session, a short break, and a long break once the student has
          // done a full cycle. Same lengths the Zen timer uses.
          const rounds = Math.max(1, Math.ceil(blockDuration / pomo.focusMinutes));
          let cursor = segStart;
          let placedFocus = 0;
          let roundsPlaced = 0;

          while (placedFocus < blockDuration && cursor < segEnd) {
            const focusLength = Math.min(pomo.focusMinutes, blockDuration - placedFocus, segEnd - cursor);
            if (focusLength < MIN_FOCUS_MINUTES) break;

            const focusEnd = cursor + focusLength;
            roundsPlaced += 1;

            schedule.push({
              id: `block-${day}-study-${blockIdCounter++}`,
              day,
              start: minToTime(cursor),
              end: minToTime(focusEnd),
              title: rounds > 1 ? `${blockTitle} (${roundsPlaced}/${rounds})` : blockTitle,
              type: 'study',
              color: colors.study,
              subjectCode: blockSubCode,
              details: blockDetails,
              isSession: true
            });

            occupiedIntervals.push({ start: cursor, end: focusEnd });
            placedFocus += focusLength;
            dayStudyMins += focusLength;
            cursor = focusEnd;

            if (blockTaskId) {
              const entry = taskAllocation[blockTaskId] || { title: blockTaskTitle, minutes: 0, weekdays: new Set<number>() };
              entry.minutes += focusLength;
              entry.weekdays.add(day);
              taskAllocation[blockTaskId] = entry;
            }

            // No trailing break: the run is over, or the day's budget is spent.
            if (placedFocus >= blockDuration || dayStudyMins >= maxStudyMins) break;

            const isLongBreak = roundsPlaced % pomo.roundsBeforeLongBreak === 0;
            const breakLength = isLongBreak ? pomo.longBreakMinutes : pomo.shortBreakMinutes;

            // Only insert a break if the work after it still fits.
            if (segEnd - cursor < breakLength + MIN_FOCUS_MINUTES) break;

            const breakEnd = cursor + breakLength;
            schedule.push({
              id: `block-${day}-break-${blockIdCounter++}`,
              day,
              start: minToTime(cursor),
              end: minToTime(breakEnd),
              title: isLongBreak ? 'Long break' : 'Short break',
              type: 'break',
              color: colors.break,
              details: isLongBreak
                ? `A full cycle of ${pomo.roundsBeforeLongBreak} focus rounds is done — step away properly.`
                : 'Stand up, look away from the screen, drink some water.',
              isSession: true
            });

            occupiedIntervals.push({ start: cursor, end: breakEnd });
            cursor = breakEnd;
          }

          // Nothing fit: stop rather than spinning on the same segment.
          if (placedFocus === 0) break;

          segStart = cursor;
          duration = segEnd - segStart;
        }
      });
    });

    // Saturday & Sunday course/prep blocks
    if (day === 6) { // Saturday
      courses.slice(0, 2).forEach((course, index) => {
        schedule.push({
          id: `block-${day}-course-${course.id}`,
          day,
          start: index === 0 ? '10:00' : '14:00',
          end: index === 0 ? '12:00' : '16:00',
          title: `Course: ${course.name}`,
          type: 'study',
          color: colors.study,
          details: `Online course review on ${course.platform}. Current Progress: ${course.progress}%`
        });
      });
    } else if (day === 0) { // Sunday
      schedule.push({
        id: `block-0-prep`,
        day: 0,
        start: '16:00',
        end: '17:00',
        title: 'Weekly AI Recap & Planning',
        type: 'break',
        color: colors.break,
        details: 'Review study hours stats and set active goals for next week.'
      });
    }
  });

  // Deadline check. A plan that quietly gives a task less time than it needs is
  // worse than one that says so, so compare what each task actually received on
  // the days that fall before its deadline against what it was estimated to need.
  const currentDow = new Date().getDay();

  for (const task of activeTasks) {
    const daysLeft = getDaysUntil(task.deadline);
    if (daysLeft > 7) continue; // Beyond this week's plan; nothing to promise yet.

    const allocation = taskAllocation[task.id];
    const needed = task.estimatedMinutes || 60;

    if (daysLeft < 0) {
      insights.push(`"${task.title}" is past its deadline — reschedule it or mark it done.`);
      continue;
    }

    // Weekdays that actually occur between today and the deadline, inclusive.
    const reachableDays = new Set<number>();
    for (let i = 0; i <= Math.min(daysLeft, 6); i++) {
      reachableDays.add((currentDow + i) % 7);
    }

    const minutesInTime = allocation
      ? [...allocation.weekdays].filter((d) => reachableDays.has(d)).length > 0
        ? Math.round(
            (allocation.minutes * [...allocation.weekdays].filter((d) => reachableDays.has(d)).length) /
              allocation.weekdays.size
          )
        : 0
      : 0;

    if (minutesInTime === 0) {
      insights.push(
        `"${task.title}" is due in ${daysLeft === 0 ? 'under a day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`} but got no study time — free up a slot.`
      );
    } else if (minutesInTime < needed) {
      insights.push(
        `"${task.title}" needs about ${needed} min and only ${minutesInTime} min lands before its deadline.`
      );
    }
  }

  if (insights.length < 3) {
    insights.push(`Study time is laid out in ${pomo.focusMinutes}-minute focus rounds with ${pomo.shortBreakMinutes}-minute breaks.`);
    insights.push("Allocated college class hours as mandatory locked blocks.");
    insights.push("Balanced self-study slots around your extracurricular activities.");
  }

  return { schedule: resolveScheduleOverlaps(schedule), insights };
}

export function resolveScheduleOverlaps(schedule: TimetableBlock[]): TimetableBlock[] {
  // Helper to convert time string "HH:MM" to minutes from midnight
  const timeToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Helper to convert minutes to "HH:MM", clamped to the day rather than wrapped.
  const minToTime = (m: number) => {
    const clamped = Math.min(1439, Math.max(0, Math.floor(m)));
    const h = Math.floor(clamped / 60);
    const min = clamped % 60;
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  const getBlockPriority = (block: TimetableBlock, index: number) => {
    // 1. Mandatory university classes are highest priority
    if (block.type === 'class') {
      return 100000000 + index;
    }
    // 2. Custom or AI-added blocks (manually set times from chat/UI)
    const isCustom = block.id.startsWith('custom-block-') || block.id.startsWith('ai-block-') || block.id.startsWith('instant-block-');
    if (isCustom) {
      const match = block.id.match(/\d+/);
      const timestamp = match ? parseInt(match[0], 10) : 0;
      return 1000000 + (timestamp || index);
    }
    // 3. Extracurricular blocks
    if (block.type === 'extracurricular') {
      return 500000 + index;
    }
    // 4. Default flexible study and break blocks (lowest priority)
    return index;
  };

  const adjustBlockAgainstOccupied = (
    block: TimetableBlock,
    occupied: { start: number; end: number }[]
  ): TimetableBlock[] => {
    let segments = [{ start: timeToMin(block.start), end: timeToMin(block.end) }];

    occupied.forEach((occ) => {
      const nextSegments: { start: number; end: number }[] = [];
      segments.forEach((seg) => {
        if (occ.end <= seg.start || occ.start >= seg.end) {
          // No overlap
          nextSegments.push(seg);
        } else {
          // Overlap: shrink or split
          if (occ.start > seg.start) {
            nextSegments.push({ start: seg.start, end: occ.start });
          }
          if (occ.end < seg.end) {
            nextSegments.push({ start: occ.end, end: seg.end });
          }
        }
      });
      segments = nextSegments;
    });

    // The 10-minute floor exists to drop useless slivers left behind by a split.
    // A block that came through untouched is kept whatever its length —
    // otherwise a 5-minute Pomodoro break gets deleted and the timetable shows
    // an unexplained gap where the break should be.
    const original = { start: timeToMin(block.start), end: timeToMin(block.end) };
    const untouched = (seg: { start: number; end: number }) =>
      seg.start === original.start && seg.end === original.end;

    return segments
      .filter((seg) => untouched(seg) || seg.end - seg.start >= 10)
      .map((seg, idx) => ({
        ...block,
        id: idx === 0 ? block.id : `${block.id}-split-${idx}`,
        start: minToTime(seg.start),
        end: minToTime(seg.end),
      }));
  };

  const adjustedSchedule: TimetableBlock[] = [];

  // Group by day (0-6)
  for (let day = 0; day <= 6; day++) {
    const dayBlocks = schedule.filter(b => b.day === day);
    
    // Sort all blocks of the day by priority descending
    const sortedBlocks = dayBlocks
      .map((block, index) => ({ block, priority: getBlockPriority(block, index) }))
      .sort((a, b) => b.priority - a.priority);

    const occupiedIntervals: { start: number; end: number }[] = [];

    sortedBlocks.forEach(({ block }) => {
      const segments = adjustBlockAgainstOccupied(block, occupiedIntervals);
      segments.forEach((seg) => {
        adjustedSchedule.push(seg);
        occupiedIntervals.push({
          start: timeToMin(seg.start),
          end: timeToMin(seg.end)
        });
      });
    });
  }

  // Sort final schedule by day then start time
  return adjustedSchedule.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.start.localeCompare(b.start);
  });
}
