import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentTasks, currentSubjects, currentRoutine } = await req.json();

    const systemPrompt = `You are the AI Academic Planning Engine and Student Mentor. Analyze the student's current workload, subjects, and routine, and provide proactive recommendations and personalized mentor advice.
Context:
- Subjects (difficulty and credits): ${JSON.stringify(currentSubjects || [])}
- Tasks (both active and completed with completion dates): ${JSON.stringify(currentTasks || [])}
- Routine: ${JSON.stringify(currentRoutine || {})}

IMPORTANT RULES FOR INSIGHTS:
You MUST surface at least one of these dynamic insights daily inside "mentorAdvice" or "workloadWarning" based on the student's actual task status and history:
1. Subject Gap Insight: If they haven't completed any study tasks/sessions for a subject in 3+ days, write: "You haven't studied [Subject Name] in [X] days. I've added it to today." (Look at task completion timestamps to deduce X. Default to 3 days if no recent record).
2. Upcoming Backlog Insight: If they have tasks due tomorrow/soon, write: "You have [Y] tasks due tomorrow. Your schedule is already set — stay on track!"
3. Weekly Consistency Insight: Summarize weekly wins: "You completed [Z] sessions this week. Great consistency!" (Count completed tasks with completedAt timestamps within the last 7 days).

Return a valid JSON object matching exactly this schema:
{
  "nextBestTask": "Title of the task they should start right now based on deadlines and difficulty",
  "urgentSubject": "Name of the subject needing most attention",
  "recommendedDuration": "Number of minutes they should focus for the next session (e.g. 45)",
  "workloadWarning": "A short sentence advising on their backlog (e.g., 'You have 3 heavy tasks due tomorrow. Start now.')",
  "mentorAdvice": "A warm, personal, highly tailored study tip and motivational coaching note. Suggest specific topics to study, encourage solving their daily LeetCode coding problem, or advise them to balance study hours with rest. Also include one of the required dynamic insights here."
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
