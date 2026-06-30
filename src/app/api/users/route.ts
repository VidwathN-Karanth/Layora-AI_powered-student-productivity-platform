import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { User } from '@/lib/models/User';

export async function POST(request: Request) {
  try {
    const { id, name, email } = await request.json();

    const { userId: authedUserId } = await auth();
    if (!authedUserId || authedUserId !== id) {
      return NextResponse.json({ error: 'Unauthorized user access' }, { status: 401 });
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required fields.' },
        { status: 400 }
      );
    }

    const user = await User.create({ id, name, email });
    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('API Error creating user:', errMsg);
    if (errMsg.includes('unique constraint') || errMsg.includes('already exists')) {
      return NextResponse.json(
        { error: 'A user with this email or ID already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
