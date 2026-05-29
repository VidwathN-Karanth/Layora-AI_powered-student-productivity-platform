<div align="center">
  <img src="./public/layora-logo.png" alt="Layora Logo" width="120" height="120" />
  <h1>LAYORA</h1>
  <h3>Autonomous Student Productivity Suite</h3>
</div>

<br/>

<div align="center">
  <h2>🌐 <strong><a href="https://layora239.vercel.app/">Live Demo: layora239.vercel.app</a></strong> 🌐</h2>
</div>

<br/>

Layora is a modern, full-stack student academic assistant featuring a premium dark futuristic glassmorphism UI. It combines custom weekly schedule optimizations, course calendars, resource vaults, task stopwatch trackers, and a persistent AI co-pilot.

---

## 🛠️ Technology Stack & Integrations

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, TypeScript, React 19)
- **Styling**: Tailwind CSS v4 & custom glassmorphism styles
- **Authentication**: Clerk (Secure User Identity)
- **AI Engine**: Groq API (Blazing-fast LLM inference)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (with LocalStorage persist middleware)
- **Database Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Row-Level-Security policies)
- **Integrations**:
  - Google Drive API (For syncing and uploading study materials)
  - Google Calendar API (For pushing study blocks to personal calendars)
- **Deployment**: Vercel
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

---

## 💾 Data Storage & Privacy

Layora acts primarily as a highly-secure client interface:
- **Accounts:** Handled natively via Clerk.
- **App State:** Managed locally in your browser using Zustand Local Storage (or optionally synced to Supabase).
- **Files:** Sent directly to your personal Google Drive account. Layora does not horde or centralize your files!

---

## 🚀 Core Features

- **Futuristic Glassmorphic Interface**: Dark futuristic theme with cyan and purple neon glow effects, sliding menus, and fluid responsiveness.
- **Proactive Academic Engine (Timetable)**: Generative AI planner distributing study blocks based on credits, routines, and extracurricular activities. Supports manual drag-rearranging.
- **Task Management & Stopwatch**: Tracks real study hours spent on milestones, ticking globally in the top navigation bar. Saves and reports stats upon completion.
- **Modular AI Chatbot**: Chat client with provider toggles supporting customized user API keys and fallback simulation replies. Capable of explaining notes and directly interacting with the dashboard.
- **Supabase Hybrid Sync**: Works out-of-the-box locally using Zustand & `localStorage` persistence when Supabase variables are absent. Syncs to cloud instantly if environment values are defined.
- **Google Integrations**: Export your timetables directly to Google Calendar and upload study materials directly to Google Drive.

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
│   │   ├── login/page.tsx      # Cyberpunk login & register portal with Clerk Auth
│   │   ├── onboarding/page.tsx # 7-step wizard capturing routines and subjects
│   │   ├── dashboard/          # Collapsible core workspace shell
│   │   │   ├── layout.tsx      # Left navigation sidebar + global timer ticking synchronizer
│   │   │   ├── page.tsx        # Widgets, streak fires, quick launcher, daily agenda
│   │   │   ├── planner/page.tsx# Weekly timetable grid + calendar exporter
│   │   │   ├── tasks/page.tsx  # Milestones listing & task ticking stopwatch
│   │   │   ├── courses/page.tsx# Platform progress controllers
│   │   │   ├── resources/page.tsx# Document upload indexer to Google Drive
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

Follow these commands to run Layora locally using your portable Node.js binaries:

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
2. Open the **SQL Editor** in the Supabase Dashboard and run the queries defined inside [supabase/schema.sql](./supabase/schema.sql).
3. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
4. Insert your Supabase URL & Anon Key under `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Restart the server. The application will detect the keys and sync data directly to your cloud PostgreSQL database.
