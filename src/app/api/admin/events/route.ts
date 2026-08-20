import { NextResponse } from 'next/server';
import { Event, isStaffAudience, STAFF_AUDIENCES } from '@/lib/models/Event';
import { requireAdmin, requireAdminCohort } from '@/lib/authz';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Staff entries for the year the console is showing, plus department-wide ones. */
export async function GET(request: Request) {
  const guard = await requireAdminCohort(request.url);
  if (!guard.ok) return guard.response;

  try {
    const events = await Event.findForStaff(guard.requester.cohort);
    return NextResponse.json({ cohort: guard.requester.cohort, events });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Admin GET events failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/**
 * Publishes an event to one year or to the whole department.
 *
 * `audience` is explicit rather than inferred from the console's current year,
 * so posting department-wide can never happen by accident.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const { title, description, eventDate, audience } = await request.json();

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Give the event a title.' }, { status: 400 });
    }
    if (typeof eventDate !== 'string' || !DATE_PATTERN.test(eventDate)) {
      return NextResponse.json({ error: 'Pick a valid date.' }, { status: 400 });
    }
    if (!isStaffAudience(audience)) {
      return NextResponse.json(
        { error: `Invalid audience. Expected one of: ${STAFF_AUDIENCES.join(', ')}.` },
        { status: 400 }
      );
    }

    const event = await Event.create({
      title: title.trim().slice(0, 120),
      description: typeof description === 'string' ? description.trim().slice(0, 500) || null : null,
      eventDate,
      audience,
      createdBy: guard.requester.userId,
      creatorName: guard.requester.name,
      isStaff: true,
    });

    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Admin POST event failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/** Staff may remove any staff event; personal student entries are off limits. */
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
    }

    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (!event.isStaff) {
      return NextResponse.json(
        { error: "That is a student's personal entry and cannot be removed here." },
        { status: 403 }
      );
    }

    await Event.remove(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Admin DELETE event failed:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
