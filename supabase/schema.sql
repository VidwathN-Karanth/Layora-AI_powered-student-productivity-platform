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
-- Note: Authentication is managed securely on the client via Clerk identity tokens.
-- To allow the client application to query/sync their specific row, we establish policies 
-- where read/write operations are permitted.

-- Allow select query on user state row
create policy "Enable read access for all users by matching user ID"
  on public.user_states for select
  using (true);

-- Allow insert query on user state row
create policy "Enable insert access for all users"
  on public.user_states for insert
  with check (true);

-- Allow update query on user state row
create policy "Enable update access for all users"
  on public.user_states for update
  using (true)
  with check (true);

-- Allow delete query on user state row
create policy "Enable delete access for all users by user ID"
  on public.user_states for delete
  using (true);

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
create policy "Allow read access to users for all" on public.users for select using (true);
create policy "Allow read access to daily_activities for all" on public.daily_activities for select using (true);

-- 8. Create Indexes for performance optimization
create index if not exists idx_daily_activities_date on public.daily_activities(date);
create index if not exists idx_users_codechef on public.users(codechef_username) where codechef_username is not null;


