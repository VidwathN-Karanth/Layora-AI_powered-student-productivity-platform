/**
 * Splits a pasted blob of addresses into a clean, de-duplicated email list.
 *
 * People paste from a spreadsheet column, a comma list, a chat message, or a
 * mail client's "to" field — so we accept any mix of newlines, commas,
 * semicolons, spaces and tabs as separators, lowercase everything, trim it, and
 * drop blanks and duplicates while preserving the order first seen.
 *
 * Pure and client-safe: the browser splits, the server re-validates each one.
 */
export function parseEmailList(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (input || '').split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Pulls a clean email list out of a request body that may carry either a single
 * `email` string or an `emails` array (or a string that itself holds several).
 * Everything is funnelled through parseEmailList, so callers get one shape.
 */
export function collectEmails(body: unknown): string[] {
  const b = (body ?? {}) as { email?: unknown; emails?: unknown };
  const parts: string[] = [];
  if (typeof b.email === 'string') parts.push(b.email);
  if (Array.isArray(b.emails)) {
    for (const e of b.emails) if (typeof e === 'string') parts.push(e);
  } else if (typeof b.emails === 'string') {
    parts.push(b.emails);
  }
  return parseEmailList(parts.join('\n'));
}
