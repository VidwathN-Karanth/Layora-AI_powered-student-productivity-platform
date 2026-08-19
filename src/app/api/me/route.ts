import { NextResponse } from 'next/server';
import { getRequester } from '@/lib/authz';

/**
 * Who am I, and am I allowed in?
 *
 * The single place the browser learns its own cohort. The roster is server-only,
 * so this endpoint exists to hand back the one derived fact the UI needs
 * ("3rd Year") without shipping every student's email into the JS bundle.
 */
export async function GET() {
  const requester = await getRequester();

  if (!requester) {
    return NextResponse.json(
      { signedIn: false, allowed: false, reason: 'signed_out' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    signedIn: true,
    email: requester.email,
    isAdmin: requester.isAdmin,
    cohort: requester.cohort,
    allowed: requester.allowed,
    reason: requester.denialReason,
  });
}

export const dynamic = 'force-dynamic';
