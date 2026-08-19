import { NextResponse } from 'next/server';
import { User } from '@/lib/models/User';
import { requireAdminCohort } from '@/lib/authz';
import { emailsForCohort } from '@/lib/roster';

/**
 * Everyone in one academic year who has uploaded a CV, newest first.
 *
 * Admin-only: this is the single place resume links are exposed to anyone but
 * their owner.
 */
export async function GET(request: Request) {
  const guard = await requireAdminCohort(request.url);
  if (!guard.ok) return guard.response;

  const { cohort } = guard.requester;

  try {
    const rosterEmails = new Set(emailsForCohort(cohort));
    const users = await User.findAll();

    const resumes = users
      .filter((u) => u.resumeUrl && rosterEmails.has((u.email || '').trim().toLowerCase()))
      .map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        url: u.resumeUrl,
        fileName: u.resumeName,
        uploadedAt: u.resumeUploadedAt,
      }))
      .sort(
        (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
      );

    return NextResponse.json({ cohort, resumes });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Admin resumes fetch failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
