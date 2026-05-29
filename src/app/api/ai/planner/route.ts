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
      You are an expert student productivity schedule planner. Generate a balanced weekly study schedule in JSON format based on the following student configuration:
      Wake time: ${routine.wakeTime}
      Sleep time: ${routine.sleepTime}
      College class hours: ${routine.collegeTimings?.start} to ${routine.collegeTimings?.end} (Monday - Friday)
      Subjects (allocate weekly study sessions depending on credits & difficulty): ${JSON.stringify(subjects)}
      Extracurricular Activities: ${JSON.stringify(activities)}
      Active Online Courses: ${JSON.stringify(courses)}
      Free blocks specified by the user: ${JSON.stringify(routine.freeBlocks)}

      Follow this exact JSON structure:
      {
        "schedule": [
          {
            "id": "unique-block-string",
            "day": 1, // 1 = Monday, 2 = Tuesday, ... 6 = Saturday, 0 = Sunday
            "start": "HH:MM",
            "end": "HH:MM",
            "title": "Study: [Subject Name] or [Activity Name] or [Break Title]",
            "type": "class" | "study" | "extracurricular" | "break",
            "color": "border-l-4 border-purple-500 bg-purple-950/20 text-purple-200" (use cyan for class, purple for study, pink for extracurricular, emerald for break),
            "subjectCode": "optional course code",
            "details": "quick context/tip for student"
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
