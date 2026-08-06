import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendCourseReminderMail } from '@/lib/mailService';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Enforce security in production when CRON_SECRET is configured
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
      let userLocalDate: Date;

      try {
        const localTimeStr = new Date().toLocaleString('en-US', { timeZone: timezone });
        userLocalDate = new Date(localTimeStr);
      } catch (err) {
        console.warn(`[Cron Route - Course Reminders] Invalid timezone "${timezone}" for user ${userEmail}. Defaulting to UTC.`);
        const localTimeStr = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
        userLocalDate = new Date(localTimeStr);
      }

      const currentHour = userLocalDate.getHours();
      
      // Calculate YYYY-MM-DD in user's local timezone
      const year = userLocalDate.getFullYear();
      const month = String(userLocalDate.getMonth() + 1).padStart(2, '0');
      const date = String(userLocalDate.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${date}`;

      let stateUpdated = false;
      const updatedCourses = state.courses.map((course: any) => {
        // If reminders not enabled for this course, skip
        if (!course.reminderEnabled) {
          return course;
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
          
          sendCourseReminderMail({
            to: userEmail,
            subject: `📚 Time to study: ${course.name}`,
            courseName: course.name,
            progress: course.progress || 0,
            platform: course.platform || ''
          }).catch(mailErr => {
            console.error(`[Cron Route - Course Reminders] Async send error for ${userEmail}:`, mailErr);
          });

          stateUpdated = true;
          remindersSent.push({
            userId,
            email: userEmail,
            courseName: course.name
          });

          return {
            ...course,
            lastReminderSentDate: todayStr
          };
        }

        return course;
      });

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
