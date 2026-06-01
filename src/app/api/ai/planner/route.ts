import { NextRequest, NextResponse } from 'next/server';
import { generateLocalWeeklySchedule } from '@/lib/aiService';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function POST(req: NextRequest) {
  let routine: any = null;
  let subjects: any = [];
  let activities: any = [];
  let courses: any = [];

  try {
    const body = await req.json();
    routine = body.routine;
    subjects = body.subjects;
    activities = body.activities;
    courses = body.courses;


    const promptText = `
      You are an expert student productivity schedule planner and academic mentor. Generate a highly optimized, balanced weekly study schedule in JSON format based on the following student configuration:
      Wake time: ${routine.wakeTime}
      Sleep time: ${routine.sleepTime}
      College class hours: ${routine.collegeTimings?.start} to ${routine.collegeTimings?.end} (Monday - Friday)
      Subjects (allocate weekly study sessions depending on credits, priority, and difficulty): ${JSON.stringify(subjects)}
      Extracurricular Activities: ${JSON.stringify(activities)}
      Active Online Courses: ${JSON.stringify(courses)}
      Free blocks specified by the user: ${JSON.stringify(routine.freeBlocks)}

      Scheduling Priorities & Rules:
      1. IMPORTANCE ALIGNMENT: Allocate study blocks by thinking about subject importance. High credit value, High priority, and Hard difficulty subjects must get more frequent and longer study blocks (e.g. 90-120 minutes of contiguous deep study). Easy and Low priority subjects get fewer and shorter slots.
      2. ONLINE COURSES: You MUST explicitly schedule study/learning blocks for the active online courses from the list of courses. Give them at least 1-2 dedicated blocks throughout the week.
      3. DAILY LEETCODE/CODING PRACTICE: You MUST schedule exactly one study block EVERY DAY (Monday through Sunday) for "Solve 1 LeetCode Problem" (or general algorithmic/technical practice) of type "study". Place it in the student's free times or evening slots (e.g. for 30-45 minutes).
      4. PERSONALIZED MENTOR TIPS: Write an encouraging, helpful, personalized mentor-style tip in the "details" field of each study block (e.g. "Solve today's LeetCode daily challenge!", "Focus on high-yield exam topics for Math", "Take a short walk to refresh your cognitive focus").

      Follow this exact JSON structure:
      {
        "schedule": [
          {
            "id": "unique-block-string",
            "day": 1, // 1 = Monday, 2 = Tuesday, ... 6 = Saturday, 0 = Sunday
            "start": "HH:MM",
            "end": "HH:MM",
            "title": "Study: [Subject Name]" or "Course: [Course Name]" or "Solve 1 LeetCode Problem" or "[Activity Name]" or "[Break Title]",
            "type": "class" | "study" | "extracurricular" | "break",
            "color": "border-l-4 border-primary bg-primary-fixed text-on-surface" (use cyan for class, purple for study, pink for extracurricular, emerald for break),
            "subjectCode": "optional course code",
            "details": "encouraging personalized mentor tip/advice"
          }
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

          { role: 'system', content: 'You plan optimized weekly study timetables in JSON format. Always return valid JSON containing the schedule array.' },
          { role: 'user', content: promptText }
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      if (parsed.schedule) {
        return NextResponse.json({ schedule: parsed.schedule });
      }
    } else {
      const errText = await response.text();
      console.error('Groq planner API call failed:', errText);
    }

    // Default fallback to local scheduler if API fails
    const fallbackSchedule = generateLocalWeeklySchedule(routine, subjects, activities, courses);
    return NextResponse.json({ schedule: fallbackSchedule });

  } catch (error: any) {
    console.error('Error generating AI schedule:', error);
    // Graceful error fallback to local scheduler
    try {
      const fallbackSchedule = generateLocalWeeklySchedule(routine, subjects, activities, courses);
      return NextResponse.json({ schedule: fallbackSchedule });
    } catch (innerError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
}
