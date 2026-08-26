import 'server-only';

import { NextResponse } from 'next/server';

import { getRequester } from './authz';
import { isAdminEmail } from './admin';
import { isOnRoster } from './roster';
import { ExtensionToken } from './models/ExtensionToken';
import { User } from './models/User';

/**
 * Who is calling an `/api/extension/*` route.
 *
 * Two ways in, in this order:
 *
 *  1. A pairing token in `Authorization: Bearer lyx_…`. This is the path the
 *     extension actually uses, because a popup's fetch is cross-site and the
 *     Clerk session cookie is SameSite=Lax — the browser will not send it.
 *  2. The ordinary Clerk session cookie, so the same endpoints work from a
 *     signed-in Layora tab (handy for the connect page and for testing).
 *
 * Either way the roster is checked again here. A token is a long-lived thing;
 * a student removed from the roster after pairing must lose access on their
 * next request, not at some renewal that never comes.
 */

export interface ExtensionRequester {
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  /** How they authenticated, for the response so the popup can show its state. */
  via: 'token' | 'session';
}

type Guard =
  | { ok: true; requester: ExtensionRequester }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string, reason?: string): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json({ error, reason }, { status, headers: CORS_HEADERS }),
  };
}

/**
 * Chrome grants an extension cross-origin access to hosts in its
 * `host_permissions` without CORS, but Firefox and any future web caller still
 * need these. No `Allow-Credentials`: token auth carries no cookies, and
 * echoing a wildcard with credentials is not allowed anyway.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** Answers the preflight every non-Chrome caller sends. */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** JSON with the CORS headers attached, so no route has to remember them. */
export function extensionJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

function bearerFrom(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function requireExtensionUser(request: Request): Promise<Guard> {
  const token = bearerFrom(request);

  if (token) {
    const userId = await ExtensionToken.resolve(token);
    if (!userId) return deny(401, 'This extension is not connected to a Layora account.', 'bad_token');

    const user = await User.findById(userId);
    const email = (user?.email || '').trim();
    if (!email) return deny(401, 'That account no longer exists.', 'no_user');

    const admin = isAdminEmail(email);
    if (!admin && !isOnRoster(email)) {
      return deny(403, 'This account is not on the CSE roster.', 'not_on_roster');
    }

    return {
      ok: true,
      requester: {
        userId,
        email,
        name: user?.name || email.split('@')[0],
        isAdmin: admin,
        via: 'token',
      },
    };
  }

  // No token: fall back to a signed-in Layora tab.
  const requester = await getRequester();
  if (!requester) return deny(401, 'Sign in to Layora first.', 'signed_out');
  if (!requester.isAdmin && !requester.allowed) {
    return deny(403, 'This account is not on the CSE roster.', requester.denialReason || 'not_allowed');
  }

  return {
    ok: true,
    requester: {
      userId: requester.userId,
      email: requester.email,
      name: requester.name,
      isAdmin: requester.isAdmin,
      via: 'session',
    },
  };
}

/**
 * A signed-in Layora page — student or admin — with no token path.
 *
 * Minting a pairing token is deliberately session-only: a token is handed to a
 * person sitting in front of a signed-in page pressing Connect. If a token
 * could mint another token, one leak would become permanent access.
 */
export async function requireStudentOrAdmin(): Promise<Guard> {
  const requester = await getRequester();
  if (!requester) return deny(401, 'Sign in to Layora first.', 'signed_out');
  if (!requester.isAdmin && !requester.allowed) {
    return deny(403, 'This account is not on the CSE roster.', requester.denialReason || 'not_allowed');
  }

  return {
    ok: true,
    requester: {
      userId: requester.userId,
      email: requester.email,
      name: requester.name,
      isAdmin: requester.isAdmin,
      via: 'session',
    },
  };
}
