import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { 
      message, 
      history, 
      currentSchedule, 
      currentTasks, 
      currentSubjects, 
      currentRoutine 
    } = await req.json();

    const systemPrompt = `You are an elite academic co-pilot for college students. Answer with markdown formatting.

You have the capability to directly manage the student's tasks and weekly timetable. Here is their current configuration:
- Active subjects: ${JSON.stringify(currentSubjects || [])}
- Active tasks: ${JSON.stringify(currentTasks || [])}
- Routine constraints: ${JSON.stringify(currentRoutine || {})}
- Current timetable schedule: ${JSON.stringify(currentSchedule || [])}

If the student asks you to add a task, schedule something new, or optimize the timetable based on priorities:
1. To create the new task card, append at the end:
   [CREATE_TASK:{"title":"Task Title","deadline":"YYYY-MM-DD","estimatedMinutes":60}]
   
2. To reschedule or insert this task as a study block in between others (shifting/editing the times accordingly):
   Rearrange the current timetable schedule array, inserting a new study block for this task, adjusting start/end times of other study blocks or breaks if needed. Keep fixed classes and activities as they are.
   Then append the entire updated schedule block array at the end of your response inside this command:
   [REPLACE_TIMETABLE:[{"id":"block-id","day":1,"start":"HH:MM","end":"HH:MM","title":"Block Title","type":"study","color":"border-l-4 border-purple-500 bg-purple-950/20 text-purple-200","details":"details"},...]]
   
   Ensure that the colors match:
   - class: border-l-4 border-cyan-500 bg-cyan-950/20 text-cyan-200
   - study: border-l-4 border-purple-500 bg-purple-950/20 text-purple-200
   - extracurricular: border-l-4 border-pink-500 bg-pink-950/20 text-pink-200
   - break: border-l-4 border-emerald-500 bg-emerald-950/20 text-emerald-200

Ensure the JSON within the commands is on a single line and has no newlines. You can output multiple command tags if needed.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map((h: any) => ({ 
            role: h.role === 'assistant' ? 'assistant' : 'user', 
            content: h.content 
          })),
          { role: 'user', content: message }
        ],
      }),
    });

    if (groqRes.ok) {
      const data = await groqRes.json();
      return NextResponse.json({ reply: data.choices[0].message.content });
    } else {
      const errText = await groqRes.text();
      console.error('Groq API call failed:', errText);
      return NextResponse.json({ 
        reply: 'I received your message, but the remote Groq service returned an error. Please try again later.' 
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
