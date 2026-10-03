import { NextResponse } from 'next/server';

import { requireStudent } from '@/lib/authz';
import { getMap, updateMap } from '@/lib/mapsData';
import { addCourseToState, normaliseUrl, removeCourseFromState } from '@/lib/extensionData';

/**
 * Pin / unpin a map card. Pinning mirrors the card into the student's own
 * Courses (dashboard + extension) and counts toward the course cap. The
 * mirrored course's id is stored back on the node so unpin can remove exactly
 * that course.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const userId = guard.requester.userId;

  const body = await request.json().catch(() => ({}));
  const nodeId = String((body as { nodeId?: string }).nodeId || '');
  const pinned = Boolean((body as { pinned?: boolean }).pinned);
  if (!nodeId) return NextResponse.json({ error: 'nodeId is required.' }, { status: 400 });

  try {
    const map = await getMap(userId, id);
    if (!map) return NextResponse.json({ error: 'Map not found.' }, { status: 404 });

    const nodes = Array.isArray(map.data?.nodes) ? map.data.nodes : [];
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

    if (pinned) {
      if (node.data.pinned) return NextResponse.json({ node }); // already pinned, no-op
      const topic = (node.data.topic || '').trim() || 'Untitled topic';
      const link = normaliseUrl(node.data.link) || ''; // '' → course shows as Self-Study
      // Throws with a friendly message if the shared cap is already reached.
      const courseId = await addCourseToState(userId, { name: topic, platform: link });
      node.data.pinned = true;
      node.data.courseId = courseId;
    } else {
      if (node.data.courseId) await removeCourseFromState(userId, node.data.courseId);
      node.data.pinned = false;
      delete node.data.courseId;
    }

    await updateMap(userId, id, { data: map.data });
    return NextResponse.json({ node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Cap breaches are a 409 so the canvas can leave the pin toggle as it was.
    const status = /maximum of/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const dynamic = 'force-dynamic';
