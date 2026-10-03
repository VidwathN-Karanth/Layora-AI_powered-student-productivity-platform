import { NextResponse } from 'next/server';

import { requireStudent } from '@/lib/authz';
import { deleteMap, getMap, updateMap, type MapGraph } from '@/lib/mapsData';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    const map = await getMap(guard.requester.userId, id);
    if (!map) return NextResponse.json({ error: 'Map not found.' }, { status: 404 });
    return NextResponse.json({ map });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const title = (body as { title?: string }).title;
  const data = (body as { data?: MapGraph }).data;
  if (typeof title !== 'string' && !data) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    const map = await updateMap(guard.requester.userId, id, {
      ...(typeof title === 'string' ? { title } : {}),
      ...(data ? { data } : {}),
    });
    if (!map) return NextResponse.json({ error: 'Map not found.' }, { status: 404 });
    return NextResponse.json({ map });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    await deleteMap(guard.requester.userId, id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
