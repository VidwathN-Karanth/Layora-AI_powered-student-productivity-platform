import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
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
 * The signed-in email as carried in the session token, when it is there.
 *
 * Clerk only includes the address if the instance is configured to (Dashboard →
 * Sessions → Customize session token). Several key names are tried because
 * whoever configured it chose the name. Free, when it works.
 */
function emailFromClaims(claims: Record<string, unknown> | null | undefined): string | null {
  if (!claims) return null;

  for (const key of ['email', 'primaryEmail', 'email_address', 'primary_email_address']) {
    const value = claims[key];
    if (typeof value === 'string' && value.includes('@')) return value;
  }
  return null;
}

/**
 * The signed-in email, whatever it takes.
 *
 * Falls back to the Clerk Backend API when the session token has no address.
 * That costs one request per protected navigation, which is the price of this
 * gate needing no Dashboard configuration to work — and the alternative was an
 * account seeing onboarding and the dashboard before being told no.
 */
async function resolveEmail(
  claims: Record<string, unknown> | null | undefined,
  userId: string | null | undefined
): Promise<string | null> {
  const fromToken = emailFromClaims(claims);
  if (fromToken) return fromToken;
  if (!userId) return null;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || null;
  } catch {
    // Clerk unreachable. Returning null hands the decision to SyncProvider,
    // which now denies rather than renders on a protected route.
    return null;
  }
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

    // Roster check, before a single byte of the workspace is sent.
    //
    // Every API route already enforces this and SyncProvider gates the shell,
    // but both run after the browser has been handed a page — which is why a
    // non-college account used to see onboarding and the dashboard first and
    // only then be told no.
    const { userId, sessionClaims } = await auth();
    const email = await resolveEmail(sessionClaims as Record<string, unknown> | null, userId);

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
