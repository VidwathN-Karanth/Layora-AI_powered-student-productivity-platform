import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendInactivityReminderMail, sendAdminNotificationMail } from '@/lib/mailService';

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const customHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;

  // Enforce security in production when CRON_SECRET is configured
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    const isAuthorized = 
      (authHeader && authHeader === `Bearer ${cronSecret}`) ||
      (customHeader && customHeader === cronSecret);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('[Cron Route - Inactivity Reminders] Starting daily scan for inactive users...');

    // 1. Fetch all user states from Supabase
    // We only need id, state, and updated_at
    const { data: rows, error: fetchError } = await supabaseAdmin
      .from('user_states')
      .select('id, state, updated_at');

    if (fetchError) {
      throw fetchError;
    }

    if (!rows || rows.length === 0) {
      console.log('[Cron Route - Inactivity Reminders] No user states found.');
      return NextResponse.json({ success: true, message: 'No user states to process.' });
    }

    const processedUsers: string[] = [];
    const remindersSent: { userId: string; email: string }[] = [];
    const now = new Date();

    // 2. Loop through each user state
    for (const row of rows) {
      const userId = row.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = row.state as any;
      const updatedAt = new Date(row.updated_at);

      if (!state || !state.user || !state.user.email) {
        continue;
      }

      const user = state.user;
      const userEmail = user.email;
      const userName = user.name || 'there';

      // Calculate the difference in days between now and when the user state was last updated
      const diffTime = Math.abs(now.getTime() - updatedAt.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      // We only target users who have been inactive for more than 7 days
      if (diffDays > 7) {
        // Check if we already sent a reminder for this inactivity period
        let shouldSend = false;
        
        if (!user.lastInactivityReminderSent) {
          shouldSend = true;
        } else {
          const lastSentDate = new Date(user.lastInactivityReminderSent);
          // If the last reminder was sent BEFORE their last activity, it means this is a new inactivity streak.
          if (lastSentDate < updatedAt) {
            shouldSend = true;
          }
        }

        if (shouldSend) {
          console.log(`[Cron Route - Inactivity Reminders] Sending inactivity reminder to ${userEmail} (Inactive for ${diffDays.toFixed(1)} days)`);
          
          const success = await sendInactivityReminderMail({
            to: userEmail,
            userName: userName
          });

          if (success) {
            // Send a notification to admins that an inactivity mail was sent
            await sendAdminNotificationMail(userEmail);

            // Update the state with the date we sent the reminder
            const updatedState = {
              ...state,
              user: {
                ...user,
                lastInactivityReminderSent: now.toISOString()
              }
            };

            const { error: updateError } = await supabaseAdmin
              .from('user_states')
              .update({
                state: updatedState,
                updated_at: row.updated_at // Preserve original updated_at if possible
              })
              .eq('id', userId);

            if (updateError) {
              console.error(`[Cron Route - Inactivity Reminders] Failed to update state for user ${userId}:`, updateError.message);
            } else {
              processedUsers.push(userEmail);
              remindersSent.push({
                userId,
                email: userEmail
              });
            }
          }
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
    console.error('[Cron Route - Inactivity Reminders] Daily cron route failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
