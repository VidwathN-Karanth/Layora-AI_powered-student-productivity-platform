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

    const systemPrompt = `You are the central Academic Planning Engine for the student's Layora dashboard. You have direct control over their tasks and timetable.

Here is the student's complete academic context:
- Subjects (with credits, priority, and difficulty): ${JSON.stringify(currentSubjects || [])}
- Active Tasks (with deadlines and completion status): ${JSON.stringify(currentTasks || [])}
- Routine constraints (wake, sleep, college times): ${JSON.stringify(currentRoutine || {})}
- Current Timetable: ${JSON.stringify(currentSchedule || [])}

You must ALWAYS respond with a valid JSON object matching this schema:
{
  "reply": "Your markdown-formatted conversational response to the student.",
  "actions": [
    // Array of action objects to execute based on the user's request. Leave empty if no action is needed.
  ]
}

Supported Actions:
1. ADD_TASK
   {"action": "ADD_TASK", "data": {"title": "Task Title", "deadline": "YYYY-MM-DD", "estimatedMinutes": 60, "subjectId": "sub-id"}}
2. UPDATE_TASK
   {"action": "UPDATE_TASK", "data": {"taskId": "...", "title": "...", "estimatedMinutes": 90}}
3. REMOVE_TASK
   {"action": "REMOVE_TASK", "data": {"taskId": "..."}}
4. COMPLETE_TASK
   {"action": "COMPLETE_TASK", "data": {"taskId": "..."}}
5. CREATE_STUDY_BLOCK
   {"action": "CREATE_STUDY_BLOCK", "data": {"day": 1, "start": "14:00", "end": "15:00", "title": "Study Block", "type": "study"}}
6. REBALANCE_SCHEDULE
   {"action": "REBALANCE_SCHEDULE", "data": {}}

Rules:
- When a user asks to add, remove, complete, or edit a task, ALWAYS output the corresponding action.
- When the schedule needs to be optimized or rebalanced due to a change, output REBALANCE_SCHEDULE.
- Your response MUST be parseable JSON. Do not include markdown \`\`\`json wrappers. Just output the raw JSON object.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        response_format: { type: "json_object" },
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
        reply: JSON.stringify({ reply: 'Remote Groq service error.', actions: [] })
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
