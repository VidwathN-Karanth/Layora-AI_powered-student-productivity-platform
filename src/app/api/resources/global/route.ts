import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getRequester, requireAdminCohort } from '@/lib/authz';
import { AdminLog } from '@/lib/models/AdminLog';
import {
  SHARED_RESOURCE_TAG,
  cohortCanSeeResource,
  findResourceNameClash,
  isCohort,
  type Cohort,
} from '@/lib/cohorts';

interface StoredResource {
  id: string;
  name: string;
  url: string;
  type?: string;
  year?: string;
  uploadedBy: string;
  uploaderName?: string;
  createdAt?: string;
}

async function readResourceList(): Promise<StoredResource[]> {
  const { data, error } = await supabaseAdmin
    .from('user_states')
    .select('state')
    .eq('id', 'global_resources')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return []; // Not created yet
    throw error;
  }

  return (data?.state?.resources || []) as StoredResource[];
}

async function writeResourceList(resources: StoredResource[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_states')
    .upsert({
      id: 'global_resources',
      state: { resources },
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

/** What one cohort is allowed to see: its own year, plus the shared shelf. */
function visibleTo(cohort: Cohort, resources: StoredResource[]): StoredResource[] {
  return resources.filter((r) => cohortCanSeeResource(cohort, r.year));
}

/**
 * The shared library, scoped to one academic year.
 *
 * Students get their own year plus anything tagged `Others`, which is the
 * department-wide shelf. Admins must name a year with `?cohort=`, because the
 * console shows one year at a time.
 */
export async function GET(request: Request) {
  try {
    const requester = await getRequester();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let cohort: Cohort;

    if (requester.isAdmin) {
      const guard = await requireAdminCohort(request.url);
      if (!guard.ok) return guard.response;
      cohort = guard.requester.cohort;
    } else {
      if (!requester.allowed || !requester.cohort) {
        return NextResponse.json(
          { error: 'Access denied', reason: requester.denialReason },
          { status: 403 }
        );
      }
      cohort = requester.cohort;
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ resources: [], cohort });
    }

    const resources = await readResourceList();
    return NextResponse.json({ resources: visibleTo(cohort, resources), cohort });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to GET global resources:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/**
 * Share a resource.
 *
 * A student's upload is always tagged with their own year — the client-supplied
 * `year` is ignored, so nothing can be published into another cohort's library.
 * Only an admin may tag a resource for a specific year or for everyone.
 */
export async function POST(request: Request) {
  try {
    const requester = await getRequester();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!requester.isAdmin && (!requester.allowed || !requester.cohort)) {
      return NextResponse.json(
        { error: 'Access denied', reason: requester.denialReason },
        { status: 403 }
      );
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { name, url, type, year: requestedYear } = body;

    if (!name || !url) {
      return NextResponse.json({ error: 'Missing name or url' }, { status: 400 });
    }

    let year: string;
    if (requester.isAdmin) {
      // Admins choose: one year, or the shared shelf.
      if (requestedYear !== SHARED_RESOURCE_TAG && !isCohort(requestedYear)) {
        return NextResponse.json(
          { error: `Invalid "year". Expected a cohort or "${SHARED_RESOURCE_TAG}".` },
          { status: 400 }
        );
      }
      year = requestedYear;
    } else {
      year = requester.cohort as Cohort;
    }

    const list = await readResourceList();

    /* One name, one document.
       Checked here rather than only in the browser because the client knows
       about its own shelf and the shared one, but an admin publishing to
       `Others` collides with every year at once — and only the server can see
       all of them. This is also the check that survives two students pressing
       Upload at the same moment. */
    const clash = findResourceNameClash(list, name, year);
    if (clash) {
      return NextResponse.json(
        {
          error:
            `Name not available — "${clash.name}" is already in this library. ` +
            'Please choose a different document name.',
          code: 'NAME_TAKEN',
          conflictsWith: { name: clash.name, year: clash.year },
        },
        { status: 409 }
      );
    }

    const newResource: StoredResource = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      url,
      type: type || 'pdf',
      year,
      uploadedBy: requester.email,
      uploaderName: requester.isAdmin ? 'Department' : requester.email.split('@')[0],
      createdAt: new Date().toISOString(),
    };

    const updatedList = [...list, newResource];
    await writeResourceList(updatedList);

    const viewingCohort = requester.isAdmin
      ? new URL(request.url).searchParams.get('cohort')
      : requester.cohort;

    const visible = isCohort(viewingCohort) ? visibleTo(viewingCohort, updatedList) : [];

    if (requester.isAdmin) {
      await AdminLog.record({
        actor: requester,
        action: 'library.create',
        summary: `Published "${newResource.name}" to the ${year} shared library`,
        target: newResource.name,
        cohort: year,
      });
    }

    return NextResponse.json({ success: true, resource: newResource, resources: visible });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to POST global resource:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

/**
 * Remove a resource. Uploaders can remove their own; admins can remove any.
 * A student cannot touch a resource they were never able to see.
 */
export async function DELETE(request: Request) {
  try {
    const requester = await getRequester();
    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!requester.isAdmin && (!requester.allowed || !requester.cohort)) {
      return NextResponse.json(
        { error: 'Access denied', reason: requester.denialReason },
        { status: 403 }
      );
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing resource ID' }, { status: 400 });
    }

    const list = await readResourceList();
    const itemToDelete = list.find((r) => r.id === id);

    if (!itemToDelete) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (!requester.isAdmin) {
      const cohort = requester.cohort as Cohort;
      const isUploader =
        (itemToDelete.uploadedBy || '').toLowerCase() === requester.email.toLowerCase();

      // Not visible to them means not theirs to act on — report it as missing
      // rather than confirming a resource exists in another year's library.
      if (!cohortCanSeeResource(cohort, itemToDelete.year)) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }
      // Only the uploader may remove it — which also means students can never
      // remove department-wide material they did not publish themselves.
      if (!isUploader) {
        return NextResponse.json({ error: 'Unauthorized to delete this resource' }, { status: 403 });
      }
    }

    const updatedList = list.filter((r) => r.id !== id);
    await writeResourceList(updatedList);

    const viewingCohort = requester.isAdmin
      ? new URL(request.url).searchParams.get('cohort')
      : requester.cohort;

    const visible = isCohort(viewingCohort) ? visibleTo(viewingCohort, updatedList) : [];

    if (requester.isAdmin) {
      await AdminLog.record({
        actor: requester,
        action: 'library.delete',
        summary: `Removed "${itemToDelete.name}" from the ${itemToDelete.year} shared library`,
        target: itemToDelete.name,
        cohort: itemToDelete.year,
      });
    }

    return NextResponse.json({ success: true, resources: visible });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Failed to DELETE global resource:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
