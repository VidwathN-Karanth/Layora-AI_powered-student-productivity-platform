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
      currentRoutine,
      todayDayOfWeek,
      currentTime,
      todayDateString
    } = await req.json();

    const systemPrompt = `You are the central Academic Planning Engine for the student's Layora dashboard. You have direct control over their tasks and timetable.

Here is the student's complete academic context:
- Subjects (with credits, priority, and difficulty): ${JSON.stringify(currentSubjects || [])}
- Active Tasks (with deadlines and completion status): ${JSON.stringify(currentTasks || [])}
- Routine constraints (wake, sleep, college times): ${JSON.stringify(currentRoutine || {})}
- Current Timetable: ${JSON.stringify(currentSchedule || [])}
- Today's Day of Week: ${todayDayOfWeek} (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday)
- Current Time: ${currentTime}
- Today's Date: ${todayDateString}

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
   Note: For day: 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 0 = Sunday.
6. REMOVE_STUDY_BLOCK
   {"action": "REMOVE_STUDY_BLOCK", "data": {"blockId": "..."}}
7. REBALANCE_SCHEDULE
   {"action": "REBALANCE_SCHEDULE", "data": {}}

Rules:
- DIRECT ACTION EXECUTION: When a user types short requests like "gym from 4am to 5 am", "calculus 8 to 10pm", "remove task XYZ", or "remove gym block", you MUST understand their needs immediately and output the corresponding action (e.g. CREATE_STUDY_BLOCK, REMOVE_TASK, or REMOVE_STUDY_BLOCK) directly in the "actions" array. Do NOT ask for permission, do NOT ask "Would you like me to do that?", and do NOT wait for confirmation. Just directly include the action, and state in the "reply" that you have executed it.
  - If they ask to remove a milestone task: find its taskId in currentTasks and return REMOVE_TASK.
  - If they ask to remove a schedule/timetable block: find its id in currentSchedule and return REMOVE_STUDY_BLOCK.
  - If a task has a taskId starting with "task-from-block-", removing that task will automatically delete the block, and deleting the block will automatically delete the task.
- TASK-SCHEDULE DUALITY: Whenever the user asks you to add a task (e.g. "add a task to complete math homework" or "remind me to study algorithms"), you MUST output BOTH "ADD_TASK" (to add it to the milestones checklist) AND "CREATE_STUDY_BLOCK" (to instantly schedule a specific study block for it on the timetable). 
  - Think by yourself to find an optimal time block on today's or tomorrow's schedule (e.g. after college, or in their free blocks, like 18:00 to 19:30) and directly create the study block there. 
  - If they specify a time, use it. If not, pick a logical time. 
  - The title of the study block should be "Study: [Task Title]" or similar, and type should be "study".
- TIMETABLE RESOLUTION: The system's conflict resolver will automatically shrink or split overlapping items to accommodate new blocks, so you do not need to check for overlaps yourself. Simply place the requested block at the exact start and end times requested by the user. If the user doesn't specify a day, assume it's for today's day of week (${todayDayOfWeek}).
- TECHNICAL FIELD CO-PILOT THINKING: The student is in a technical field (Computer Science/Engineering/Math). Therefore, do NOT plan study blocks blindly:
  - Technical work (e.g., coding projects, mathematics exercises, algorithm implementations) requires deep concentration. Allocate contiguous, uninterrupted deep focus blocks (90-120 minutes) rather than small 30-minute blocks.
  - Position focus sessions during optimal hours (e.g. quiet mornings or dedicated evening focus slots).
  - Balance intense technical blocks with regular physical and mental rest breaks (e.g., gym, meditation, walk).
  - High difficulty / high credit subjects (like Advanced Calculus or Algorithms) must be prioritized.
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
