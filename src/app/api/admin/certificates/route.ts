import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    const { userId: authedUserId } = await auth();
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || '';

    // Verify requesting user is the system admin
    if (!authedUserId || email.toLowerCase() !== 'vidwathkaranth@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }

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
