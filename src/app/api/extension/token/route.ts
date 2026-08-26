import { NextResponse } from 'next/server';

import { requireStudentOrAdmin } from '@/lib/extensionAuth';
import { ExtensionToken } from '@/lib/models/ExtensionToken';

/**
 * Minting and revoking the extension's pairing token.
 *
 * Session-only on purpose: a token is issued to a person sitting in front of a
 * signed-in Layora page pressing Connect. Letting one token mint another would
 * turn a single leaked token into permanent access.
 */

/** The tokens this student has out, without the tokens themselves. */
export async function GET() {
  const guard = await requireStudentOrAdmin();
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ tokens: await ExtensionToken.listForUser(guard.requester.userId) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension token list failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Mints one. The raw value is in this response and nowhere else, ever again. */
export async function POST(request: Request) {
  const guard = await requireStudentOrAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === 'string' ? body.label : null;

    const { token, id } = await ExtensionToken.mint(guard.requester.userId, label);
    return NextResponse.json({ token, id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension token mint failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Disconnects one device. */
export async function DELETE(request: Request) {
  const guard = await requireStudentOrAdmin();
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const revoked = await ExtensionToken.revoke(guard.requester.userId, id);
    if (!revoked) return NextResponse.json({ error: 'That connection no longer exists.' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension token revoke failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
