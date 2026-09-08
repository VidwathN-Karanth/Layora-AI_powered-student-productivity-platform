import { NextResponse } from 'next/server';
import { User } from '@/lib/models/User';
import { requireAdminCohort } from '@/lib/authz';
import { emailsForCohort } from '@/lib/roster';
import { driveFileId } from '@/lib/driveLinks';
import { AdminLog } from '@/lib/models/AdminLog';
import { safeEntryName, zipStream, type ZipEntry } from '@/lib/zip';

/**
 * Every CV in one academic year, as a single ZIP.
 *
 * The files themselves live in each student's own Google Drive — Layora stores
 * only the link — so this fetches each one and streams it straight into the
 * archive. Nothing is held in memory beyond the file currently being written.
 *
 * A CV that cannot be fetched does not fail the download. Drive shares get
 * revoked and links rot, and a staff member downloading forty CVs wants the
 * thirty-nine that work plus a note about the fortieth, not an error page. The
 * misses are listed in `_missing.txt` inside the archive.
 */

/** Roughly 25MB per file — far past any CV, and a guard against a stray link. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** A CV should arrive well inside this; a hung host must not hold the stream. */
const FETCH_TIMEOUT_MS = 20_000;

/** Extensions we are willing to infer from a content type. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/**
 * A URL that returns the file's bytes rather than Drive's viewer page.
 *
 * `/file/d/<id>/view` is HTML; the `uc?export=download` form is the file. Any
 * other https link is fetched as given.
 */
function downloadUrl(url: string): string | null {
  const id = driveFileId(url);
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function extensionFor(fileName: string | null, contentType: string): string {
  const fromName = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) return fromName;
  return EXTENSION_BY_TYPE[contentType.split(';')[0].trim().toLowerCase()] || 'pdf';
}

export async function GET(request: Request) {
  const guard = await requireAdminCohort(request.url);
  if (!guard.ok) return guard.response;

  const { cohort } = guard.requester;

  let resumes: { name: string; email: string; url: string; fileName: string | null; uploadedAt: string | null }[];
  try {
    const rosterEmails = new Set(emailsForCohort(cohort));
    const users = await User.findAll();

    resumes = users
      .filter((u) => u.resumeUrl && rosterEmails.has((u.email || '').trim().toLowerCase()))
      .map((u) => ({
        name: u.name || u.email,
        email: u.email,
        url: u.resumeUrl as string,
        fileName: u.resumeName,
        uploadedAt: u.resumeUploadedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Admin resume archive listing failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }

  if (resumes.length === 0) {
    return NextResponse.json(
      { error: `No ${cohort} student has uploaded a CV yet.` },
      { status: 404 }
    );
  }

  await AdminLog.record({
    actor: guard.requester,
    action: 'resumes.export',
    summary: `Downloaded all ${resumes.length} ${cohort} CVs as a ZIP`,
    target: `${resumes.length} CVs`,
    cohort,
  });

  async function* entries(): AsyncGenerator<ZipEntry> {
    const failures: string[] = [];
    // Two students called "A Kumar" must not overwrite each other's entry.
    const used = new Set<string>();

    for (const resume of resumes) {
      const source = downloadUrl(resume.url);
      if (!source) {
        failures.push(`${resume.name} <${resume.email}> — the stored link is not a usable https address`);
        continue;
      }

      try {
        const response = await fetch(source, {
          redirect: 'follow',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
          failures.push(`${resume.name} <${resume.email}> — the file could not be fetched (HTTP ${response.status}); the Drive share may have been revoked`);
          continue;
        }

        const buffer = new Uint8Array(await response.arrayBuffer());
        if (buffer.length === 0) {
          failures.push(`${resume.name} <${resume.email}> — the file came back empty`);
          continue;
        }
        if (buffer.length > MAX_FILE_BYTES) {
          failures.push(`${resume.name} <${resume.email}> — the file is larger than 25MB and was skipped`);
          continue;
        }

        const contentType = response.headers.get('content-type') || '';
        // Drive answers with its own HTML page when a file is no longer shared
        // publicly, and that page is a perfectly valid 200. Writing it into the
        // archive as someone's CV is worse than saying it is missing.
        if (contentType.toLowerCase().includes('text/html')) {
          failures.push(`${resume.name} <${resume.email}> — Drive returned a sign-in page; the file is no longer shared with "anyone with the link"`);
          continue;
        }

        const extension = extensionFor(resume.fileName, contentType);
        const base = safeEntryName(resume.name, resume.email.split('@')[0]);
        let entryName = `${base}.${extension}`;
        for (let n = 2; used.has(entryName.toLowerCase()); n++) {
          entryName = `${base} (${n}).${extension}`;
        }
        used.add(entryName.toLowerCase());

        yield {
          name: entryName,
          content: buffer,
          modified: resume.uploadedAt ? new Date(resume.uploadedAt) : new Date(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${resume.name} <${resume.email}> — ${message}`);
      }
    }

    // An index so a folder of PDFs can still be matched back to email addresses.
    const index = [
      `Layora — ${cohort} CVs`,
      `Downloaded ${new Date().toISOString()}`,
      '',
      ...resumes.map((r) => `${r.name}\t${r.email}\t${r.uploadedAt || 'unknown upload date'}`),
    ].join('\n');
    yield { name: '_index.txt', content: new TextEncoder().encode(index) };

    if (failures.length > 0) {
      const note = [
        `${failures.length} CV${failures.length === 1 ? '' : 's'} could not be included:`,
        '',
        ...failures.map((f) => `• ${f}`),
      ].join('\n');
      yield { name: '_missing.txt', content: new TextEncoder().encode(note) };
    }
  }

  const slug = cohort.toLowerCase().replace(/\s+/g, '_');
  const fileName = `layora_${slug}_resumes_${new Date().toISOString().split('T')[0]}.zip`;

  return new Response(zipStream(entries()), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export const dynamic = 'force-dynamic';
