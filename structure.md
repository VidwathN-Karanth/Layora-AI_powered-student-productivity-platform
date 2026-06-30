# Layora Architecture & System Structure

Layora is a high-performance, next-generation AI-powered student productivity platform built as a serverless Next.js web application. It integrates developer activity metrics (LeetCode, GitHub, CodeChef) with scheduling, Google Calendar, academic progress tracking, and an autonomous AI planning mentor.

---

## 1. System Architecture Overview

```mermaid
flowchart TB
    %% Client Tier
    subgraph Client ["Client Tier (Browser)"]
        UI["React 19 / Tailwind CSS 4 UI"]
        Zustand["Zustand Store (Zustand State)"]
        ClerkUI["Clerk Auth Widgets"]
    end

    %% Gateway Tier
    subgraph Gateway ["Middleware & Routing"]
        ClerkMiddleware["Clerk Middleware (Route Protection & Token Check)"]
    end

    %% Application Server Tier
    subgraph Server ["Server Tier (Next.js App Router)"]
        APIAdmin["/api/admin/* (Admin Operations)"]
        APIUser["/api/user/* (User State & Purging)"]
        APIAI["/api/ai/* (Groq AI Agent / Schedule Engine)"]
        APICalendar["/api/calendar/sync (Google Calendar Sync)"]
        APIGitHub["/api/resources/upload-drive (Google Drive Uploads)"]
        CronSync["/api/cron/daily-sync (Scheduled Activity Sync)"]
        SyncLogic["syncLogic.ts (Activity Aggregator & Points Calculator)"]
    end

    %% External Services Tier
    subgraph External ["External Services Tier"]
        ClerkAuth["Clerk Identity Provider"]
        GroqAI["Groq Llama 3.1 8B LLM"]
        GoogleCalendar["Google Calendar API"]
        GoogleDrive["Google Drive API"]
        LeetCodeAPI["LeetCode GraphQL Engine"]
        CodeChefScraper["CodeChef Solve Scraping Engine"]
        GitHubAPI["GitHub Events API"]
    end

    %% Database Tier
    subgraph DB ["Database Tier (Supabase)"]
        SupabaseDB["PostgreSQL Database (RLS Enabled)"]
        SupabaseStorage["Supabase Storage (Certificates bucket)"]
    end

    %% Core Data Flows
    UI -->|API Requests + Auth JWT| ClerkMiddleware
    ClerkMiddleware --> APIAdmin & APIUser & APIAI & APICalendar & APIGitHub & CronSync
    
    %% DB Queries
    APIAdmin & APIUser & CronSync -->|supabaseAdmin (Service Role bypass RLS)| SupabaseDB
    APIUser -->|storage.from().upload()| SupabaseStorage
    
    %% External API calls
    APIAI -->|Structured JSON Requests| GroqAI
    APICalendar -->|OAuth Tokens from Clerk| GoogleCalendar
    APIGitHub -->|OAuth Tokens from Clerk| GoogleDrive
    SyncLogic -->|Scrape / Query| LeetCodeAPI & CodeChefScraper & GitHubAPI
    CronSync --> SyncLogic
    
    %% Clerk identity checks
    ClerkMiddleware -->|Validate Tokens| ClerkAuth
```

---

## 2. Technical Technology Stack

### Frontend Architecture
*   **Core Framework**: Next.js 16 (App Router) & React 19.
*   **State Management**: Zustand (v5) client-side store acting as a single transaction layer.
*   **Styling**: Tailwind CSS (v4) with Custom Glassmorphism effects and custom animations.
*   **UI Components & Icons**: Lucide React icons, Framer Motion for micro-animations.
*   **Authentication Widgets**: Clerk (`@clerk/nextjs`) login, signup, and user status profile buttons.

### Backend Infrastructure
*   **API Framework**: Next.js Route Handlers.
*   **Database Client**: Supabase JS client (`@supabase/supabase-js`) in Serverless functions.
*   **Authentication & Authorization Server**: Clerk Server SDK (`@clerk/nextjs/server`) checking user identity via asynchronous `auth()` token verification.
*   **External APIs**: Fetch API for calling Groq AI endpoints, Google Calendar v3 REST APIs, and Google Drive upload APIs.

---

## 3. Database Schema & Data Models

All SQL queries execute on a Supabase PostgreSQL instance. Row-Level Security (RLS) is enabled across all tables, blocking all anonymous client-side direct access. Backend queries are completely parameterized via the Supabase client query builder.

### database Tables

