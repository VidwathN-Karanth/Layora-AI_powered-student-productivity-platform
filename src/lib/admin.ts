import 'server-only';

/**
 * Who the department admins are.
 *
 * Server-only, and that import is the whole point rather than a formality: this
 * module used to be imported by browser-side pages — including the public
 * landing page — which meant Next bundled all three addresses into JavaScript
 * served to every visitor of the site, signed in or not. The list is not a
 * credential, but it names exactly which three Google accounts to go after to
 * own the department's data, and nobody needs to be told that.
 *
 * The marker makes that a build failure instead of a silent leak: import this
 * from a client component and the build stops.
 *
 * The browser never needs the list — only whether *it* is an admin. /api/me
 * answers that, and SyncProvider puts the boolean in the store as `isAdmin`.
 * Authorization itself never rests on that flag; every admin route re-checks
 * server-side through requireAdmin() in authz.ts.
 */
export const ADMIN_EMAILS = [
  'vidwathkaranth@gmail.com',
  'shreejith@mite.ac.in',
  'ravinarayana@mite.ac.in'
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
