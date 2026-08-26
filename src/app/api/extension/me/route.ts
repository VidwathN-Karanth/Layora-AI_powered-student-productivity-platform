import {
  corsPreflight, extensionJson, requireExtensionUser,
} from '@/lib/extensionAuth';

/** Who the extension is talking for. The popup's header and auth gate use this. */
export async function GET(request: Request) {
  const guard = await requireExtensionUser(request);
  if (!guard.ok) return guard.response;

  const { name, email, isAdmin, via } = guard.requester;
  return extensionJson({ connected: true, name, email, isAdmin, via });
}

export async function OPTIONS() {
  return corsPreflight();
}

export const dynamic = 'force-dynamic';
