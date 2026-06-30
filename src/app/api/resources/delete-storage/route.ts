import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storagePath } = await req.json();
    if (!storagePath) {
      return NextResponse.json({ error: 'Missing storagePath parameter' }, { status: 400 });
    }

    // Security check: ensure path is valid and authorized for the user
    // (typically prefixed with the user's clerk ID).
    if (!storagePath.startsWith(userId) && !storagePath.includes(userId)) {
      return NextResponse.json({ error: 'Access denied: Unauthorized to delete this resource' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from('resources')
      .remove([storagePath]);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Delete storage resource failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
