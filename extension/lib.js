/**
 * Shared bits for the popup and the service worker.
 *
 * Plain ES modules, no bundler: the popup is two lists, and a build step would
 * mean the folder could not be loaded unpacked as-is.
 */

/**
 * The extension API namespace, under whichever name this browser gives it.
 *
 * Chromium exposes `chrome` and returns promises from MV3 APIs. Firefox exposes
 * `browser` for the promise-based API and keeps `chrome` as a callback-style
 * alias, so awaiting `chrome.storage.local.get()` there can hand back undefined
 * instead of the stored value. Binding once, here, is the whole difference.
 */
export const ext = globalThis.browser ?? globalThis.chrome;

/**
 * True on Firefox.
 *
 * Chromium does not define `browser` at all, which makes this the standard
 * test. Only the message plumbing needs it: the two engines disagree about how
 * a listener returns an asynchronous reply.
 */
export const IS_GECKO = typeof globalThis.browser !== 'undefined';

/** The Layora deployment this extension talks to. Must match host_permissions. */
export const LAYORA_ORIGIN = 'https://layora239.vercel.app';

export const DASHBOARD_URL = `${LAYORA_ORIGIN}/dashboard`;
export const CONNECT_URL = `${LAYORA_ORIGIN}/extension`;
export const COURSES_URL = `${LAYORA_ORIGIN}/dashboard/courses`;

const TOKEN_KEY = 'layora.token';
const CACHE_KEY = 'layora.cache';
const TAB_KEY = 'layora.tab';

/* ── storage ─────────────────────────────────────────────────── */

export async function getToken() {
  const stored = await ext.storage.local.get(TOKEN_KEY);
  return stored[TOKEN_KEY] || null;
}

export async function setToken(token) {
  await ext.storage.local.set({ [TOKEN_KEY]: token });
}

export async function clearToken() {
  await ext.storage.local.remove([TOKEN_KEY, CACHE_KEY]);
}

/** Last good payload, so an opening popup has something to draw immediately. */
export async function readCache() {
  const stored = await ext.storage.local.get(CACHE_KEY);
  return stored[CACHE_KEY] || null;
}

export async function writeCache(patch) {
  const current = (await readCache()) || {};
  await ext.storage.local.set({
    [CACHE_KEY]: { ...current, ...patch, fetchedAt: Date.now() },
  });
}

export async function getLastTab() {
  const stored = await ext.storage.local.get(TAB_KEY);
  return stored[TAB_KEY] || 'launchers';
}

export async function setLastTab(tab) {
  await ext.storage.local.set({ [TAB_KEY]: tab });
}

/* ── api ─────────────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(message, status, reason) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

/**
 * One call to Layora.
 *
 * The token goes in an Authorization header rather than relying on the session
 * cookie: a popup's fetch is cross-site, and Clerk's cookie is SameSite=Lax, so
 * the browser would not attach it. `credentials: 'include'` is still set so
 * that a browser which *does* send it keeps working without a token.
 */
export async function api(path, options = {}) {
  const token = await getToken();

  const response = await fetch(`${LAYORA_ORIGIN}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // A gateway error page, most likely. Fall through to the status check.
  }

  if (!response.ok) {
    throw new ApiError(
      (body && body.error) || `Layora returned ${response.status}.`,
      response.status,
      body && body.reason
    );
  }

  return body;
}

/** Everything the popup needs, in one round trip pair. */
export async function fetchAll() {
  const [me, launchers, courses] = await Promise.all([
    api('/api/extension/me/'),
    api('/api/extension/quicklaunchers/'),
    api('/api/extension/courses/'),
  ]);

  return {
    me,
    launchers: launchers.launchers || [],
    courses: courses.courses || [],
  };
}
