import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminCohort } from '@/lib/authz';
import { emailsForCohort } from '@/lib/roster';

/**
 * Student state rows for one academic year.
 *
 * The console shows one year at a time, so `?cohort=` is required. Cohort
 * membership lives in the roster rather than the database, so the filter is
 * applied here on the email each state row carries.
 */
export async function GET(request: Request) {
  try {
    const guard = await requireAdminCohort(request.url);
    if (!guard.ok) return guard.response;

    const { cohort } = guard.requester;

    const { data, error } = await supabaseAdmin
      .from('user_states')
      .select('*')
      .neq('id', 'global_settings')
      .neq('id', 'global_resources');

    if (error) throw error;

    const rosterEmails = new Set(emailsForCohort(cohort));
    const scoped = (data || []).filter((row) => {
      const email = (row?.state?.user?.email || '').trim().toLowerCase();
      return rosterEmails.has(email);
    });

    return NextResponse.json(scoped);
  } catch (err: any) {
    console.error('Admin fetch users failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
