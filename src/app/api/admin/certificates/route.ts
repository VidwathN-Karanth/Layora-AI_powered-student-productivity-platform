import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/authz';

export async function GET(req: Request) {
  try {
    // The shared guard rather than a local email compare, so this route
    // inherits whatever requireAdmin() grows into.
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing target userId parameter' }, { status: 400 });
    }

    const { data: certs, error } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) {
      // Return empty array if the certificates table doesn't exist yet to prevent total failure
      if (error.message?.includes('does not exist') || error.code === 'PGRST116') {
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(certs || []);
  } catch (err: any) {
    console.error('Admin fetch user certificates failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic'; // Prevent dynamic routes from caching
