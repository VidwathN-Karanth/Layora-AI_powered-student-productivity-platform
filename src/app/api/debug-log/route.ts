import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const logLine = `[${new Date().toISOString()}] ${message}\n`;
    const logFilePath = path.resolve(process.cwd(), 'debug.log');
    fs.appendFileSync(logFilePath, logLine);
    console.log(`[CLIENT_DEBUG] ${message}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
