import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

interface MailOptions {
  to: string;
  subject: string;
  courseName: string;
  progress: number;
  platform: string;
}

/**
 * Sends a premium-designed course reminder email to the user.
 * Falls back to logging to debug_emails.log if SMTP is not configured.
 */
export async function sendCourseReminderMail({ to, subject, courseName, progress, platform }: MailOptions): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'Layora Reminders <noreply@layora.com>';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0c0b14;
            color: #e4e1ec;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #141221;
            border: 1px solid #2d2a45;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          }
          .header {
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .course-box {
            background-color: #1d1b30;
            border: 1px solid #36325a;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
            text-align: center;
          }
          .course-title {
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 12px;
          }
          .progress-label {
            font-size: 12px;
            color: #a5a1b8;
            margin-bottom: 6px;
            display: block;
          }
          .progress-bar-bg {
            background-color: #2b274c;
            border-radius: 10px;
            height: 10px;
            width: 100%;
            margin-bottom: 15px;
            overflow: hidden;
          }
          .progress-bar-fill {
            background: linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%);
            height: 100%;
            border-radius: 10px;
          }
          .cta-btn {
            display: inline-block;
            background: linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 30px;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
            margin-top: 10px;
          }
          .footer {
            background-color: #0c0b14;
            padding: 20px;
            text-align: center;
            font-size: 11px;
            color: #726e85;
            border-top: 1px solid #1c1a2e;
          }
          .footer a {
            color: #7c3aed;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📚 Keep Up the Great Work!</h1>
          </div>
          <div class="content">
            <p class="greeting">Hey there,</p>
            <p class="greeting">This is your friendly reminder that it's study time! Continuing your course daily helps lock in information and build a powerful learning streak.</p>
            
            <div class="course-box">
              <div class="course-title">${courseName}</div>
              <span class="progress-label">Current Progress: ${progress}%</span>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progress}%"></div>
              </div>
              <a href="${platform.startsWith('http') ? platform : '#'}" class="cta-btn" target="_blank">Start Learning</a>
            </div>

            <p class="greeting" style="font-size: 14px; color: #a5a1b8; margin-top: 20px;">
              Let's make today count. Happy studying!
            </p>
          </div>
          <div class="footer">
            Sent by Layora - Your AI-Powered Productivity Assistant.<br>
            To update your reminder times, visit your <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/courses">Layora Courses Dashboard</a>.
          </div>
        </div>
      </body>
    </html>
  `;

  // Standard Plain Text fallback
  const textContent = `
    Hey there!
    
    This is your daily reminder that it's time to study: ${courseName}
    Your current progress is: ${progress}%
    
    Continue learning here: ${platform}
    
    Happy studying!
    - The Layora Team
  `;

  if (host && user && pass && pass.trim() !== 'paste_your_app_password_here' && !pass.includes('paste_your')) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[MailService] Sent reminder email to ${to} for course ${courseName}.`);
      return true;
    } catch (err) {
      console.error(`[MailService] Error sending email via SMTP to ${to}:`, err);
      return false;
    }
  } else {
    // Falls back to writing to a local log file inside the workspace
    const logFilePath = path.join(process.cwd(), 'debug_emails.log');
    const logEntry = `
=========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${to}
FROM: ${from}
SUBJECT: ${subject}
COURSE: ${courseName} (Progress: ${progress}%)
LINK: ${platform}
-----------------------------------------
TEXT BODY:
${textContent.trim()}
=========================================
`;

    try {
      fs.appendFileSync(logFilePath, logEntry, 'utf-8');
      console.log(`[MailService] MOCK SEND: SMTP not configured. Logged email to debug_emails.log.`);
      return true;
    } catch (fsErr) {
      console.error('[MailService] MOCK SEND: SMTP not configured, and failed to write to debug_emails.log:', fsErr);
      return false;
    }
  }
}

interface InactivityMailOptions {
  to: string;
  userName?: string;
}

/**
 * Sends a premium-designed inactivity reminder email to the user.
 */
export async function sendInactivityReminderMail({ to, userName = 'there' }: InactivityMailOptions): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'Layora Reminders <noreply@layora.com>';
  const subject = "We miss you at Layora! 🚀";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0c0b14;
            color: #e4e1ec;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #141221;
            border: 1px solid #2d2a45;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          }
          .header {
            background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 40px 30px;
            text-align: center;
          }
          .greeting {
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 24px;
            text-align: left;
          }
          .message-box {
            background-color: #1d1b30;
            border: 1px solid #36325a;
            border-radius: 12px;
            padding: 30px 20px;
            margin-bottom: 30px;
          }
          .message-title {
            font-size: 20px;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 15px;
          }
          .message-text {
            font-size: 15px;
            color: #a5a1b8;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .cta-btn {
            display: inline-block;
            background: linear-gradient(90deg, #7c3aed 0%, #ec4899 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 35px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 30px;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
            transition: transform 0.2s ease;
          }
          .footer {
            background-color: #0c0b14;
            padding: 20px;
            text-align: center;
            font-size: 11px;
            color: #726e85;
            border-top: 1px solid #1c1a2e;
          }
          .footer a {
            color: #7c3aed;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>It's been a few days! ⏰</h1>
          </div>
          <div class="content">
            <p class="greeting">Hey ${userName},</p>
            
            <div class="message-box">
              <div class="message-title">We noticed you've been away!</div>
              <p class="message-text">
                Consistency is key to mastering your goals. You haven't checked into your Layora dashboard for the past few days. 
                Don't let your streak slip away—jump back in and tackle those tasks!
              </p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://layora239.vercel.app'}/dashboard" class="cta-btn" target="_blank">Go to Dashboard</a>
            </div>

            <p class="greeting" style="font-size: 14px; color: #a5a1b8; text-align: center;">
              Small daily steps lead to massive results. You've got this!
            </p>
          </div>
          <div class="footer">
            Sent by Layora - Your AI-Powered Productivity Assistant.<br>
            Visit your <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://layora239.vercel.app'}/dashboard">dashboard</a> to resume your progress.
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
    Hey ${userName}!
    
    We noticed you haven't checked into Layora for a few days. Consistency is key to reaching your goals!
    
    Don't let your momentum slip. Log in now and get back on track:
    ${process.env.NEXT_PUBLIC_APP_URL || 'https://layora239.vercel.app'}/dashboard
    
    You've got this!
    - The Layora Team
  `;

  if (host && user && pass && pass.trim() !== 'paste_your_app_password_here' && !pass.includes('paste_your')) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        text: textContent,
        html: htmlContent,
      });

      console.log(`[MailService] Sent inactivity reminder email to ${to}.`);
      return true;
    } catch (err) {
      console.error(`[MailService] Error sending inactivity email via SMTP to ${to}:`, err);
      return false;
    }
  } else {
    const logFilePath = path.join(process.cwd(), 'debug_emails.log');
    const logEntry = `
=========================================
TIMESTAMP: ${new Date().toISOString()}
TO: ${to}
FROM: ${from}
SUBJECT: ${subject}
TYPE: INACTIVITY REMINDER
-----------------------------------------
TEXT BODY:
${textContent.trim()}
=========================================
`;

    try {
      fs.appendFileSync(logFilePath, logEntry, 'utf-8');
      console.log(`[MailService] MOCK SEND: Inactivity email logged to debug_emails.log.`);
      return true;
    } catch (fsErr) {
      console.error('[MailService] MOCK SEND: Failed to write to debug_emails.log:', fsErr);
      return false;
    }
  }
}

