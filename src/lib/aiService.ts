// AI Integration & Planner Logic Service

export interface AIKeys {
  openai?: string;
  gemini?: string;
  claude?: string;
  grok?: string;
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
}

// Local smart algorithm that prioritizes credits, optimizes timings, balances breaks, and schedules studies.
export function generateLocalWeeklySchedule(
  routine: Routine,
  subjects: Subject[],
  activities: Activity[],
  courses: Course[]
): TimetableBlock[] {
  const schedule: TimetableBlock[] = [];
  const days = [1, 2, 3, 4, 5, 6]; // Monday to Saturday (rest on Sunday by default)

  // 1. Sort subjects by priority and credits
  const sortedSubjects = [...subjects].sort((a, b) => {
    const priorityWeight = { High: 3, Medium: 2, Low: 1 };
    const scoreA = (priorityWeight[a.priority] || 2) * 5 + a.credits;
    const scoreB = (priorityWeight[b.priority] || 2) * 5 + b.credits;
    return scoreB - scoreA;
  });

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

  // Helper to subtract occupied intervals from a free interval to avoid overlap conflicts
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

    // Return segments that are at least 15 minutes long to be useful
    return segments.filter(seg => seg.end - seg.start >= 15);
  };

  const collegeStart = timeToMin(routine.collegeTimings?.start || '09:00');
  const collegeEnd = timeToMin(routine.collegeTimings?.end || '16:00');

  // Colors for matching elements
  const colors = {
    class: 'border-l-4 border-cyan-500 bg-cyan-950/20 text-cyan-200',
    study: 'border-l-4 border-purple-500 bg-purple-950/20 text-purple-200',
    extracurricular: 'border-l-4 border-pink-500 bg-pink-950/20 text-pink-200',
    break: 'border-l-4 border-emerald-500 bg-emerald-950/20 text-emerald-200',
  };

  days.forEach((day) => {
    let blockIdCounter = 0;
    const occupiedIntervals: { start: number; end: number }[] = [];

    // A. College Class Timing Block (Monday - Friday)
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
          actEnd = minToTime(990 + activity.duration); // Fix 1630 to 990
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

    // C. Study blocks in the Free time slots (filtering out conflicts with occupied times)
    let studyBlocksScheduled = 0;
    
    // Scan free blocks set by user
    routine.freeBlocks.forEach((freeBlock) => {
      const freeStart = timeToMin(freeBlock.start);
      const freeEnd = timeToMin(freeBlock.end);
      
      const unoccupiedSegments = getUnoccupiedSegments(freeStart, freeEnd, occupiedIntervals);

      unoccupiedSegments.forEach((segment) => {
        const segStart = segment.start;
        const segEnd = segment.end;
        const duration = segEnd - segStart;

        if (duration >= 45) {
          // We split free segments larger than 2 hours to suggest a rest break
          if (duration > 120) {
            // Study Session 1
            const s1End = segStart + 90; // 90 min study
            const nextSubject = sortedSubjects[studyBlocksScheduled % Math.max(1, sortedSubjects.length)];
            
            if (nextSubject) {
              schedule.push({
                id: `block-${day}-study-1-${blockIdCounter++}`,
                day,
                start: minToTime(segStart),
                end: minToTime(s1End),
                title: `Study: ${nextSubject.name}`,
                type: 'study',
                color: colors.study,
                subjectCode: nextSubject.code,
                details: `Review credits (${nextSubject.credits}) & assignments. Difficulty: ${nextSubject.difficulty}`
              });
              studyBlocksScheduled++;
            }

            // Break Session
            const breakEnd = s1End + 20; // 20 min break
            schedule.push({
              id: `block-${day}-break-${blockIdCounter++}`,
              day,
              start: minToTime(s1End),
              end: minToTime(breakEnd),
              title: 'Power Rest & Hydrate',
              type: 'break',
              color: colors.break,
              details: 'AI recommended break to optimize focus and prevent cognitive burnout.'
            });

            // Study Session 2
            const s2End = Math.min(segEnd, breakEnd + 90);
            const nextSubject2 = sortedSubjects[studyBlocksScheduled % Math.max(1, sortedSubjects.length)];
            if (nextSubject2 && (s2End - breakEnd) >= 45) {
              schedule.push({
                id: `block-${day}-study-2-${blockIdCounter++}`,
                day,
                start: minToTime(breakEnd),
                end: minToTime(s2End),
                title: `Study: ${nextSubject2.name}`,
                type: 'study',
                color: colors.study,
                subjectCode: nextSubject2.code,
                details: `Deep work on ${nextSubject2.name}. Priority: ${nextSubject2.priority}`
              });
              studyBlocksScheduled++;
            }
          } else {
            // Regular single study block
            const nextSubject = sortedSubjects[studyBlocksScheduled % Math.max(1, sortedSubjects.length)];
            if (nextSubject) {
              schedule.push({
                id: `block-${day}-study-single-${blockIdCounter++}`,
                day,
                start: minToTime(segStart),
                end: minToTime(segEnd),
                title: `Study: ${nextSubject.name}`,
                type: 'study',
                color: colors.study,
                subjectCode: nextSubject.code,
                details: `Focus block on credits (${nextSubject.credits}) course. Difficulty: ${nextSubject.difficulty}`
              });
              studyBlocksScheduled++;
            }
          }
        }
      });
    });

    // D. Sunday Schedule: Special focus on online courses and weekly goals reviews
    if (day === 6) {
      // Add online course review block on Saturday/Sunday
      courses.forEach((course, index) => {
        if (index < 2) { // limit to first 2 courses
          schedule.push({
            id: `block-${day}-course-${course.id}`,
            day: 0, // Sunday
            start: '10:00',
            end: '12:00',
            title: `Course: ${course.name}`,
            type: 'study',
            color: colors.study,
            details: `Online course review on ${course.platform}. Current Progress: ${course.progress}%`
          });
        }
      });

      // Weekly planning prep block
      schedule.push({
        id: `block-0-prep`,
        day: 0, // Sunday
        start: '16:00',
        end: '17:00',
        title: 'Weekly AI Recap & Planning',
        type: 'break',
        color: colors.break,
        details: 'Review study hours stats and set active goals for next week.'
      });
    }
  });

  return resolveScheduleOverlaps(schedule);
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

  const getUnoccupiedSegments = (start: number, end: number, occupied: { start: number; end: number }[]) => {
    let segments = [{ start, end }];
    
    occupied.forEach((occ) => {
      const nextSegments: { start: number; end: number }[] = [];
      segments.forEach((seg) => {
        if (occ.end <= seg.start || occ.start >= seg.end) {
          nextSegments.push(seg);
        } else {
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

    return segments.filter(seg => seg.end - seg.start >= 15);
  };

  const adjustedSchedule: TimetableBlock[] = [];

  // Group by day (0-6)
  for (let day = 0; day <= 6; day++) {
    const dayBlocks = schedule.filter(b => b.day === day);
    
    // Fixed blocks: class and extracurricular
    const fixedBlocks = dayBlocks.filter(b => b.type === 'class' || b.type === 'extracurricular');
    // Flexible blocks: study and break, sorted by start time
    const flexibleBlocks = dayBlocks
      .filter(b => b.type === 'study' || b.type === 'break')
      .sort((a, b) => a.start.localeCompare(b.start));

    const occupiedIntervals: { start: number; end: number }[] = [];

    // Push fixed blocks directly
    fixedBlocks.forEach((block) => {
      adjustedSchedule.push(block);
      occupiedIntervals.push({
        start: timeToMin(block.start),
        end: timeToMin(block.end)
      });
    });

    // Resolve overlaps for flexible blocks
    flexibleBlocks.forEach((block) => {
      const flexStart = timeToMin(block.start);
      const flexEnd = timeToMin(block.end);

      const unoccupied = getUnoccupiedSegments(flexStart, flexEnd, occupiedIntervals);
      
      if (unoccupied.length > 0) {
        // Sort unoccupied by duration descending to find the largest chunk
        const sortedSegments = [...unoccupied].sort((a, b) => (b.end - b.start) - (a.end - a.start));
        const bestSegment = sortedSegments[0];

        adjustedSchedule.push({
          ...block,
          start: minToTime(bestSegment.start),
          end: minToTime(bestSegment.end)
        });

        // Add this adjusted interval to occupied so subsequent blocks don't overlap it
        occupiedIntervals.push({
          start: bestSegment.start,
          end: bestSegment.end
        });
      }
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
  courses: Course[]
): Promise<TimetableBlock[]> {
  try {
    const response = await fetch('/api/ai/planner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, routine, subjects, activities, courses }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.schedule) return resolveScheduleOverlaps(data.schedule);
    }
  } catch (error) {
    console.error('Failed to request remote AI planner schedule. Using local optimizer.', error);
  }

  // Fallback to local scheduling logic
  return generateLocalWeeklySchedule(routine, subjects, activities, courses);
}

export async function sendAIChatMessage(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  provider: 'gemini' | 'openai' | 'claude' | 'grok',
  keys: AIKeys
): Promise<string> {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, provider, keys }),
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
