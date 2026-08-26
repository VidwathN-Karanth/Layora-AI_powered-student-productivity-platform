import {
  corsPreflight, extensionJson, requireExtensionUser,
} from '@/lib/extensionAuth';
import { listCourses } from '@/lib/extensionData';

/**
 * The student's courses, each with the link they saved for it.
 *
 * The link lives in `platform` — the course form labels that field "Course Link
 * (URL)" — so it is returned as `url` here, already validated. A course saved
 * without a link has `url: null`, and the popup falls back to Layora's courses
 * page for those.
 */
export async function GET(request: Request) {
  const guard = await requireExtensionUser(request);
  if (!guard.ok) return guard.response;

  try {
    return extensionJson({ courses: await listCourses(guard.requester.userId) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension GET courses failed:', message);
    return extensionJson({ error: message }, 500);
  }
}

export async function OPTIONS() {
  return corsPreflight();
}

export const dynamic = 'force-dynamic';
