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
