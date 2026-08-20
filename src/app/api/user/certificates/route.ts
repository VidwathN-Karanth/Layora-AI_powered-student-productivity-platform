import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireStudent } from '@/lib/authz';
import { CERTIFICATE_CATEGORIES, isCertificateCategory } from '@/lib/certificateCategories';

/**
 * A student's certificates.
 *
 * The PDF lives in the student's own Google Drive; we store only the link, so
 * this costs no Supabase storage. 800 students uploading phone photos of their
 * certificates would have blown past the 1 GB storage allowance on its own.
 *
 * Every handler is scoped to the caller — one student can never read or delete
 * another's. Staff read them through the admin-only routes instead.
 */

const MAX_NAME_LENGTH = 200;

/** The certificates table ships in a separate migration; treat an absent one
 *  as "nothing uploaded yet" rather than a hard failure. */
function isMissingTable(error: { message?: string; code?: string }): boolean {
  return !!error.message?.includes('does not exist') || error.code === 'PGRST116';
}

export async function GET() {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const { data: certs, error } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('user_id', guard.requester.userId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          {
            error: 'Certificates database table is missing. Run supabase/schema.sql against your project.',
            code: 'MISSING_TABLE',
          },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json(certs || []);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('GET certificates failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/**
 * Records one certificate. The body carries a link, not a file — the upload
 * itself already happened against the student's Drive.
 */
export async function POST(req: Request) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const { name, category, url } = await req.json();

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'A certificate title is required.' }, { status: 400 });
    }
    // The set is closed and the column is constrained to match, so a bad value
    // is rejected here rather than becoming a 500 from Postgres.
    if (!isCertificateCategory(category)) {
      return NextResponse.json(
        { error: `Choose a category: ${CERTIFICATE_CATEGORIES.join(', ')}.` },
        { status: 400 }
      );
    }
    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ error: 'A link to the certificate is required.' }, { status: 400 });
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

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .insert({
        user_id: guard.requester.userId,
        name: name.trim().slice(0, MAX_NAME_LENGTH),
        category,
        file_url: parsed.toString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, certificate: data });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('POST certificate failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/** Forgets a certificate. The Drive file itself stays the student's to delete. */
export async function DELETE(req: Request) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing certificate ID' }, { status: 400 });
    }

    // Filtering on user_id as part of the delete is the ownership check: a row
    // belonging to someone else simply matches nothing.
    const { data, error } = await supabaseAdmin
      .from('certificates')
      .delete()
      .eq('id', id)
      .eq('user_id', guard.requester.userId)
      .select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Certificate not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('DELETE certificate failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
