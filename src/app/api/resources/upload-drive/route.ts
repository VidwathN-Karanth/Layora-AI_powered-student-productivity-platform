import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Get the Google OAuth token from Clerk
    const client = await clerkClient();
    let tokensResponse;
    try {
      tokensResponse = await client.users.getUserOauthAccessToken(userId, 'oauth_google');
    } catch (err) {
      console.error('Clerk error fetching token for Google Drive:', err);
      return NextResponse.json({ 
        error: 'Failed to fetch Google OAuth token from Clerk. Make sure you are logged in with Google.' 
      }, { status: 403 });
    }

    const tokens = Array.isArray(tokensResponse) ? tokensResponse : tokensResponse?.data;
    const token = tokens?.[0]?.token;

    if (!token) {
      return NextResponse.json({ 
        error: 'Google account not connected. Please log in with Google to use Google Drive uploads.' 
      }, { status: 403 });
    }

    // 2. Prepare the multipart upload to Google Drive
    const metadata = {
      name: name || file.name,
      mimeType: file.type || 'application/octet-stream',
    };

    // Construct multipart/related body manually with raw binary data
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = 
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) + '\r\n';

    // Get file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Build request body
    const body = Buffer.concat([
      Buffer.from(delimiter),
      Buffer.from(metadataPart),
      Buffer.from(delimiter),
      Buffer.from(`Content-Type: ${metadata.mimeType}\r\n\r\n`),
      fileBuffer,
      Buffer.from(closeDelimiter)
    ]);

    // 3. Post to Google Drive v3 files endpoint
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': body.length.toString()
      },
      body: body
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Google Drive API upload failed:', errText);
      
      let parsedError = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          parsedError = parsed.error.message;
        }
      } catch (e) {}

      return NextResponse.json({ 
        error: `Google Drive API error: ${parsedError}` 
      }, { status: response.status });
    }

    const driveData = await response.json();

    // Fallback: if Google API doesn't return webViewLink directly, construct it from the file ID
    const fileUrl = driveData.webViewLink || (driveData.id ? `https://drive.google.com/file/d/${driveData.id}/view?usp=drivesdk` : '#');

    return NextResponse.json({
      success: true,
      file: {
        name: driveData.name || file.name,
        url: fileUrl,
        driveId: driveData.id
      }
    });

  } catch (error: any) {
    console.error('Google Drive sync exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
