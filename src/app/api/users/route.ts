import { NextResponse } from 'next/server';
import { User } from '@/lib/models/User';
import { getRequester } from '@/lib/authz';

/**
 * Creates the caller's own profile row.
 *
 * Identity is taken from the session, not the request body. The body used to
 * supply id, name and email; `users.email` is what cohort filtering matches on,
 * so trusting it would let a student register themselves into another year.
 */
export async function POST() {
  try {
    const requester = await getRequester();

    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized user access' }, { status: 401 });
    }
    if (!requester.allowed) {
      return NextResponse.json(
        { error: 'Access denied', reason: requester.denialReason },
        { status: 403 }
      );
    }

    const user = await User.create({
      id: requester.userId,
      name: requester.name,
      email: requester.email,
    });

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
