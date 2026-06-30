import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminEmail } from '@/lib/admin';

export async function GET() {
  try {
    const { userId: authedUserId } = await auth();
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress || '';

    // Verify requesting user is system admin
    if (!authedUserId || !isAdminEmail(email)) {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_states')
      .select('*');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Admin fetch users failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
