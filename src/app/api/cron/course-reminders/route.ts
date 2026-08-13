import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendCourseReminderMail } from '@/lib/mailService';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const customHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: this route must always be protected by CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET not set' }, { status: 500 });
  }
  const isAuthorized =
    (authHeader && authHeader === `Bearer ${cronSecret}`) ||
    (customHeader && customHeader === cronSecret);

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron Route - Course Reminders] Starting hourly scan for course reminders...');

    // 1. Fetch all user states from Supabase
    const { data: rows, error: fetchError } = await supabaseAdmin
      .from('user_states')
      .select('id, state');

    if (fetchError) {
      throw fetchError;
    }

    if (!rows || rows.length === 0) {
      console.log('[Cron Route - Course Reminders] No user states found.');
      return NextResponse.json({ success: true, message: 'No user states to process.' });
    }

    const processedUsers: string[] = [];
    const remindersSent: { userId: string; email: string; courseName: string }[] = [];

    // 2. Loop through each user state
    for (const row of rows) {
      const userId = row.id;
      const state = row.state as any;

      if (!state || !state.user || !state.courses || state.courses.length === 0) {
        continue;
      }

      const user = state.user;
      const userEmail = user.email;

      if (!userEmail) {
        continue;
      }

      const timezone = user.timezone || 'UTC';
      let currentHour: number;
      let todayStr: string;

      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        const partMap: Record<string, string> = {};
        parts.forEach(p => { partMap[p.type] = p.value; });
        currentHour = parseInt(partMap.hour, 10) % 24;
        todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
      } catch (err) {
        console.warn(`[Cron Route - Course Reminders] Invalid timezone "${timezone}" for user ${userEmail}. Defaulting to UTC.`, err);
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(new Date());
        const partMap: Record<string, string> = {};
        parts.forEach(p => { partMap[p.type] = p.value; });
        currentHour = parseInt(partMap.hour, 10) % 24;
        todayStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
      }

      let stateUpdated = false;
      const updatedCourses = [];

      for (const course of state.courses) {
        // If reminders not enabled for this course, skip
        if (!course.reminderEnabled) {
          updatedCourses.push(course);
          continue;
        }

        const reminderTime = course.reminderTime || '09:00';
        const [reminderHourStr] = reminderTime.split(':');
        const reminderHour = parseInt(reminderHourStr, 10);

        // Check if the current local hour matches the reminder hour
        const hourMatches = currentHour === reminderHour;

        // Check if reminder was already sent today
        const alreadySentToday = course.lastReminderSentDate === todayStr;

        if (hourMatches && !alreadySentToday) {
          // Trigger email send
          console.log(`[Cron Route - Course Reminders] Sending reminder to ${userEmail} for course "${course.name}" (Timezone: ${timezone}, Local Time: ${todayStr} ${currentHour}:00)`);
          
          const success = await sendCourseReminderMail({
            to: userEmail,
            subject: `📚 Time to study: ${course.name}`,
            courseName: course.name,
            progress: course.progress || 0,
            platform: course.platform || ''
          });

          if (success) {
            stateUpdated = true;
            remindersSent.push({
              userId,
              email: userEmail,
              courseName: course.name
            });
            updatedCourses.push({
              ...course,
              lastReminderSentDate: todayStr
            });
          } else {
            console.error(`[Cron Route - Course Reminders] Failed to send email reminder to ${userEmail} for course "${course.name}". NOT updating lastReminderSentDate.`);
            updatedCourses.push(course);
          }
        } else {
          updatedCourses.push(course);
        }
      }

      // 3. If there were updates, save them back to Supabase
      if (stateUpdated) {
        const updatedState = {
          ...state,
          courses: updatedCourses
        };

        const { error: updateError } = await supabaseAdmin
          .from('user_states')
          .update({
            state: updatedState,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error(`[Cron Route - Course Reminders] Failed to update state for user ${userId}:`, updateError.message);
        } else {
          processedUsers.push(userEmail);
        }
      }
    }

    return NextResponse.json({
      success: true,
      scannedCount: rows.length,
      sentCount: remindersSent.length,
      sentDetails: remindersSent,
      updatedUsers: processedUsers
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Cron Route - Course Reminders] Hourly cron route failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
