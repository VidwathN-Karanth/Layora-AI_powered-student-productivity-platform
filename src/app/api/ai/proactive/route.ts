import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { currentTasks, currentSubjects, currentRoutine } = await req.json();

    const systemPrompt = `You are the AI Academic Planning Engine and Student Mentor. Analyze the student's current workload, subjects, and routine, and provide proactive recommendations and personalized mentor advice.
Context:
- Subjects: ${JSON.stringify(currentSubjects || [])}
- Active Tasks: ${JSON.stringify(currentTasks || [])}
- Routine: ${JSON.stringify(currentRoutine || {})}

Return a valid JSON object matching exactly this schema:
{
  "nextBestTask": "Title of the task they should start right now based on deadlines and difficulty",
  "urgentSubject": "Name of the subject needing most attention",
  "recommendedDuration": "Number of minutes they should focus for the next session (e.g. 45)",
  "workloadWarning": "A short sentence advising on their backlog (e.g., 'You have 3 heavy tasks due tomorrow. Start now.')",
  "mentorAdvice": "A warm, personal, highly tailored study tip and motivational coaching note. Suggest specific topics to study, encourage solving their daily LeetCode coding problem, or advise them to balance study hours with rest."
}`;

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
          { role: 'user', content: 'Generate my dashboard recommendations.' }
        ],
      }),
    });

    if (groqRes.ok) {
      const data = await groqRes.json();
      return NextResponse.json(JSON.parse(data.choices[0].message.content));
    } else {
      return NextResponse.json({
        nextBestTask: "Select a pending task",
        urgentSubject: "Review Dashboard",
        recommendedDuration: 60,
        workloadWarning: "Keep consistent! Completing study blocks maintains your study streak.",
        mentorAdvice: "AI Mentor: Daily coding practice keeps your mind sharp! Don't forget to solve today's LeetCode practice session in your planner."
      });
    }

  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      nextBestTask: "Select a pending task",
      urgentSubject: "Review Dashboard",
      recommendedDuration: 60,
      workloadWarning: "System is running offline.",
      mentorAdvice: "AI Mentor: Ensure you balance your college lectures, online courses, and daily LeetCode coding practice to maximize productivity."
    }, { status: 500 });
  }
}
