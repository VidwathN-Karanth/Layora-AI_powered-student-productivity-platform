/**
 * Which surface a signed-in account belongs on.
 *
 * Students get the workspace, admins get the console, and neither is allowed to
 * wander into the other's half. The middleware asks this on every protected
 * navigation, which is exactly why it lives here as a pure function rather than
 * inline: a wrong answer is a redirect loop, and a redirect loop locks every
 * signed-in user out of the whole app. This shape can be tested without a
 * browser, a session, or a running server.
 *
 * Returns the path to redirect to, or null to let the request through.
 *
 * The one rule that keeps it loop-free: it only ever returns a path that would
 * itself answer null on the next pass.
 */
export function redirectForRole(pathname: string, isAdmin: boolean): string | null {
  const onAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdmin) return onAdmin ? null : '/admin';
  return onAdmin ? '/dashboard' : null;
}
