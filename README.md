# Aero Study Lab — AI-Powered Student Productivity App

Aero Study Lab is a modern, full-stack student academic assistant featuring a premium dark futuristic glassmorphism UI. It combines custom weekly schedule optimizations, course calendars, resource vaults, task stopwatch trackers, and a persistent ChatGPT-style co-pilot.

---

## 🚀 Core Features

- **Futuristic Glassmorphic Interface**: Dark futuristic theme with cyan and purple neon glow effects, sliding menus, and fluid responsiveness.
- **6-Step Onboarding Flow**: Dynamic setup gathering wake/sleep rhythms, subject difficulty credits, extracurriculars, quick website launchers, and course progress.
- **Weekly AI Timetable Scheduler**: Generative planner distributing study blocks based on credits, routines, and extracurricular activities. Supports manual drag-rearranging.
- **Live Stopwatch Task Tracker**: Tracks real study hours spent on milestones, ticking globally in the top navigation bar. Saves and reports stats upon completion.
- **Modular AI Chatbot**: Chat client with provider toggles (Google Gemini, OpenAI, Anthropic Claude, Grok) supporting customized user API keys and fallback simulation replies.
- **Supabase Hybrid Sync**: Works out-of-the-box locally using Zustand & `localStorage` persistence when Supabase variables are absent. Syncs to cloud instantly if environment values are defined.
- **Google Calendar Exporter**: Triggers oauth connection scripts to export study schedules and deadlines.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, TypeScript, React 19)
- **Styling**: Tailwind CSS v4 & custom glassmorphism styles
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (with LocalStorage persist middleware)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Row-Level-Security policies)

---

## 📂 Folder Structure

```
ANTIFrontend/
├── supabase/
│   └── schema.sql              # Database schema tables and RLS security rules
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   ├── chat/route.ts      # Serverless route routing models & fallback replies
│   │   │   │   └── planner/route.ts   # AI weekly schedule planner compiler
│   │   ├── login/page.tsx      # Cyberpunk login & register portal with Google OAuth simulation
│   │   ├── onboarding/page.tsx # 7-step wizard capturing routines and subjects
│   │   ├── dashboard/          # Collapsible core workspace shell
│   │   │   ├── layout.tsx      # Left navigation sidebar + global timer ticking synchronizer
│   │   │   ├── page.tsx        # Widgets, streak fires, quick launcher, daily agenda
│   │   │   ├── planner/page.tsx# Weekly timetable grid + calendar exporter
│   │   │   ├── tasks/page.tsx  # Milestones listing & task ticking stopwatch
│   │   │   ├── courses/page.tsx# Platform progress controllers
│   │   │   ├── resources/page.tsx# Document upload indexer
│   │   │   ├── analytics/page.tsx# Weekly study statistics charts
│   │   │   └── settings/page.tsx # Profile routines, API key input bindings, accents
│   │   ├── layout.tsx          # Main HTML structure, Geist variables configuration
│   │   └── page.tsx            # Session router & load screens
│   ├── lib/
│   │   ├── aiService.ts        # Modular fetch handlers & offline schedule optimizer
│   │   └── supabaseClient.ts   # Hybrid client with database connectivity safety checks
│   └── store/
│       └── useStore.ts         # Zustand main application state store
└── package.json
```

---

## ⚙️ Local Development Setup

Follow these commands to run Aero Study Lab locally using your portable Node.js binaries:

1. **Prepend Node portable to PATH (PowerShell)**:
   ```powershell
   $env:PATH = "C:\Users\vidwa\node-portable\node-v22.11.0-win-x64;" + $env:PATH
   ```

2. **Verify Node & NPM Versions**:
   ```bash
   node -v  # Expected: v22.11.0
   npm -v   # Expected: 10.9.0
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Launch Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) on your browser to view the application.

5. **Compile Production Bundle**:
   ```bash
   npm run build
   ```

---

## 🔒 Supabase Integration Setup

To sync profiles, schedules, tasks, and notes to a cloud backend:

1. Create a free project at [Supabase](https://supabase.com/).
2. Open the **SQL Editor** in the Supabase Dashboard and run the queries defined inside [supabase/schema.sql](file:///f:/ANTIFrontend/supabase/schema.sql).
3. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
4. Insert your Supabase URL & Anon Key under `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Restart the server. The application will detect the keys and sync data directly to your cloud PostgreSQL database.
