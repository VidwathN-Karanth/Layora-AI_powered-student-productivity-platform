import {
  corsPreflight, extensionJson, requireExtensionUser,
} from '@/lib/extensionAuth';
import { listCourses } from '@/lib/extensionData';

/**
 * The student's courses.
 *
 * Layora stores a course as a name, a platform and a progress figure — it never
 * held a link to the course itself, because the course lives on NPTEL or
 * Coursera, not here. So there is no per-course URL to return; the popup opens
 * the Layora courses page, which is the page that can actually act on them.
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
