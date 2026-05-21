import { NextRequest, NextResponse } from 'next/server';
import { generateLocalWeeklySchedule } from '@/lib/aiService';

export async function POST(req: NextRequest) {
  try {
    const { keys, routine, subjects, activities, courses } = await req.json();

    // Default provider for planner is gemini or openai
    const provider = keys?.openai ? 'openai' : (keys?.gemini ? 'gemini' : 'local');
    const activeKey = keys?.[provider] || process.env[provider.toUpperCase() + '_API_KEY'];

    if (!activeKey || provider === 'local') {
      // Execute local optimizer instantly
      const localSchedule = generateLocalWeeklySchedule(routine, subjects, activities, courses);
      return NextResponse.json({ schedule: localSchedule });
    }

    const promptText = `
      You are an expert student productivity schedule planner. Generate a balanced weekly study schedule in JSON format based on the following student configuration:
      Wake time: ${routine.wakeTime}
      Sleep time: ${routine.sleepTime}
      College class hours: ${routine.collegeTimings.start} to ${routine.collegeTimings.end} (Monday - Friday)
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

    if (provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: 'application/json' }
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(rawJsonText);
        if (parsed.schedule) {
          return NextResponse.json({ schedule: parsed.schedule });
        }
      }
    }

    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You plan optimized weekly study timetables in JSON format.' },
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
      }
    }

    // Default fallback to local scheduler
    const fallbackSchedule = generateLocalWeeklySchedule(routine, subjects, activities, courses);
    return NextResponse.json({ schedule: fallbackSchedule });

  } catch (error: any) {
    // Graceful error fallback
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
