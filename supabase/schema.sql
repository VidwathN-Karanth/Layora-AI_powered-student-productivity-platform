-- PostgreSQL Schema for AI Student Productivity App (Supabase compatible)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text,
  wake_time text default '06:00',
  sleep_time text default '22:00',
  free_time_blocks jsonb default '[]'::jsonb, -- e.g., [{"start": "18:00", "end": "21:00"}]
  college_timings jsonb default '{"start": "09:00", "end": "16:00", "days": [1,2,3,4,5]}'::jsonb,
  streak_count integer default 0,
  last_active_date date,
  total_study_hours numeric(6,2) default 0.00
);

-- SUBJECTS TABLE
create table if not exists public.subjects (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  code text,
  credits integer default 3,
  difficulty text default 'Medium', -- Easy, Medium, Hard
  priority text default 'Medium', -- Low, Medium, High
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- STUDY MATERIALS / RESOURCES TABLE
create table if not exists public.resources (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  file_url text not null,
  file_type text, -- pdf, pptx, docx, txt
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- EXTRA ACTIVITIES TABLE
create table if not exists public.activities (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null, -- Gym, Chess, Meditation, Music, etc.
  duration_minutes integer default 60,
  preferred_timings text, -- morning, evening, afternoon
  priority text default 'Medium', -- Low, Medium, High
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- FREQUENTLY USED WEBSITES TABLE
create table if not exists public.websites (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null, -- LeetCode, GitHub, etc.
  url text not null,
  time_spent_goal_minutes integer default 30,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ACTIVE COURSES TABLE
create table if not exists public.courses (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  platform text, -- Coursera, Udemy, YouTube, etc.
  progress_percent integer default 0,
  weekly_goal_hours integer default 2,
  deadline date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TASKS TABLE
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  deadline timestamp with time zone,
  estimated_minutes integer default 60,
  actual_minutes_spent integer default 0,
  status text default 'pending', -- pending, in_progress, completed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- WEEKLY SCHEDULE BLOCKS (AI Generated or User Adjusted)
create table if not exists public.schedules (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week integer not null, -- 0 (Sunday) to 6 (Saturday)
  start_time text not null, -- 'HH:MM'
  end_time text not null, -- 'HH:MM'
  activity_type text not null, -- 'study', 'class', 'extracurricular', 'break'
  subject_id uuid references public.subjects(id) on delete set null,
  custom_title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) policies setup
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.resources enable row level security;
alter table public.activities enable row level security;
alter table public.websites enable row level security;
alter table public.courses enable row level security;
alter table public.tasks enable row level security;
alter table public.schedules enable row level security;

-- Setup RLS Rules (Owners can read/write their own records only)
create policy "Users can view and edit own profiles"
  on public.profiles for all using (auth.uid() = id);

create policy "Users can view and edit own subjects"
  on public.subjects for all using (auth.uid() = profile_id);

create policy "Users can view and edit own resources"
  on public.resources for all using (auth.uid() = profile_id);

create policy "Users can view and edit own activities"
  on public.activities for all using (auth.uid() = profile_id);

create policy "Users can view and edit own websites"
  on public.websites for all using (auth.uid() = profile_id);

create policy "Users can view and edit own courses"
  on public.courses for all using (auth.uid() = profile_id);

create policy "Users can view and edit own tasks"
  on public.tasks for all using (auth.uid() = profile_id);

create policy "Users can view and edit own schedules"
  on public.schedules for all using (auth.uid() = profile_id);
