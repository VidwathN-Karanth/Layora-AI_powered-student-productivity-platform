import 'server-only';

import { supabaseAdmin } from '../supabaseAdmin';
import { COHORTS, type Cohort } from '../cohorts';
import { type RepeatRule } from '../recurrence';

/** Everyone in the department, regardless of year. */
export const EVERYONE_AUDIENCE = 'Everyone';
/** Visible only to the student who created it. */
export const PERSONAL_AUDIENCE = 'Personal';

export type EventAudience = Cohort | typeof EVERYONE_AUDIENCE | typeof PERSONAL_AUDIENCE;

/** Audiences a staff member may post to: one year, or the whole department. */
export const STAFF_AUDIENCES = [...COHORTS, EVERYONE_AUDIENCE] as const;

export function isStaffAudience(value: unknown): value is Cohort | typeof EVERYONE_AUDIENCE {
  return typeof value === 'string' && (STAFF_AUDIENCES as readonly string[]).includes(value);
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  eventDate: string; // 'YYYY-MM-DD' — the first occurrence
  /** How the entry repeats. Occurrences are expanded on read, not stored. */
  repeat: RepeatRule;
  /** Last day the series may fall on; null means open-ended. */
  repeatUntil: string | null;
  audience: EventAudience;
  createdBy: string;
  creatorName: string | null;
  isStaff: boolean;
  createdAt: string;
}

interface DatabaseEventRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  repeat: string | null;
  repeat_until: string | null;
  audience: string;
  created_by: string;
  creator_name: string | null;
  is_staff: boolean;
  created_at: string;
}

function mapRow(row: DatabaseEventRow): EventRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    repeat: (row.repeat as RepeatRule) || 'none',
    repeatUntil: row.repeat_until ?? null,
    audience: row.audience as EventAudience,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    isStaff: row.is_staff,
    createdAt: row.created_at,
  };
}

export class Event {
  /**
   * Everything one student should see: their own entries, plus staff entries
   * aimed at their year or at the whole department.
   */
  static async findForStudent(userId: string, cohort: Cohort): Promise<EventRow[]> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .or(`created_by.eq.${userId},audience.eq.${cohort},audience.eq.${EVERYONE_AUDIENCE}`)
      .order('event_date', { ascending: true });

    if (error) throw new Error(`Failed to load events: ${error.message}`);

    // `created_by.eq` would also match this student's own rows regardless of
    // audience, which is what we want — but it must not pull in another
    // student's personal entries, so filter defensively.
    return (data || [])
      .map((r) => mapRow(r as DatabaseEventRow))
      .filter(
        (e) =>
          e.createdBy === userId ||
          e.audience === cohort ||
          e.audience === EVERYONE_AUDIENCE
      )
      .filter((e) => e.audience !== PERSONAL_AUDIENCE || e.createdBy === userId);
  }

  /** Staff entries for one year, plus department-wide ones. Admin console. */
  static async findForStaff(cohort: Cohort): Promise<EventRow[]> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .in('audience', [cohort, EVERYONE_AUDIENCE])
      .order('event_date', { ascending: true });

    if (error) throw new Error(`Failed to load events: ${error.message}`);
    return (data || []).map((r) => mapRow(r as DatabaseEventRow));
  }

  static async create(input: {
    title: string;
    description?: string | null;
    eventDate: string;
    repeat?: RepeatRule;
    repeatUntil?: string | null;
    audience: EventAudience;
    createdBy: string;
    creatorName?: string | null;
    isStaff?: boolean;
  }): Promise<EventRow> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        title: input.title,
        description: input.description ?? null,
        event_date: input.eventDate,
        repeat: input.repeat ?? 'none',
        // An end date is meaningless without a rule, so drop it for one-offs.
        repeat_until: input.repeat && input.repeat !== 'none' ? input.repeatUntil ?? null : null,
        audience: input.audience,
        created_by: input.createdBy,
        creator_name: input.creatorName ?? null,
        is_staff: input.isStaff ?? false,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create event: ${error.message}`);
    return mapRow(data as DatabaseEventRow);
  }

  static async findById(id: string): Promise<EventRow | null> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find event: ${error.message}`);
    }
    return mapRow(data as DatabaseEventRow);
  }

  static async remove(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('events').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete event: ${error.message}`);
  }
}
