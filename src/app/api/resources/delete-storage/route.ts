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

    // Security check: path must live inside the requesting user's own folder
    // (files are stored under `${userId}/...`). A substring/prefix check without
    // a separator would let a userId that happens to be a substring of another
    // path match and delete someone else's file.
    if (typeof storagePath !== 'string' || storagePath.includes('..') || !storagePath.startsWith(`${userId}/`)) {
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
