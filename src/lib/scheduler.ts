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

/**
 * The block for one course the student added.
 *
 * This is the only thing Layora ever places on a planner by itself, and only at
 * the moment a course is added. Nothing regenerates the week, nothing invents
 * study or break blocks, and a block the student deletes stays deleted — the
 * planner is theirs.
 *
 * The slot is the first free hour from 10:00 at the weekend, which is when a
 * course actually gets watched; if both weekend days are full it falls back to
 * a weekday evening. Anything that still overlaps is nudged by
 * resolveScheduleOverlaps, which the planner runs anyway.
 */
export function courseBlockFor(course: Course, existing: TimetableBlock[]): TimetableBlock | null {
  if (!course || !course.id) return null;

  const minutes = Math.min(180, Math.max(60, Math.round((Number(course.weeklyGoal) || 1) * 60)));

  const toMin = (t: string) => {
    const [h, m] = String(t).split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  };
  const toTime = (m: number) => {
    const clamped = Math.min(1439, Math.max(0, Math.round(m)));
    return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
  };

  // Saturday and Sunday first, then weekday evenings.
  const attempts: { day: number; from: number; until: number }[] = [
    { day: 6, from: toMin('10:00'), until: toMin('20:00') },
    { day: 0, from: toMin('10:00'), until: toMin('20:00') },
    { day: 1, from: toMin('17:00'), until: toMin('22:00') },
    { day: 2, from: toMin('17:00'), until: toMin('22:00') },
    { day: 3, from: toMin('17:00'), until: toMin('22:00') },
    { day: 4, from: toMin('17:00'), until: toMin('22:00') },
    { day: 5, from: toMin('17:00'), until: toMin('22:00') },
  ];

  for (const attempt of attempts) {
    const onDay = (existing || [])
      .filter((b) => b.day === attempt.day)
      .map((b) => ({ start: toMin(b.start), end: toMin(b.end) }))
      .sort((a, b) => a.start - b.start);

    let cursor = attempt.from;
    for (const busy of onDay) {
      if (cursor + minutes <= busy.start) break;      // the gap before this block fits
      if (busy.end > cursor) cursor = busy.end;       // otherwise start after it
    }

    if (cursor + minutes <= attempt.until) {
      return {
        id: `block-${attempt.day}-course-${course.id}`,
        day: attempt.day,
        start: toTime(cursor),
        end: toTime(cursor + minutes),
        title: `Course: ${course.name}`,
        type: 'study',
        color: 'border-l-4 border-primary bg-primary-fixed text-on-surface',
        details: `${course.platform || 'Online course'} · ${Math.round(Number(course.progress) || 0)}% done`,
      };
    }
  }

  return null;
}

/** Whether this block was placed for a given course. Used when the course goes. */
export function isBlockForCourse(block: TimetableBlock, courseId: string): boolean {
  return typeof block.id === 'string' && block.id.endsWith(`-course-${courseId}`);
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
