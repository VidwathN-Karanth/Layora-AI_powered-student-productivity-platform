import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminCohort } from '@/lib/authz';
import { emailsForCohort } from '@/lib/roster';

interface CertificateUploader {
  userId: string;
  name: string;
  email: string;
  count: number;
  latestAt: string | null;
}

/**
 * Who in one academic year has uploaded certificates, and how many.
 *
 * The drill-down into an individual's certificates is the existing
 * `GET /api/admin/certificates?userId=` route — this only builds the roll call.
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdminCohort(request.url);
    if (!guard.ok) return guard.response;

    const { cohort } = guard.requester;
    const rosterEmails = new Set(emailsForCohort(cohort));

    const { data: certs, error } = await supabaseAdmin
      .from('certificates')
      .select('user_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      // The certificates table is created by a separate migration; an absent
      // table means nobody has uploaded anything yet, not a failure.
      if (error.message?.includes('does not exist') || error.code === 'PGRST116') {
        return NextResponse.json({ cohort, uploaders: [] });
      }
      throw error;
    }

    if (!certs || certs.length === 0) {
      return NextResponse.json({ cohort, uploaders: [] });
    }

    // Resolve names and emails for the students who uploaded something.
    const userIds = [...new Set(certs.map((c) => c.user_id))];
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', userIds);

    if (usersError) throw usersError;

    const profiles = new Map(
      (users || []).map((u) => [u.id, { name: u.name as string, email: u.email as string }])
    );

    const byUser = new Map<string, CertificateUploader>();

    for (const cert of certs) {
      const profile = profiles.get(cert.user_id);
      // Unknown to the users table, or in another year — either way, not ours.
      if (!profile) continue;

      const email = (profile.email || '').trim().toLowerCase();
      if (!rosterEmails.has(email)) continue;

      const existing = byUser.get(cert.user_id);
      if (existing) {
        existing.count += 1;
        continue;
      }

      byUser.set(cert.user_id, {
        userId: cert.user_id,
        name: profile.name || 'Student',
        email: profile.email,
        count: 1,
        // Rows arrive newest-first, so the first one seen is the latest.
        latestAt: cert.created_at ?? null,
      });
    }

    const uploaders = [...byUser.values()].sort(
      (a, b) => new Date(b.latestAt || 0).getTime() - new Date(a.latestAt || 0).getTime()
    );

    return NextResponse.json({ cohort, uploaders });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Admin certificates overview failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
