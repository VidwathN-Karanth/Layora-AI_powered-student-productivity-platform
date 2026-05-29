import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Attempt to get the OAuth token
    const client = await clerkClient();
    let tokensResponse;
    try {
      tokensResponse = await client.users.getUserOauthAccessToken(userId, 'oauth_google');
    } catch (err) {
      console.error('Clerk error fetching token:', err);
      return NextResponse.json({ error: 'Failed to fetch Google OAuth token. Please ensure your Google account is connected.' }, { status: 403 });
    }

    // Handle both array returns (older clerk versions) and paginated { data } returns (newer clerk versions)
    const tokens = Array.isArray(tokensResponse) ? tokensResponse : tokensResponse?.data;
    const token = tokens?.[0]?.token;

    if (!token) {
      return NextResponse.json({ error: 'Google Drive not connected. Please connect your Google account in Settings.' }, { status: 403 });
    }

    // Parse the multipart form data
    let formData;
    try {
      formData = await req.formData();
    } catch (err: any) {
      console.error('FormData parsing error:', err);
      return NextResponse.json({ error: 'File is too large or invalid. Please ensure it is under the size limit.' }, { status: 413 });
    }

    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload the raw file contents (uploadType=media)
    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Length': buffer.length.toString()
      },
      body: buffer
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('Google Drive Upload Error:', errorText);
      return NextResponse.json({ error: 'Failed to upload file to Google Drive.' }, { status: uploadRes.status });
    }

    const uploadedFile = await uploadRes.json();
    const fileId = uploadedFile.id;

    // 2. Update the file metadata to set the correct filename and retrieve the webViewLink
    const patchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,webViewLink`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: file.name
      })
    });

    if (!patchRes.ok) {
      console.error('Google Drive Meta Update Error:', await patchRes.text());
      return NextResponse.json({ error: 'File uploaded but failed to set filename.' }, { status: patchRes.status });
    }

    const finalFile = await patchRes.json();

    return NextResponse.json({
      success: true,
      fileId: finalFile.id,
      url: finalFile.webViewLink,
      name: file.name,
      type: file.type
    });
    
  } catch (error: any) {
    console.error('Drive upload exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
