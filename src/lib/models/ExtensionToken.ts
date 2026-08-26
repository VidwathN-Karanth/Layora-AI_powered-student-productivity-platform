import 'server-only';

import { createHash, randomBytes } from 'crypto';

import { supabaseAdmin } from '../supabaseAdmin';

/**
 * Pairing tokens for the browser extension.
 *
 * The extension cannot ride on the Clerk session cookie — a request from a
 * `chrome-extension://` popup is cross-site, and Clerk's cookie is SameSite=Lax,
 * so the browser drops it. Instead the student presses "Connect" on a normal
 * signed-in Layora page, which mints one token the extension keeps.
 *
 * Only the hash is stored, so this table is worthless to anyone who reads it.
 * The raw token is returned exactly once, at mint.
 */

/** Prefix makes a leaked token recognisable in a log or a paste. */
const PREFIX = 'lyx_';

/** Anything older than this without use is treated as abandoned. */
export const TOKEN_TTL_DAYS = 180;

export interface ExtensionTokenRow {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface DatabaseTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class ExtensionToken {
  /** A fresh token. The raw value is returned once and never stored. */
  static async mint(userId: string, label?: string | null): Promise<{ token: string; id: string }> {
    const token = PREFIX + randomBytes(32).toString('base64url');

    const { data, error } = await supabaseAdmin
      .from('extension_tokens')
      .insert({
        user_id: userId,
        token_hash: hash(token),
        label: label ? String(label).slice(0, 80) : null,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Could not create an extension token: ${error.message}`);
    return { token, id: (data as { id: string }).id };
  }

  /**
   * The owner of a presented token, or null.
   *
   * Null covers every failure the caller should treat identically — malformed,
   * unknown, revoked, or long abandoned — so a caller cannot accidentally leak
   * which one it was.
   */
  static async resolve(token: string | null | undefined): Promise<string | null> {
    if (!token || !token.startsWith(PREFIX)) return null;

    const { data, error } = await supabaseAdmin
      .from('extension_tokens')
      .select('*')
      .eq('token_hash', hash(token))
      .maybeSingle();

    if (error || !data) return null;

    const row = data as DatabaseTokenRow;
    if (row.revoked_at) return null;

    const age = Date.now() - new Date(row.last_used_at || row.created_at).getTime();
    if (age > TOKEN_TTL_DAYS * 86_400_000) return null;

    // Touch at most once an hour: the popup opens often, and a write per open
    // would cost more than the freshness is worth.
    const lastUsed = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
    if (Date.now() - lastUsed > 3_600_000) {
      await supabaseAdmin
        .from('extension_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', row.id);
    }

    return row.user_id;
  }

  /** What the student sees in Settings — never the tokens themselves. */
  static async listForUser(userId: string): Promise<ExtensionTokenRow[]> {
    const { data, error } = await supabaseAdmin
      .from('extension_tokens')
      .select('id, label, created_at, last_used_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Could not list extension tokens: ${error.message}`);
    return (data || []).map((r) => {
      const row = r as Pick<DatabaseTokenRow, 'id' | 'label' | 'created_at' | 'last_used_at'>;
      return {
        id: row.id,
        label: row.label,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
      };
    });
  }

  /** Revoking is scoped to the owner, so an id alone is not enough to kill someone else's. */
  static async revoke(userId: string, id: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('extension_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .select('id');

    if (error) throw new Error(`Could not revoke the extension token: ${error.message}`);
    return (data || []).length > 0;
  }
}
