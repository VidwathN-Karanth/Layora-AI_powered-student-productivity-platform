import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: certs, error } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // Handle the case where the certificates table has not been created yet in Supabase
      if (error.message?.includes('does not exist') || error.code === 'PGRST116') {
        return NextResponse.json(
          { 
            error: 'Certificates database table is missing. Run the SQL script from your implementation plan.', 
            code: 'MISSING_TABLE' 
          }, 
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json(certs || []);
  } catch (err: any) {
    console.error('GET certificates failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const platform = formData.get('platform') as string | null;

    if (!file || !name || !platform) {
      return NextResponse.json({ error: 'Missing required parameters (file, name, platform)' }, { status: 400 });
    }

    // Try to ensure the Storage bucket exists dynamically
    try {
      await supabaseAdmin.storage.createBucket('certificates', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
      });
    } catch (err) {
      // Ignore if bucket already exists
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload image to the certificates bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('certificates')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Retrieve public access URL
    const { data: urlData } = supabaseAdmin.storage
      .from('certificates')
      .getPublicUrl(filePath);

    const fileUrl = urlData.publicUrl;

    // Record certificate metadata in the table
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('certificates')
      .insert({
        user_id: userId,
        name,
        platform,
        file_url: fileUrl
      })
      .select()
      .single();

    if (dbError) {
      // Try to cleanup the uploaded file if database insert fails
      await supabaseAdmin.storage.from('certificates').remove([filePath]);
      throw dbError;
    }

    return NextResponse.json({ success: true, certificate: dbData });
  } catch (err: any) {
    console.error('POST certificate failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing certificate ID' }, { status: 400 });
    }

    // Retrieve the certificate to verify ownership
    const { data: cert, error: fetchError } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !cert) {
      return NextResponse.json({ error: 'Certificate not found or access denied' }, { status: 404 });
    }

    // Parse the file path inside the certificates bucket from the URL
    const fileUrl = cert.file_url;
    const urlParts = fileUrl.split('/certificates/');
    const filePath = urlParts[1] ? decodeURIComponent(urlParts[1]) : null;

    if (filePath) {
      await supabaseAdmin.storage.from('certificates').remove([filePath]);
    }

    // Delete the metadata row
    const { error: deleteError } = await supabaseAdmin
      .from('certificates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('DELETE certificate failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
