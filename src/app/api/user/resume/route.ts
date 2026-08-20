import { NextResponse } from 'next/server';
import { User } from '@/lib/models/User';
import { requireStudent } from '@/lib/authz';

/**
 * A student's own CV.
 *
 * The file lives in the student's own Google Drive; we store only the link, so
 * this costs no Supabase storage. Every handler here is scoped to the caller —
 * one student can never read or change another's, and the listing for staff is
 * a separate admin-only route.
 */
export async function GET() {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const user = await User.findById(guard.requester.userId);
    return NextResponse.json({
      resume: user?.resumeUrl
        ? { url: user.resumeUrl, name: user.resumeName, uploadedAt: user.resumeUploadedAt }
        : null,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('GET resume failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/** Saves (or replaces) the caller's CV link. */
export async function POST(request: Request) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const { url, name } = await request.json();

    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'A link to your CV is required.' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      return NextResponse.json({ error: 'That does not look like a valid link.' }, { status: 400 });
    }
    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'The link must start with https://' }, { status: 400 });
    }

    // The profile row may not exist yet if the student has never linked a
    // coding account, so create it before updating.
    const existing = await User.findById(guard.requester.userId);

    // One CV at a time. Replacing has to be deliberate: remove the old one
    // first. Enforced here and not only in the UI, so the rule holds even if
    // the request is made directly.
    if (existing?.resumeUrl) {
      return NextResponse.json(
        { error: 'You already have a CV uploaded. Remove it first, then upload the new one.' },
        { status: 409 }
      );
    }

    if (!existing) {
      await User.create({
        id: guard.requester.userId,
        name: guard.requester.name,
        email: guard.requester.email,
      });
    }

    const updated = await User.update(guard.requester.userId, {
      resumeUrl: parsed.toString(),
      resumeName: (typeof name === 'string' && name.trim()) || 'Resume',
      resumeUploadedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      resume: {
        url: updated?.resumeUrl,
        name: updated?.resumeName,
        uploadedAt: updated?.resumeUploadedAt,
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('POST resume failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/** Removes the caller's CV link. The Drive file itself is theirs to delete. */
export async function DELETE() {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    await User.update(guard.requester.userId, {
      resumeUrl: null,
      resumeName: null,
      resumeUploadedAt: null,
    });
    return NextResponse.json({ success: true, resume: null });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('DELETE resume failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
