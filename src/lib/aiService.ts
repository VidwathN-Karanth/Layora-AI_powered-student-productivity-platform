// AI Integration & Planner Logic Service

export interface AIKeys {
  groq?: string;
  openai?: string;
  claude?: string;
  grok?: string;
}

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
  tasks?: Task[]
): { schedule: TimetableBlock[]; insights: string[] } {
  const schedule: TimetableBlock[] = [];
  const days = [1, 2, 3, 4, 5, 6, 0]; // Monday to Saturday (rest on Sunday by default)
  const insights: string[] = [];

  const timeToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minToTime = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const min = Math.floor(m % 60);
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

          // 1. Rule 3: URGENT Tasks due within 24 hours -> schedule immediately today
          if (isTodayOrTomorrow && urgentTasks.length > 0) {
            const t = urgentTasks[0];
            blockTitle = `Study: ${t.title}`;
            blockDuration = Math.min(duration, t.estimatedMinutes || 60);
            blockDetails = `Urgent Task: Due in 24 hours. Maintain focus!`;
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
          if (blockDuration < 15) break;

          const blockEnd = segStart + blockDuration;
          schedule.push({
            id: `block-${day}-study-${blockIdCounter++}`,
            day,
            start: minToTime(segStart),
            end: minToTime(blockEnd),
            title: blockTitle,
            type: 'study',
            color: colors.study,
            subjectCode: blockSubCode,
            details: blockDetails
          });

          dayStudyMins += blockDuration;
          occupiedIntervals.push({ start: segStart, end: blockEnd });

          // Rule 3: Insert a 15-min break after 90 minutes of study
          if (blockDuration >= 90 && (duration - blockDuration) >= 30 && dayStudyMins < maxStudyMins) {
            const breakEnd = blockEnd + 15;
            schedule.push({
              id: `block-${day}-break-${blockIdCounter++}`,
              day,
              start: minToTime(blockEnd),
              end: minToTime(breakEnd),
              title: 'Power Rest & Hydrate',
              type: 'break',
              color: colors.break,
              details: 'AI recommended break to optimize focus and prevent cognitive burnout.'
            });

            if (insights.filter(ins => ins.includes("Added a break")).length < 2) {
              insights.push(`Added a break at ${minToTime(blockEnd)} — you've been studying for 90 minutes.`);
            }

            occupiedIntervals.push({ start: blockEnd, end: breakEnd });
            segStart = breakEnd;
          } else {
            segStart = blockEnd;
          }

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

  if (insights.length < 3) {
    insights.push("Allocated college class hours as mandatory locked blocks.");
    insights.push("Balanced self-study slots around your extracurricular activities.");
    insights.push("Synced algorithmic study blocks to ensure daily coding consistency.");
  }

  return { schedule: resolveScheduleOverlaps(schedule), insights };
}

export function resolveScheduleOverlaps(schedule: TimetableBlock[]): TimetableBlock[] {
  // Helper to convert time string "HH:MM" to minutes from midnight
  const timeToMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Helper to convert minutes to "HH:MM"
  const minToTime = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const min = Math.floor(m % 60);
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

    // Keep segments at least 10 minutes long to avoid tiny, useless blocks
    return segments
      .filter((seg) => seg.end - seg.start >= 10)
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

// Client service request coordinators
export async function generateAISchedule(
  keys: AIKeys,
  routine: Routine,
  subjects: Subject[],
  activities: Activity[],
  courses: Course[],
  tasks?: Task[]
): Promise<{ schedule: TimetableBlock[]; insights: string[] }> {
  try {
    const response = await fetch('/api/ai/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, routine, subjects, activities, courses, tasks }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.schedule) {
        return {
          schedule: resolveScheduleOverlaps(data.schedule),
          insights: data.insights || []
        };
      }
    }
  } catch (error) {
    console.error('Failed to request remote AI planner schedule. Using local optimizer.', error);
  }

  // Fallback to local scheduling logic
  return generateLocalWeeklySchedule(routine, subjects, activities, courses, tasks);
}

export async function sendAIChatMessage(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  provider: 'groq' | 'openai' | 'claude' | 'grok',
  keys: AIKeys,
  context?: any
): Promise<string> {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, provider, keys, ...context }),
    });


    if (response.ok) {
      const data = await response.json();
      if (data.reply) return data.reply;
    }
  } catch (error) {
    console.error('Failed to send remote AI chat request. Using realistic local planner fallback replies.', error);
  }

  // Fallback realistic mock AI chatbot response
  return new Promise((resolve) => {
    setTimeout(() => {
      const userMessageLower = message.toLowerCase();
      
      let reply = `Greetings! As your AI academic co-pilot, I'm here to help you optimize your studies. Under my settings panel, you can provide an active **${provider.toUpperCase()} API Key** to connect to live models. \n\nCurrently, here are a few actionable suggestions based on your routine:\n`;

      if (userMessageLower.includes('schedule') || userMessageLower.includes('timetable') || userMessageLower.includes('plan')) {
        reply += `1. **Credit Allocation**: Make sure you allocate study blocks right after your college lectures when your mind is primed for learning.\n2. **Break Optimizations**: Try using the Pomodoro technique (45 minutes of deep focus followed by 10 minutes of rest) for your Hard subjects.\n3. **Streak Tracking**: Maintain your daily task completion streak to unlock positive momentum! Let me know if you want to generate a new optimized week schedule in the planner.`;
      } else if (userMessageLower.includes('exam') || userMessageLower.includes('test') || userMessageLower.includes('deadline')) {
        reply += `1. **Spaced Repetition**: Revise your subject notes 1 day, 3 days, and 7 days after uploading them.\n2. **High Priority Filter**: Your high-credit subjects should receive priority blocks on weekends. Use the timer tool to track actual study minutes so you can balance study vs. test performance in the analytics tracker.`;
      } else {
        reply += `1. **Start Task Timer**: When starting a study block, click the **Start** button on your task card to track your actual study hours.\n2. **Google Calendar**: You can sync your planned study blocks to your Google Calendar using the "Sync to Google Calendar" button.\n3. **Study Resource Uploads**: Go to the resources dashboard to organize PPTs and PDFs for easy revision. What subject are we focusing on today?`;
      }
      resolve(reply);
    }, 1500);
  });
}
