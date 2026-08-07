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
