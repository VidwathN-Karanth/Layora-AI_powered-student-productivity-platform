import 'server-only';

import { supabaseAdmin } from '../supabaseAdmin';

/**
 * The admin audit trail.
 *
 * Deliberately not a record of everything: reads, page views and cohort
 * switches are noise. What lands here is a console sign-in and the actions
 * that change what a student sees or takes something away from them — posting
 * or removing a department event, editing or deleting a student, touching the
 * shared library, exporting a year's data, forcing a stats sync.
 *
 * Rows are kept for RETENTION_DAYS and swept nightly by /api/cron/daily-sync.
 */

/** How long a line stays. The reader filters by this too, so a failed sweep
 *  can never surface something older than the window. */
export const RETENTION_DAYS = 30;

/** The closed set of things worth a line. */
export const ADMIN_ACTIONS = [
  'admin.access',
  'event.create',
  'event.delete',
  'student.update',
  'student.delete',
  'library.create',
  'library.delete',
  'users.export',
  'stats.sync',
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export interface AdminLogRow {
  id: string;
  actorId: string;
  actorEmail: string;
  actorName: string | null;
  action: AdminAction;
  summary: string;
  target: string | null;
  cohort: string | null;
  createdAt: string;
}

interface DatabaseAdminLogRow {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_name: string | null;
  action: string;
  summary: string;
  target: string | null;
  cohort: string | null;
  created_at: string;
}

function mapRow(row: DatabaseAdminLogRow): AdminLogRow {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    action: row.action as AdminAction,
    summary: row.summary,
    target: row.target,
    cohort: row.cohort,
    createdAt: row.created_at,
  };
}

/** The actor, as every caller already has it from the auth guard. */
export interface AdminActor {
  userId: string;
  email: string;
  name?: string | null;
}

function cutoffIso(days = RETENTION_DAYS): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export class AdminLog {
  /**
   * Writes one line.
   *
   * Never throws and never rejects: an audit line is a side effect of the real
   * work, and a logging failure must not turn a successful delete into a 500
   * for the admin who asked for it. A failure is a server console warning.
   */
  static async record(input: {
    actor: AdminActor;
    action: AdminAction;
    summary: string;
    target?: string | null;
    cohort?: string | null;
  }): Promise<void> {
    try {
      const { error } = await supabaseAdmin.from('admin_logs').insert({
        actor_id: input.actor.userId,
        actor_email: input.actor.email,
        actor_name: input.actor.name ?? null,
        action: input.action,
        summary: input.summary.slice(0, 300),
        target: input.target ? input.target.slice(0, 200) : null,
        cohort: input.cohort ?? null,
      });
      if (error) throw new Error(error.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AdminLog] Could not record ${input.action}: ${msg}`);
    }
  }

  /**
   * A console sign-in, at most once per `windowMinutes` per admin.
   *
   * The console re-mounts on every navigation and refresh; without this the
   * log would be a wall of one admin arriving forty times in an afternoon.
   */
  static async recordAccess(actor: AdminActor, windowMinutes = 30): Promise<void> {
    try {
      const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('admin_logs')
        .select('id')
        .eq('actor_id', actor.userId)
        .eq('action', 'admin.access')
        .gte('created_at', since)
        .limit(1);

      if (error) throw new Error(error.message);
      if (data && data.length > 0) return;
    } catch (err: unknown) {
      // Could not check for a recent line — write one rather than lose the
      // arrival entirely. A duplicate is cheaper than a gap in the trail.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AdminLog] Access de-duplication check failed: ${msg}`);
    }

    await AdminLog.record({
      actor,
      action: 'admin.access',
      summary: 'Opened the admin console',
    });
  }

  /** Newest first, inside the retention window. */
  static async recent(limit = 200): Promise<AdminLogRow[]> {
    const { data, error } = await supabaseAdmin
      .from('admin_logs')
      .select('*')
      .gte('created_at', cutoffIso())
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    if (error) throw new Error(`Failed to load the admin log: ${error.message}`);
    return (data || []).map((r) => mapRow(r as DatabaseAdminLogRow));
  }

  /** Drops everything past the window. Returns how many lines went. */
  static async purgeExpired(days = RETENTION_DAYS): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('admin_logs')
      .delete()
      .lt('created_at', cutoffIso(days))
      .select('id');

    if (error) throw new Error(`Failed to purge the admin log: ${error.message}`);
    return (data || []).length;
  }
}
