import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/authz';
import { isCohort, normalizeEmail, type Cohort } from '@/lib/cohorts';
import { collectEmails } from '@/lib/emails';
import { AdminLog } from '@/lib/models/AdminLog';
import { addGrant, adminCount, listGrants, removeGrant, type Role } from '@/lib/roster';

/**
 * Access management — who is an admin, and which year each student is in.
 *
 * Admin-only on every method. The roster rules themselves (one year per
 * student, admin and student exclusive, college addresses only) live in
 * src/lib/roster.ts so they hold no matter who calls.
 */

function parseRole(value: unknown): Role | null {
  return value === 'admin' || value === 'student' ? value : null;
}

/** GET — every grant, for the Access page to group by role and year. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ grants: await listGrants() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST — grant a role to one or many emails (`{ emails, role, cohort? }`).
 *
 * Each address is handled on its own and the response says what was added,
 * moved from another year, or skipped and why — so one bad line in a pasted
 * class list never rejects the rest.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const role = parseRole((body as { role?: unknown }).role);
  const rawCohort = (body as { cohort?: unknown }).cohort;
  const cohort: Cohort | null = isCohort(rawCohort) ? rawCohort : null;

  if (!role) return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });
  if (role === 'student' && !cohort) {
    return NextResponse.json({ error: 'A year is required for a student.' }, { status: 400 });
  }

  const list = collectEmails(body);
  if (list.length === 0) {
    return NextResponse.json({ error: 'At least one email is required.' }, { status: 400 });
  }

  const added: string[] = [];
  const moved: { email: string; from: Cohort }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const email of list) {
    const result = await addGrant({ email, role, cohort }, guard.requester.email);
    if (!result.ok) skipped.push({ email, reason: result.reason });
    else if (result.movedFrom) moved.push({ email, from: result.movedFrom });
    else added.push(email);
  }

  const done = added.length + moved.length;
  if (done > 0) {
    const what = role === 'admin' ? 'an admin' : `a ${cohort} student`;
    await AdminLog.record({
      actor: guard.requester,
      action: 'access.grant',
      summary:
        done === 1
          ? `Made ${added[0] ?? moved[0].email} ${what}`
          : `Added ${done} ${role === 'admin' ? 'admins' : `students to ${cohort}`}${moved.length ? ` (${moved.length} moved from another year)` : ''}`,
      target: done === 1 ? (added[0] ?? moved[0].email) : `${done} ${role}s`,
      cohort,
    });
  }

  return NextResponse.json({ success: true, added, moved, skipped });
}

/** DELETE — revoke one grant. The student's workspace and history are kept. */
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail((body as { email?: string }).email);
  const role = parseRole((body as { role?: unknown }).role);
  const rawCohort = (body as { cohort?: unknown }).cohort;
  const cohort: Cohort | null = isCohort(rawCohort) ? rawCohort : null;

  if (!email) return NextResponse.json({ error: 'An email is required.' }, { status: 400 });
  if (!role) return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });

  if (role === 'admin' && (await adminCount()) <= 1) {
    return NextResponse.json({ error: 'At least one admin must remain.' }, { status: 409 });
  }

  try {
    await removeGrant(email, role);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  await AdminLog.record({
    actor: guard.requester,
    action: 'access.revoke',
    summary: role === 'admin' ? `Revoked admin from ${email}` : `Removed ${email} from ${cohort ?? 'the roster'}`,
    target: email,
    cohort,
  });

  return NextResponse.json({ success: true });
}

export const dynamic = 'force-dynamic';
