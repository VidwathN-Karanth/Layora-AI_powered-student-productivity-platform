import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const logLine = `[${new Date().toISOString()}] ${message}\n`;
    console.log(`[CLIENT_DEBUG] ${message}`);
    
    if (process.env.NODE_ENV !== 'production') {
      try {
        const logFilePath = path.resolve(process.cwd(), 'debug.log');
        fs.appendFileSync(logFilePath, logLine);
      } catch (fileErr) {
        console.error('Failed to write to debug.log file:', fileErr);
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in debug-log route:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