```
┌────────────────────────────────────────────────────────┐
│                        users                           │
├───────────────┬──────────────┬─────────────────────────┤
│ id            │ text (PK)    │ Clerk User ID           │
│ name          │ text         │ Student Display Name    │
│ email         │ text (Unique)│ Email address           │
│ leetcode_user │ text         │ Leetcode username       │
│ github_user   │ text         │ GitHub username         │
│ codechef_user │ text         │ CodeChef username       │
│ linkedin_url  │ text         │ LinkedIn profile URL    │
│ leetcode_easy │ integer      │ Cumulative Easy solves  │
│ leetcode_med  │ integer      │ Cumulative Medium solves│
│ leetcode_hard │ integer      │ Cumulative Hard solves  │
│ codechef_solv │ integer      │ Cumulative Solves       │
│ created_at    │ timestamp    │ Record creation time    │
└───────────────┴──────────────┴─────────────────────────┘
        │
        │ 1
        │
        │ N
┌───────▼────────────────────────────────────────────────┐
│                   daily_activities                     │
├───────────────┬──────────────┬─────────────────────────┤
│ id            │ serial (PK)  │ Auto-incrementing ID    │
│ user_id       │ text (FK)    │ References users(id)    │
│ date          │ date         │ Target date of sync     │
│ leetcode_today│ integer      │ Solved solves today     │
│ github_today  │ integer      │ Commits today           │
│ codechef_today│ integer      │ Solves today            │
│ points_earned │ integer      │ Total daily score       │
│ leetcode_easy │ integer      │ Snapshot Easy solves    │
│ leetcode_med  │ integer      │ Snapshot Medium solves  │
│ leetcode_hard │ integer      │ Snapshot Hard solves    │
│ codechef_acc  │ integer      │ Snapshot Codechef solves│
│ created_at    │ timestamp    │ Log creation timestamp  │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                     user_states                        │
├───────────────┬──────────────┬─────────────────────────┤
│ id            │ text (PK)    │ Clerk User ID           │
│ state         │ jsonb        │ Serialized Zustand State│
│ updated_at    │ timestamp    │ State update time       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                     certificates                       │
├───────────────┬──────────────┬─────────────────────────┤
│ id            │ text (PK)    │ Certificate ID          │
│ user_id       │ text (FK)    │ References users(id)    │
│ name          │ text         │ Certificate Name        │
│ platform      │ text         │ Course provider         │
│ file_url      │ text         │ Public URL of image     │
│ created_at    │ timestamp    │ Upload time             │
└────────────────────────────────────────────────────────┘
```

---

## 4. Key Pipelines & Technical Workflows

### A. State Synchronization Pipeline (Cloud-Wins)
```
[Zustand Store] ──(state modification)──> [SyncProvider Subscriber] ──(fetch POST)──> [/api/user/state]
                                                                                            │
                                                                                    (Bypass RLS)
                                                                                            │
                                                                                            ▼
                                                                                    [Supabase user_states]
```
1. **Initial Hydration**: On mounting, `SyncProvider` fetches the user's Zustand state from the database via `GET /api/user/state/` (using Clerk `auth()` identity).
2. **First-time Login / Migration**: If the user has a record in the `users` table but no `user_states` row, the backend dynamically prepares a default onboarded state. If they are brand new, they go through onboarding, which initializes both their `users` and `user_states` rows.
3. **Queue-based Writeback**: Client store changes are intercepted by `SyncProvider`, debounced, and queued for sequential upserts to `POST /api/user/state/` to prevent database race conditions and out-of-order state mutations.

### B. Gamification & Points Ledger Pipeline
1. **Trigger**: Triggered via user request (`POST /api/admin/sync-now`), hourly cron scheduler (`GET /api/cron/daily-sync`), or profile account link.
2. **Activity Pull**: The server requests user platform stats:
    *   **LeetCode**: Queries LeetCode GraphQL API for total solve numbers.
    *   **CodeChef**: Scrapes the public user stats page for total solved count.
    *   **GitHub**: Fetches public commits, pull requests, and reviews from the GitHub Events API.
3. **Delta Computation**: Deltas are calculated by comparing current totals against the user's closest historical baseline row in `daily_activities`.
4. **Point Allocation Engine**:
    *   **LeetCode Solves**: Easy (+10 pts), Medium (+20 pts), Hard (+35 pts).
    *   **CodeChef Solves**: (+15 pts per solve).
    *   **GitHub Commits**: (+0 pts, commits are compiled for streak telemetry only).
5. **Ledger Record**: Delta values and calculated daily points are logged idempotently as a row in the `daily_activities` table.

### C. AI Timetable Planning & Mentor Engine
1. **Weekly timetable generator**: `POST /api/ai/planner` takes the student's college class times, subjects, tasks, and online courses, compiles them, and sends a highly structured prompt to **Groq LLM (Llama 3.1 8B)**.
2. **Output Structure**: The LLM responds in JSON format returning a structured timetable block array and scheduling insights (explanations of decisions).
3. **Duality Rule**: When a study task is scheduled, both a checkable Task and a Timetable block are generated and bound together in the store.
4. **AI Academic Mentor**: `POST /api/ai/proactive` compiles student weekly performance metrics and feeds them to the LLM to yield proactive notifications (e.g. subject gap alerts, weekly consistency feedback, motivational guidance).

### D. Calendar Sync & Storage Pipeline
*   **Google Calendar Sync**: `POST /api/calendar/sync` uses the Google OAuth access token retrieved from Clerk to construct calendar event payloads and push scheduled study blocks directly to the student's primary Google Calendar.
*   **Google Drive Uploads**: Direct study materials (up to 4.5MB serverless limit) are posted to `/api/resources/upload-drive`, converting the file stream to a multipart body uploaded directly to the student's Google Drive.
*   **Certificates Storage**: Uploaded certificates are processed on the server, saved to the `certificates` Supabase Storage bucket, and recorded in the database `certificates` table. Deletion requests are strictly filtered to only allow removal of files prefixed with the caller's verified `userId`.

---

## 5. Security & Protection Model

1. **Zero Client-Side DB Calls**: Direct connection using the anonymous `supabase` key has been disabled on the frontend. The application routes all database transactions through Next.js server endpoints.
2. **Server-Side Authorization**: Every API route imports `@clerk/nextjs/server` and awaits `auth()`. No endpoint queries or updates database records unless the authenticated `userId` matches the target record owner, or the caller's email matches the admin list in `isAdminEmail`.
3. **Parameterized SQL Queries**: All queries are compiled via Supabase's JS API query builder (which parses parameters to PostgREST under-the-hood). No raw string interpolation is used, fully neutralizing SQL Injection (SQLi) risks.
4. **Data Purging**: A user can completely delete their history via `DELETE /api/user/purge`. The backend deletes the metadata from `user_states`, drops references in `daily_activities`, and removes the user profile from `users` in a single transactional sequence.
