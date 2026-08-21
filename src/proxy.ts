import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isOnRoster } from "@/lib/roster";
import { isAdminEmail } from "@/lib/admin";

// Define which routes are protected
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/admin(.*)'
]);

/**
 * The signed-in email, if the session token carries it.
 *
 * Clerk only puts the address in the session token when the instance is
 * configured to — Dashboard → Sessions → Customize session token, with
 * `{"email": "{{user.primary_email_address}}"}`. Several key names are tried
 * because that claim can be named by whoever set it up.
 *
 * Returning null is not a failure: it means the roster is checked one step
 * later instead, by SyncProvider before it renders anything.
 */
function emailFromClaims(claims: Record<string, unknown> | null | undefined): string | null {
  if (!claims) return null;

  for (const key of ['email', 'primaryEmail', 'email_address', 'primary_email_address']) {
    const value = claims[key];
    if (typeof value === 'string' && value.includes('@')) return value;
  }
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Send unauthenticated visitors to our own /login page.
    //
    // Without `unauthenticatedUrl`, auth.protect() redirects to Clerk's hosted
    // sign-in on <instance>.accounts.dev — a different origin, where our
    // Google-only styling cannot reach and the email/password form is still
    // offered. Naming the URL keeps sign-in inside the app.
    await auth.protect({
      unauthenticatedUrl: new URL('/login', req.url).toString(),
    });

    // Roster check, as early as it can happen.
    //
    // Every API route already enforces this, and SyncProvider gates the shell,
    // but both of those run after the browser has been handed a page. Doing it
    // here means an address that is not on the roster never reaches /dashboard
    // at all — no flash of a workspace it is not entitled to.
    const { sessionClaims } = await auth();
    const email = emailFromClaims(sessionClaims as Record<string, unknown> | null);

    if (email) {
      const allowed = isAdminEmail(email) || isOnRoster(email);
      if (!allowed && !req.nextUrl.pathname.startsWith('/access-denied')) {
        return NextResponse.redirect(new URL('/access-denied', req.url));
      }
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
