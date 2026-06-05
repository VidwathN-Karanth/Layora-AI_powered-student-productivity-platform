import { NextRequest, NextResponse } from 'next/server';
import { generateLocalWeeklySchedule } from '@/lib/aiService';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function POST(req: NextRequest) {
  let routine: any = null;
  let subjects: any = [];
  let activities: any = [];
  let courses: any = [];
  let tasks: any = [];

  try {
    const body = await req.json();
    routine = body.routine;
    subjects = body.subjects;
    activities = body.activities;
    courses = body.courses;
    tasks = body.tasks;

    const promptText = `
      You are an expert student productivity schedule planner and academic mentor. Generate a highly optimized, balanced weekly study schedule in JSON format based on the following student configuration:
      Wake time: ${routine.wakeTime}
      Sleep time: ${routine.sleepTime}
      College class hours: ${routine.collegeTimings?.start} to ${routine.collegeTimings?.end} (Monday - Friday)
      Subjects (allocate weekly study sessions depending on credits, priority, and difficulty): ${JSON.stringify(subjects)}
      Extracurricular Activities: ${JSON.stringify(activities)}
      Active Online Courses: ${JSON.stringify(courses)}
      Free blocks specified by the user: ${JSON.stringify(routine.freeBlocks)}
      Active Tasks checklist & deadlines (incorporate these into specific study slots): ${JSON.stringify(tasks || [])}

      Scheduling Priorities & Rules:
      1. IMPORTANCE ALIGNMENT: Allocate study blocks by thinking about subject importance. High credit value, High priority, and Hard difficulty subjects must get more frequent and longer study blocks (e.g. 90-120 minutes of contiguous deep study). Easy and Low priority subjects get fewer and shorter slots.
      2. ONLINE COURSES: You MUST explicitly schedule study/learning blocks for the active online courses from the list of courses. Give them at least 1-2 dedicated blocks throughout the week.
      3. DAILY LEETCODE/CODING PRACTICE: You MUST schedule exactly one study block EVERY DAY (Monday through Sunday) for "Solve 1 LeetCode Problem" (or general algorithmic/technical practice) of type "study". Place it in the student's free times or evening slots (e.g. for 30-45 minutes).
      4. PERSONALIZED MENTOR TIPS: Write an encouraging, helpful, personalized mentor-style tip in the "details" field of each study block (e.g. "Solve today's LeetCode daily challenge!", "Focus on high-yield exam topics for Math", "Take a short walk to refresh your cognitive focus").
      5. RULE 3 PRIORITY ORDER: Focus session blocks should prioritize:
         - URGENT tasks (deadline in <= 24 hours) must be scheduled immediately today.
         - HIGH tasks (deadline in <= 3 days) must be scheduled in next 1-2 days.
         - MEDIUM tasks/subjects with low recent study hours fill remaining slots.
         - LOW review/revision sessions fill leftover time.
      6. RULE 5 SMART TIME ALLOCATION: Hard subjects (Math, DSA, Physics) get morning or early evening slots. Never schedule > 3 hours contiguous study without a break. Daily study hours must not exceed: (available hours after classes) * 0.75.
      7. RULE 4 DEFAULT TEMPLATE: If no subjects and tasks are set up, populate the schedule using this pattern:
         - 9:00 AM class hours (locked), 4:00 PM Break (30 min), 5:00 PM Study Block 1 (review lecture notes, 60 min), 6:30 PM Study Block 2 (work on pending assignment, 60 min), 8:00 PM Night self-study. Include the advice: "Add your subjects and tasks so I can personalize this further."

      Follow this exact JSON structure:
      {
        "schedule": [
          {
            "id": "unique-block-string",
            "day": 1, // 1 = Monday, 2 = Tuesday, ... 6 = Saturday, 0 = Sunday
            "start": "HH:MM",
            "end": "HH:MM",
            "title": "Study: [Subject Name]" or "Course: [Course Name]" or "Solve 1 LeetCode Problem" or "[Activity Name]" or "[Break Title]" or "Study: [Task Title]",
            "type": "class" | "study" | "extracurricular" | "break",
            "color": "border-l-4 border-primary bg-primary-fixed text-on-surface" (use cyan/secondary for class, purple/primary for study, pink for extracurricular, emerald/green for break),
            "subjectCode": "optional course code",
            "details": "encouraging personalized mentor tip/advice"
          }
        ],
        "insights": [
          // Rule 8: Dynamic planning guide explanations explaining your scheduling decisions briefly (e.g., "Scheduled DSA first — it's your hardest subject and due in 2 days.", "Added a break at 6:30 PM — you've been studying for 90 minutes.")
        ]
      }
    `;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You plan optimized weekly study timetables in JSON format. Always return valid JSON containing the schedule array and insights array.' },
          { role: 'user', content: promptText }
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      if (parsed.schedule) {
        return NextResponse.json({ schedule: parsed.schedule, insights: parsed.insights || [] });
      }
    } else {
      const errText = await response.text();
      console.error('Groq planner API call failed:', errText);
    }

    // Default fallback to local scheduler if API fails
    const fallbackResult = generateLocalWeeklySchedule(routine, subjects, activities, courses, tasks);
    return NextResponse.json({ schedule: fallbackResult.schedule, insights: fallbackResult.insights });

  } catch (error: any) {
    console.error('Error generating AI schedule:', error);
    try {
      const fallbackResult = generateLocalWeeklySchedule(routine, subjects, activities, courses, tasks);
      return NextResponse.json({ schedule: fallbackResult.schedule, insights: fallbackResult.insights });
    } catch (innerError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
}
