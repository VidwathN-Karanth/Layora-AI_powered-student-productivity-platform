import {
  corsPreflight, extensionJson, requireExtensionUser,
} from '@/lib/extensionAuth';
import {
  addQuickLauncher, listQuickLaunchers, normaliseUrl, removeQuickLauncher,
  reorderQuickLaunchers,
} from '@/lib/extensionData';

/** The student's quick launchers, favicons resolved. */
export async function GET(request: Request) {
  const guard = await requireExtensionUser(request);
  if (!guard.ok) return guard.response;

  try {
    return extensionJson({ launchers: await listQuickLaunchers(guard.requester.userId) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension GET quicklaunchers failed:', message);
    return extensionJson({ error: message }, 500);
  }
}

/** Adds one. The whole list comes back so the popup never has to guess order. */
export async function POST(request: Request) {
  const guard = await requireExtensionUser(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const url = normaliseUrl(body?.url);
    if (!url) {
      return extensionJson({ error: 'That does not look like a web address.' }, 400);
    }

    const name = typeof body?.name === 'string' && body.name.trim()
      ? body.name.trim()
      // No name given: the hostname is a better label than a bare URL.
      : new URL(url).hostname.replace(/^www\./, '');

    const launchers = await addQuickLauncher(guard.requester.userId, { name, url });
    return extensionJson({ launchers }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension POST quicklauncher failed:', message);
    return extensionJson({ error: message }, 500);
  }
}

/** Saves the order the student dragged their launchers into. */
export async function PATCH(request: Request) {
  const guard = await requireExtensionUser(request);
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const order = Array.isArray(body?.order) ? body.order.filter((id: unknown) => typeof id === 'string') : null;
    if (!order || order.length === 0) {
      return extensionJson({ error: 'Send the launcher ids in their new order.' }, 400);
    }

    const launchers = await reorderQuickLaunchers(guard.requester.userId, order);
    return extensionJson({ launchers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension PATCH quicklaunchers failed:', message);
    return extensionJson({ error: message }, 500);
  }
}

/** Removes one by id, scoped to the caller's own workspace. */
export async function DELETE(request: Request) {
  const guard = await requireExtensionUser(request);
  if (!guard.ok) return guard.response;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return extensionJson({ error: 'Missing id.' }, 400);

    const launchers = await removeQuickLauncher(guard.requester.userId, id);
    return extensionJson({ launchers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Extension DELETE quicklauncher failed:', message);
    return extensionJson({ error: message }, 500);
  }
}

export async function OPTIONS() {
  return corsPreflight();
}

export const dynamic = 'force-dynamic';
