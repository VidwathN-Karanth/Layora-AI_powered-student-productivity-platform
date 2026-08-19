import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes are protected
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding(.*)',
  '/admin(.*)'
]);

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
