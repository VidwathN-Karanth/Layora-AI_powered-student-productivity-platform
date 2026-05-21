import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, history, provider, keys } = await req.json();

    const userKey = keys?.[provider];
    const serverKey = process.env[provider.toUpperCase() + '_API_KEY'];
    const activeKey = userKey || serverKey;

    if (!activeKey) {
      // Fallback simulated response
      const responses = [
        `That's a great question regarding your studies. To maximize comprehension, I suggest summarizing this concept in a single sentence, then teaching it back to me. Let's practice that!`,
        `Based on your current credit load, you might want to spend 30-40 minutes reviewing this topic tonight. Have you started tracking your study minutes using the task timer in the top-right corner?`,
        `Interesting problem! When dealing with this subject, breaking it down into smaller sub-tasks is key. Let's create a study checklist for this together. What specific part is causing you difficulty?`,
        `Maintaining your study streak is important, but preventing burnout is vital. Keep in mind that a quick 10-minute break after this study block will improve long-term memory retention.`
      ];
      const randomReply = responses[Math.floor(Math.random() * responses.length)];
      return NextResponse.json({ reply: `[Demo AI - ${provider.toUpperCase()}] ${randomReply}` });
    }

    // Provider Routing
    if (provider === 'openai') {
      const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an elite academic co-pilot for college students. Answer with markdown formatting.' },
            ...history.map((h: any) => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
          ],
        }),
      });
      if (openAiRes.ok) {
        const data = await openAiRes.json();
        return NextResponse.json({ reply: data.choices[0].message.content });
      }
    }

    if (provider === 'gemini') {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              ...history.map((h: any) => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }]
              })),
              { role: 'user', parts: [{ text: message }] }
            ],
            systemInstruction: { parts: [{ text: 'You are an elite academic co-pilot for college students. Answer with markdown formatting.' }] }
          }),
        }
      );
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        return NextResponse.json({ reply: data.candidates[0].content.parts[0].text });
      }
    }

    if (provider === 'claude') {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1024,
          system: 'You are an elite academic co-pilot for college students. Answer with markdown formatting.',
          messages: [
            ...history.map((h: any) => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
          ],
        }),
      });
      if (claudeRes.ok) {
        const data = await claudeRes.json();
        return NextResponse.json({ reply: data.content[0].text });
      }
    }

    // Default Fallback for grok or other errors
    return NextResponse.json({
      reply: `I received your message for provider **${provider}**, but could not complete the remote request. Please double-check your API key or network connection.`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
