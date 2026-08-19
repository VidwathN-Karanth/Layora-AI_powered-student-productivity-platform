/**
 * Client helper for talking to our own API routes.
 *
 * Two things it fixes, both of which have bitten us:
 *
 * 1. `next.config.ts` sets `trailingSlash: true`, so `/api/foo` is answered with
 *    a 308 redirect to `/api/foo/`. Browsers follow it, but it doubles every
 *    request and is a known source of flakiness on POSTs behind proxies.
 *    `apiUrl()` adds the slash up front so the redirect never happens.
 *
 * 2. When a route returns HTML instead of JSON — a 404 page, a framework error
 *    page, an auth redirect — calling `res.json()` throws
 *    `SyntaxError: Unexpected token '<', "<!doctype "...`, which then gets shown
 *    to the user as if it were the problem. `readJson()` reports the actual
 *    status instead, so the real failure is visible.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Adds the trailing slash Next expects, keeping any query string intact. */
export function apiUrl(path: string): string {
  const [pathname, query] = path.split('?');
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return query ? `${withSlash}?${query}` : withSlash;
}

/** `fetch`, but pointed at the non-redirecting URL. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

/**
 * Reads a response as JSON, turning every failure into an ApiError carrying a
 * message worth showing a user.
 */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON — almost always an HTML error or sign-in page.
    const kind = res.headers.get('content-type')?.split(';')[0] || 'an unknown content type';
    throw new ApiError(
      res.ok
        ? `The server returned ${kind} instead of data. Try reloading the page.`
        : `Request failed (HTTP ${res.status}). The server returned ${kind} instead of an error message.`,
      res.status
    );
  }

  if (!res.ok) {
    const fromBody =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : '';
    throw new ApiError(fromBody || `Request failed (HTTP ${res.status}).`, res.status, parsed);
  }

  return parsed as T;
}

/** Fetch and parse in one step. Throws ApiError with a usable message. */
export async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  return readJson<T>(await apiFetch(path, init));
}

/** Best-effort message for a caught error, for use in `catch` blocks. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
