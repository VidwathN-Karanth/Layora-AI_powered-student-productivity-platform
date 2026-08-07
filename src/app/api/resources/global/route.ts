import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { isAdminEmail } from '@/lib/admin';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ resources: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('user_states')
      .select('state')
      .eq('id', 'global_resources')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not created yet
        return NextResponse.json({ resources: [] });
      }
      throw error;
    }

    return NextResponse.json({ resources: data?.state?.resources || [] });
  } catch (error: any) {
    console.error('Failed to GET global resources:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || '';
    const uploaderName = clerkUser?.fullName || email.split('@')[0];

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { name, url, type } = body;

    if (!name || !url) {
      return NextResponse.json({ error: 'Missing name or url' }, { status: 400 });
    }

    // 1. Fetch the existing list
    let list: any[] = [];
    const { data, error: fetchError } = await supabaseAdmin
      .from('user_states')
      .select('state')
      .eq('id', 'global_resources')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (data?.state?.resources) {
      list = data.state.resources;
    }

    // 2. Append the new resource
    const newResource = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      url,
      type: type || 'pdf',
      uploadedBy: email,
      uploaderName,
      createdAt: new Date().toISOString()
    };

    const updatedList = [...list, newResource];

    // 3. Save back to database
    const { error: saveError } = await supabaseAdmin
      .from('user_states')
      .upsert({
        id: 'global_resources',
        state: { resources: updatedList },
        updated_at: new Date().toISOString()
      });

    if (saveError) throw saveError;

    return NextResponse.json({ success: true, resource: newResource, resources: updatedList });
  } catch (error: any) {
    console.error('Failed to POST global resource:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress || '';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing resource ID' }, { status: 400 });
    }

    // 1. Fetch current list
    const { data, error: fetchError } = await supabaseAdmin
      .from('user_states')
      .select('state')
      .eq('id', 'global_resources')
      .single();

    if (fetchError) throw fetchError;

    const list = data?.state?.resources || [];
    const itemToDelete = list.find((r: any) => r.id === id);

    if (!itemToDelete) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // 2. Check authorization: must be uploader or admin
    const isAdmin = isAdminEmail(email);
    const isUploader = itemToDelete.uploadedBy.toLowerCase() === email.toLowerCase();

    if (!isAdmin && !isUploader) {
      return NextResponse.json({ error: 'Unauthorized to delete this resource' }, { status: 403 });
    }

    // 3. Filter list and save
    const updatedList = list.filter((r: any) => r.id !== id);

    const { error: saveError } = await supabaseAdmin
      .from('user_states')
      .upsert({
        id: 'global_resources',
        state: { resources: updatedList },
        updated_at: new Date().toISOString()
      });

    if (saveError) throw saveError;

    return NextResponse.json({ success: true, resources: updatedList });
  } catch (error: any) {
    console.error('Failed to DELETE global resource:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
