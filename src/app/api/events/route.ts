import { NextResponse } from 'next/server';
import { Event, PERSONAL_AUDIENCE } from '@/lib/models/Event';
import { requireStudent } from '@/lib/authz';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The student's calendar: their own entries plus staff entries for their year. */
export async function GET() {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  const { userId, cohort } = guard.requester;

  try {
    const events = await Event.findForStudent(userId, cohort);
    return NextResponse.json({ cohort, events });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('GET events failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/**
 * Adds an entry to the student's own calendar.
 *
 * The audience is always Personal — a student cannot post to their year or to
 * the department. Staff do that through the admin console.
 */
export async function POST(request: Request) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const { title, description, eventDate } = await request.json();

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Give the event a title.' }, { status: 400 });
    }
    if (typeof eventDate !== 'string' || !DATE_PATTERN.test(eventDate)) {
      return NextResponse.json({ error: 'Pick a valid date.' }, { status: 400 });
    }

    const event = await Event.create({
      title: title.trim().slice(0, 120),
      description: typeof description === 'string' ? description.trim().slice(0, 500) || null : null,
      eventDate,
      audience: PERSONAL_AUDIENCE,
      createdBy: guard.requester.userId,
      creatorName: guard.requester.name,
      isStaff: false,
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('POST event failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/** Students may only remove entries they created themselves. */
export async function DELETE(request: Request) {
  const guard = await requireStudent();
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    const event = await Event.findById(id);
    // Report someone else's entry as missing rather than confirming it exists.
    if (!event || event.createdBy !== guard.requester.userId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await Event.remove(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('DELETE event failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
