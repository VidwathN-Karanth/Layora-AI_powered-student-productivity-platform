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

/**
 * The workspaces this extension can talk to.
 *
 * Both are the same application deployed at their own origin, so they expose an
 * identical `/api/extension/*` API and an identical `/extension` connect page —
 * which is what lets one extension serve both with no per-workspace special
 * casing. Everything downstream keys off a workspace id (`layora`,
 * `clubcrumbs`); the origins live only here.
 *
 * Every origin listed here must also appear in `host_permissions`,
 * `externally_connectable.matches` and `content_scripts.matches` in
 * manifest.json, or the browser blocks the fetch and the pairing message.
 */
export const SERVICES = {
  layora: {
    id: 'layora',
    label: 'Layora',
    origin: 'https://layora239.vercel.app',
  },
  clubcrumbs: {
    id: 'clubcrumbs',
    label: 'Club-Crumbs',
    origin: 'https://club-crumbs.vercel.app',
  },
};

/** Workspace ids in the order the switcher shows them. */
export const SERVICE_IDS = ['layora', 'clubcrumbs'];

/** Which workspace a fresh install opens to, before anything is connected. */
export const DEFAULT_SERVICE = 'layora';

/** The pages the popup links out to, derived from a workspace's origin. */
export function serviceUrls(serviceId) {
  const origin = SERVICES[serviceId].origin;
  return {
    dashboard: `${origin}/dashboard`,
    connect: `${origin}/extension`,
    courses: `${origin}/dashboard/courses`,
  };
}

/**
 * Which workspace a message or fetch came from, by its origin.
 *
 * The service worker uses this to file an incoming pairing token under the
 * right workspace: the token is trusted because of *where* it came from, so the
 * same origin check that authorises the message also names the workspace.
 */
export function serviceForOrigin(origin) {
  if (!origin) return null;
  return SERVICE_IDS.find((id) => origin.startsWith(SERVICES[id].origin)) || null;
}

/* ── storage ─────────────────────────────────────────────────── */

// One token and one cache per workspace, so both can be connected at once and
// switching between them is instant and works offline.
const tokenKey = (serviceId) => `token.${serviceId}`;
const cacheKey = (serviceId) => `cache.${serviceId}`;
const ACTIVE_KEY = 'activeService';
const TAB_KEY = 'layora.tab';

// The keys used before this extension knew about more than one workspace.
// Migrated into the Layora slot once, so an existing student stays connected
// across the update instead of being silently signed out.
const LEGACY_TOKEN_KEY = 'layora.token';
const LEGACY_CACHE_KEY = 'layora.cache';

/**
 * Move a pre-dual-workspace install's token and cache into the Layora slot.
 *
 * Safe to call on every startup: it only copies a legacy key that has no
 * modern counterpart yet, then clears the legacy key so it cannot be copied a
 * second time or override a later real value.
 */
export async function migrateLegacy() {
  const stored = await ext.storage.local.get([
    LEGACY_TOKEN_KEY,
    LEGACY_CACHE_KEY,
    tokenKey('layora'),
    cacheKey('layora'),
  ]);

  const patch = {};
  if (stored[LEGACY_TOKEN_KEY] && !stored[tokenKey('layora')]) {
    patch[tokenKey('layora')] = stored[LEGACY_TOKEN_KEY];
  }
  if (stored[LEGACY_CACHE_KEY] && !stored[cacheKey('layora')]) {
    patch[cacheKey('layora')] = stored[LEGACY_CACHE_KEY];
  }

  if (Object.keys(patch).length) await ext.storage.local.set(patch);
  if (stored[LEGACY_TOKEN_KEY] || stored[LEGACY_CACHE_KEY]) {
    await ext.storage.local.remove([LEGACY_TOKEN_KEY, LEGACY_CACHE_KEY]);
  }
}

export async function getToken(serviceId) {
  const stored = await ext.storage.local.get(tokenKey(serviceId));
  return stored[tokenKey(serviceId)] || null;
}

export async function setToken(serviceId, token) {
  await ext.storage.local.set({ [tokenKey(serviceId)]: token });
}

export async function clearToken(serviceId) {
  await ext.storage.local.remove([tokenKey(serviceId), cacheKey(serviceId)]);
}

/** The workspaces that currently hold a pairing token, in switcher order. */
export async function connectedServices() {
  const stored = await ext.storage.local.get(SERVICE_IDS.map(tokenKey));
  return SERVICE_IDS.filter((id) => Boolean(stored[tokenKey(id)]));
}

/** Last good payload for a workspace, so its popup draws instantly. */
export async function readCache(serviceId) {
  const stored = await ext.storage.local.get(cacheKey(serviceId));
  return stored[cacheKey(serviceId)] || null;
}

export async function writeCache(serviceId, patch) {
  const current = (await readCache(serviceId)) || {};
  await ext.storage.local.set({
    [cacheKey(serviceId)]: { ...current, ...patch, fetchedAt: Date.now() },
  });
}

/** The workspace the popup should open to. Falls back to the default. */
export async function getActiveService() {
  const stored = await ext.storage.local.get(ACTIVE_KEY);
  const id = stored[ACTIVE_KEY];
  return SERVICES[id] ? id : DEFAULT_SERVICE;
}

export async function setActiveService(serviceId) {
  await ext.storage.local.set({ [ACTIVE_KEY]: serviceId });
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
 * One call to a workspace.
 *
 * The token goes in an Authorization header rather than relying on the session
 * cookie: a popup's fetch is cross-site, and Clerk's cookie is SameSite=Lax, so
 * the browser would not attach it. `credentials: 'include'` is still set so
 * that a browser which *does* send it keeps working without a token. Each
 * workspace carries its own token, so the id picks both the origin and the
 * credential.
 */
export async function api(serviceId, path, options = {}) {
  const service = SERVICES[serviceId];
  if (!service) throw new ApiError(`Unknown workspace: ${serviceId}`, 0);

  const token = await getToken(serviceId);

  const response = await fetch(`${service.origin}${path}`, {
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
      (body && body.error) || `${service.label} returned ${response.status}.`,
      response.status,
      body && body.reason
    );
  }

  return body;
}

/** Everything the popup needs for one workspace, in one round trip pair. */
export async function fetchAll(serviceId) {
  const [me, launchers, courses] = await Promise.all([
    api(serviceId, '/api/extension/me/'),
    api(serviceId, '/api/extension/quicklaunchers/'),
    api(serviceId, '/api/extension/courses/'),
  ]);

  return {
    me,
    launchers: launchers.launchers || [],
    courses: courses.courses || [],
  };
}
