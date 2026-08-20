/**
 * Helpers for files that live in a student's own Google Drive.
 *
 * Certificates and CVs are never copied into Supabase storage — the student
 * uploads to their own Drive and we keep only the link. That keeps the
 * department off the hook for hundreds of megabytes of scanned PDFs, but it
 * means the app has to turn a share link back into something it can embed.
 */

/** The shapes a Drive share link actually arrives in. */
const DRIVE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]{10,})/, // .../file/d/{id}/view
  /\/document\/d\/([a-zA-Z0-9_-]{10,})/, // Docs-flavoured links
  /[?&]id=([a-zA-Z0-9_-]{10,})/, // .../open?id={id}, .../uc?id={id}
];

/** Pulls the file id out of a Drive link, or null if it is not one. */
export function driveFileId(url: string | null | undefined): string | null {
  if (!url) return null;

  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host !== 'drive.google.com' && host !== 'docs.google.com') return null;

  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * An embeddable URL for an <iframe>, or null when the link is not a Drive
 * file and can therefore only be opened in a new tab.
 *
 * The file has to be shared as "anyone with the link", which is what the
 * upload route sets when it puts the file in Drive.
 */
export function drivePreviewUrl(url: string | null | undefined): string | null {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/**
 * A rendered image of the file's first page — for a certificate, the whole
 * thing — or null when the link is not a Drive file.
 *
 * Two caveats, which is why every caller needs a fallback rather than trusting
 * this to load: the endpoint is undocumented, and it only answers while the
 * file is still shared with "anyone with the link". Drive also rate-limits
 * thumbnails, so a grid full of them will occasionally drop one.
 */
export function driveThumbnailUrl(url: string | null | undefined, width = 400): string | null {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : null;
}
