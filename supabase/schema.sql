-- ==========================================
-- LAYORA SUPABASE SCHEMA DEFINITIONS
-- Run this in your Supabase SQL Editor.
-- ==========================================

-- 1. Create the user_states table to store serialized Zustand app states
create table if not exists public.user_states (
  id text primary key, -- Clerk User ID
  state jsonb not null, -- Serialized application settings, tasks, timetable blocks
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row-Level Security (RLS)
alter table public.user_states enable row level security;

-- 3. Create RLS Policies
-- SECURITY WARNING: All data modification and retrieval operations MUST go through the Next.js backend API routes.
-- The backend uses the Service Role key (bypassing RLS) and verifies authentication/authorization via Clerk.
-- Therefore, we disable public/anonymous read/write permissions directly from the frontend to ensure security.
-- If client-side realtime subscription is required, a select policy can be kept, but write operations are prohibited.

-- If you are using Clerk JWT template integration to authenticate directly with Supabase:
-- create policy "Enable read access for own user state row"
--   on public.user_states for select
--   using (auth.uid() = id); -- or using ((auth.jwt() ->> 'sub') = id)

-- Disallow public client-side writes entirely:
-- No public INSERT, UPDATE, or DELETE policies exist here anymore.

-- 4. Create the users table for external sync and account linking
create table if not exists public.users (
  id text primary key, -- Clerk User ID or generated ID
  name text not null,
  email text not null unique,
  leetcode_username text unique,
  github_username text unique,
  linkedin_url text,
  leetcode_easy_total integer not null default 0,
  leetcode_medium_total integer not null default 0,
  leetcode_hard_total integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create the daily_activities table for tracking points ledger
create table if not exists public.daily_activities (
  id serial primary key,
  user_id text not null references public.users(id) on delete cascade,
  date date not null,
  leetcode_solved_today integer not null default 0, -- Left for backward compatibility or daily calculated change
  github_contributions_today integer not null default 0,
  points_earned integer not null default 0,
  leetcode_easy_accumulated integer not null default 0,
  leetcode_medium_accumulated integer not null default 0,
  leetcode_hard_accumulated integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_user_date unique (user_id, date)
);

-- 6. Enable Row-Level Security (RLS) on new tables
alter table public.users enable row level security;
alter table public.daily_activities enable row level security;

-- 7. Create RLS Policies for new tables
-- Locked down: Public/anonymous direct database access is disabled.
-- All queries are handled securely via the Next.js API routes on the backend.

-- 8. Create Indexes for performance optimization
create index if not exists idx_daily_activities_date on public.daily_activities(date);
create index if not exists idx_users_codechef on public.users(codechef_username) where codechef_username is not null;



-- 9. Leaderboard aggregation
-- The leaderboard must never pull raw daily_activities rows into the app —
-- that is one row per student per day and grows without bound. This function
-- does the GROUP BY in Postgres and returns one already-summed row per
-- student. Pass p_user_ids to scope it to a single cohort.
create or replace function public.leaderboard_activity_totals(
  p_user_ids text[] default null,
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  user_id text,
  points bigint,
  leetcode_solved bigint,
  github_contributions bigint,
  codechef_solved bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    da.user_id,
    coalesce(sum(da.points_earned), 0)::bigint,
    coalesce(sum(da.leetcode_solved_today), 0)::bigint,
    coalesce(sum(da.github_contributions_today), 0)::bigint,
    coalesce(sum(da.codechef_solved_today), 0)::bigint
  from public.daily_activities da
  where (p_user_ids is null or da.user_id = any (p_user_ids))
    and (p_start_date is null or da.date >= p_start_date)
    and (p_end_date is null or da.date <= p_end_date)
  group by da.user_id;
$$;

-- Only the backend's service role may call this; the browser never talks to
-- Postgres directly in this app.
revoke all on function public.leaderboard_activity_totals(text[], date, date) from public;
revoke all on function public.leaderboard_activity_totals(text[], date, date) from anon;
revoke all on function public.leaderboard_activity_totals(text[], date, date) from authenticated;
grant execute on function public.leaderboard_activity_totals(text[], date, date) to service_role;

-- 10. Certificates
-- Only the link is stored. The PDF itself lives in the student's own Google
-- Drive, so a cohort of 800 uploading their course certificates costs the
-- department no Supabase storage at all.
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  name text not null,
  -- One of three fixed buckets, mirrored in src/lib/certificateCategories.ts.
  -- The admin console reports on them one at a time, so the set is closed.
  category text not null check (category in ('NPTEL', 'Course', 'Competitions')),
  file_url text not null, -- Google Drive share link, not a stored object
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.certificates enable row level security;

create index if not exists idx_certificates_user on public.certificates(user_id);

-- 11. Events
-- A repeating entry is ONE row with a rule, not one row per occurrence. The
-- occurrences are expanded when a range of the calendar is drawn — see
-- src/lib/recurrence.ts — so the table does not grow with the term and editing
-- or deleting a series is a single write.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null, -- the FIRST occurrence
  repeat text not null default 'none',
  repeat_until date,        -- null means open-ended
  audience text not null default 'Personal', -- a cohort, 'Everyone', or 'Personal'
  created_by text not null,
  creator_name text,
  is_staff boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint events_repeat_check check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  -- A series may not end before it starts.
  constraint events_repeat_until_check check (repeat_until is null or repeat_until >= event_date)
);

alter table public.events enable row level security;

create index if not exists idx_events_date on public.events(event_date);
create index if not exists idx_events_audience on public.events(audience);

-- 12. Admin audit log
-- Who opened the console, and the handful of actions that change what a
-- student sees. Deliberately not a record of reads: the value of the trail is
-- that every line in it matters. Rows live for 30 days and are swept by the
-- nightly cron (/api/cron/daily-sync), so this table never grows without end.
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  actor_email text not null,
  actor_name text,
  -- A closed set, mirrored in src/lib/models/AdminLog.ts.
  action text not null,
  -- One finished sentence, written server-side at the time of the action.
  summary text not null,
  -- What it happened to (an event title, a student's name), for the detail column.
  target text,
  -- The year group affected, when the action is scoped to one.
  cohort text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.admin_logs enable row level security;

-- Reads are always "newest first, last 30 days", and the purge deletes by the
-- same column.
create index if not exists idx_admin_logs_created on public.admin_logs(created_at desc);

-- ── One-off data migration: clear_default_preset_timetable_blocks (2026-08-25)
--
-- Recorded here for history, not to be re-run: on a fresh database it is a
-- no-op, and it was applied once to the live project.
--
-- The scheduler used to load a 25-block template into any planner whose owner
-- had no subjects and no tasks, and to inject a daily "Solve 1 LeetCode
-- Problem" block and a Sunday "Weekly AI Recap & Planning" block into everyone
-- else's. None of it came from the student. src/lib/scheduler.ts no longer
-- produces any of the three; this cleared what was already stored.
--
-- Blocks a student placed by hand (custom-block-*, ai-block-*) were never
-- touched, and neither was any block derived from their own subjects, tasks,
-- activities or courses. Signature matching rather than id matching, because
-- block ids collide between the template and the personalised path.
--
-- update public.user_states us
-- set state = jsonb_set(us.state, '{timetable}', coalesce((
--       select jsonb_agg(b)
--       from jsonb_array_elements(coalesce(us.state->'timetable', '[]'::jsonb)) b
--       where not (
--         (b->>'title' in ('Study: Review today''s lecture notes',
--                          'Study: Work on pending assignment',
--                          'Night Work / Self-study',
--                          'Study: Weekend Review',
--                          'Online Course Study'))
--         or (b->>'title' = 'Break' and b->>'details' = 'Afternoon rest break (30 min)')
--         or (b->>'title' in ('Solve 1 LeetCode Problem', 'Weekly AI Recap & Planning'))
--         or ((select jsonb_array_length(coalesce(us.state->'subjects', '[]'::jsonb))) = 0
--             and (select count(*) from jsonb_array_elements(coalesce(us.state->'tasks', '[]'::jsonb)) t
--                    where t->>'status' is distinct from 'completed') = 0
--             and b->>'id' not like 'custom-block-%' and b->>'id' not like 'ai-block-%')
--       )), '[]'::jsonb)), updated_at = now()
-- where jsonb_array_length(coalesce(us.state->'timetable', '[]'::jsonb)) > 0;
