# Graph Report - Layora-AI_powered-student-productivity-platform  (2026-09-06)

## Corpus Check
- 119 files · ~195,821 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 899 nodes · 1872 edges · 56 communities (47 shown, 9 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `233364e2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useStore
- authz.ts
- Event.ts
- extensionAuth.ts
- admin/page.tsx
- useStore.ts
- popup.js
- notifications.ts
- compilerOptions
- AdminLog.ts
- manifest.json
- Dashboard Overview Screen (Light Theme)
- Layora Desktop Dashboard Screenshot
- Zen Focus Mode Fullscreen Timer
- Upload New Certificate Card (UI)
- Weekly Planner Screen (landing screenshot)
- dependencies
- devDependencies
- githubService.ts
- DailyActivity.ts
- requireStudent
- app/page.tsx
- Bearer Token Pairing (extension auth)
- app/layout.tsx
- syncLogic.ts (activity aggregator & points calculator)
- schema.sql
- Server-Side Database Proxy (/api/user/state)
- leetcodeService.ts
- Layora: Autonomous AI Student Productivity Suite
- package.json
- requireAdmin
- Resource Vault
- Generative Timetable Compiler
- syncLogic.ts
- build-zip.py
- ExtensionInstall.tsx
- icon.tsx
- Main Workspace Dashboard
- POST
- @clerk/nextjs
- eslint.config.mjs
- next.config.ts
- @supabase/supabase-js
- zustand
- tailwindcss
- postcss.config.mjs
- global/route.ts
- getRequester
- calendar/courses/route.ts
- vercel.json
- proxy.ts
- draw_mark

## God Nodes (most connected - your core abstractions)
1. `useStore` - 38 edges
2. `apiFetch()` - 31 edges
3. `getRequester()` - 24 edges
4. `formatDate()` - 22 edges
5. `requireStudent()` - 21 edges
6. `requireAdminCohort()` - 18 edges
7. `readJson()` - 17 edges
8. `requireExtensionUser()` - 17 edges
9. `requireAdmin()` - 17 edges
10. `supabaseAdmin` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Bearer Token Pairing (extension auth)` --semantically_similar_to--> `Server-Side Database Proxy (/api/user/state)`  [INFERRED] [semantically similar]
  extension/README.md → README.md
- `Known limit: a launcher added in the extension can be overwritten` --semantically_similar_to--> `State Synchronization Pipeline (cloud-wins)`  [INFERRED] [semantically similar]
  extension/README.md → structure.md
- `Next.js Agent Rules (breaking-change warning)` --conceptually_related_to--> `Layora Architecture & System Structure`  [AMBIGUOUS]
  AGENTS.md → structure.md
- `Google Drive webViewLink Fallback Construction` --semantically_similar_to--> `Known limit: a course without a link opens Layora instead`  [INFERRED] [semantically similar]
  README.md → extension/README.md
- `Known limit: a launcher added in the extension can be overwritten` --shares_data_with--> `user_states table (serialized Zustand state jsonb)`  [INFERRED]
  extension/README.md → structure.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Developer-activity ingestion and points ledger** — structure_cron_daily_sync, structure_sync_logic, structure_leetcode_graphql, structure_codechef_scraper, structure_github_events_api, structure_table_daily_activities, structure_gamification_points_ledger [EXTRACTED 1.00]
- **Extension pairing and authenticated-request flow** — extension_popup_connect_gate, extension_readme_connect_js, extension_readme_background_js, extension_readme_lib_js, extension_readme_bearer_token_pairing, extension_readme_token_hashing [EXTRACTED 1.00]
- **Google Calendar Sync Surface** — public_images_landing_sync_detail_planner_alerts_toggle, public_images_landing_sync_detail_sync_to_google_calendar, public_images_landing_sync_detail_wipe_week_from_google_calendar, public_images_landing_sync_detail_calendar_sync_controls [EXTRACTED 1.00]
- **Dashboard Panel Composition (two-column desktop workspace)** — public_images_landing_overview_sidebar_navigation, public_images_landing_overview_daily_schedule_panel, public_images_landing_overview_tomorrows_schedule_panel, public_images_landing_overview_active_courses_panel, public_images_landing_overview_quick_launchers, public_images_landing_overview_workspace_topbar_clock [EXTRACTED 1.00]
- **Gamified points pipeline: external public activity synced daily, scored by rules, shown as rolling stats and a cohort ranking** — public_images_landing_leaderboard_daily_public_profile_sync, public_images_landing_leaderboard_points_allotment_rules, public_images_landing_leaderboard_points_stat_cards, public_images_landing_leaderboard_cohort_scoped_ranking, public_images_landing_leaderboard_privacy_mode [EXTRACTED 1.00]
- **Layora Dark UI Design Language** — public_images_landing_tasks_dark_terminal_aesthetic, public_images_landing_zen_distraction_free_chrome_removal, public_images_landing_sync_detail_destructive_action_color_coding, public_images_landing_tasks_sidebar_navigation [INFERRED 0.75]
- **Student deadline and milestone tracking flow (course due dates, department events, certificate proof)** — public_images_landing_courses_course_card, public_images_landing_events_month_calendar_grid, public_images_landing_certificates_upload_certificate_card, public_images_landing_events_personal_vs_department_events [INFERRED 0.75]
- **Task-to-Focus-Session Flow** — public_images_landing_tasks_start_task_action, public_images_landing_tasks_zen_entry_button, public_images_landing_zen_zen_focus_mode, public_images_landing_zen_pomodoro_cycle_indicator, public_images_landing_tasks_time_budget_tracking, public_images_landing_zen_session_stats_footer [INFERRED 0.85]
- **Layora dark console design language (violet accent, monospace labels, rounded cards)** — public_images_landing_certificates_upload_certificate_card, public_images_landing_courses_active_courses_page, public_images_landing_events_events_page, public_images_landing_courses_app_shell [INFERRED 0.85]
- **Document lifecycle: upload, subject indexing, cohort sharing** — public_images_landing_resources_upload_resource_form, public_images_landing_resources_storage_destination, public_images_landing_resources_vault_index_by_subject, public_images_landing_shared_share_document_action, public_images_landing_shared_audience_scope_filter [INFERRED 0.85]
- **Focus Session Flow: schedule block to Zen timer to logged session stats** — public_images_landing_overview_daily_schedule_panel, public_images_landing_overview_start_session_action, public_images_landing_overview_zen_entry_button, public_images_landing_phone_zen_zen_focus_timer_screenshot, public_images_landing_phone_zen_session_stats_footer, public_images_landing_overview_active_streak_widget [INFERRED 0.85]
- **Google Workspace integration surface (Drive storage + Calendar sync of reminders and events)** — public_images_landing_certificates_user_owned_drive_storage, public_images_landing_courses_google_calendar_sync, public_images_landing_events_google_calendar_sync, public_images_landing_courses_daily_notification_toggle [INFERRED 0.85]
- **Planner scheduling flow: guide advice, timeline blocks, calendar sync, alerts** — public_images_landing_planner_planning_guide, public_images_landing_planner_sequence_timeline, public_images_landing_planner_google_calendar_sync, public_images_landing_planner_planner_alerts [INFERRED 0.85]
- **Desktop/Mobile Feature Parity Set** — public_images_landing_overview_desktop_dashboard_screenshot, public_images_landing_phone_overview_mobile_dashboard_screenshot, public_images_landing_phone_overview_responsive_stacking, public_images_landing_phone_zen_zen_focus_timer_screenshot [INFERRED 0.85]
- **Study block scheduling flow: deadlines nudge planner blocks that surface on the dashboard as focus sessions** — public_images_landing_light_planner_planning_guide, public_images_landing_light_planner_sequence_timeline, public_images_landing_light_planner_google_calendar_sync, public_images_landing_light_overview_daily_schedule, public_images_landing_light_overview_focus_session [INFERRED 0.85]
- **Screens sharing the Layora workspace shell (sidebar nav, live clock, theme toggle, Zen mode)** — public_images_landing_leaderboard_screen, public_images_landing_light_overview_screen, public_images_landing_light_planner_screen, public_images_landing_light_overview_workspace_shell [INFERRED 0.85]
- **Zustand-to-Supabase state write path with race protection** — readme_sync_provider, readme_client_write_timestamp_queue, structure_api_user_state, structure_table_user_states, structure_supabase_admin_service_role, extension_readme_launcher_overwrite_limit [INFERRED 0.85]
- **Shared dark dashboard shell across Layora landing screenshots** — public_images_landing_planner_weekly_planner_screen, public_images_landing_resources_resource_vault_screen, public_images_landing_shared_global_resources_screen, public_images_landing_planner_dashboard_shell [INFERRED 0.95]

## Communities (56 total, 9 thin omitted)

### Community 0 - "useStore"
Cohesion: 0.07
Nodes (56): AccessDeniedPage(), Reason, AdminPage(), CertificatesPage(), CoursesPage(), rearmReminder(), buildGrid(), EventsPage() (+48 more)

### Community 1 - "authz.ts"
Cohesion: 0.13
Nodes (26): dynamic, emptyCounts(), GET(), dynamic, GET(), dynamic, GET(), Range (+18 more)

### Community 2 - "Event.ts"
Cohesion: 0.10
Nodes (33): StaffEvent, DELETE(), dynamic, GET(), POST(), dynamic, POST(), DELETE() (+25 more)

### Community 3 - "extensionAuth.ts"
Cohesion: 0.08
Nodes (45): dynamic, GET(), OPTIONS(), dynamic, GET(), OPTIONS(), DELETE(), dynamic (+37 more)

### Community 4 - "admin/page.tsx"
Cohesion: 0.07
Nodes (41): ACTION_LABEL, ACTION_TONE, ADMIN_SECTIONS, AdminLogEntry, CertificateUploader, GlobalResource, ResumeEntry, sortByNewest() (+33 more)

### Community 5 - "useStore.ts"
Cohesion: 0.09
Nodes (40): DashboardLayout(), PHASE_ACCENT, ZenMode(), ZenModeProps, formatShortDate(), dayKey(), DEFAULT_POMODORO_SETTINGS, formatFocusDuration() (+32 more)

### Community 6 - "popup.js"
Cohesion: 0.14
Nodes (35): handleMessage(), refresh(), respond(), api(), ApiError, clearToken(), CONNECT_URL, COURSES_URL (+27 more)

### Community 7 - "notifications.ts"
Cohesion: 0.10
Nodes (40): SettingsPage(), NotificationAgent(), ICONS, NotificationCenter(), toDateKey(), agendaAnnouncement(), AgendaEntry, alreadyNotified() (+32 more)

### Community 8 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 9 - "AdminLog.ts"
Cohesion: 0.13
Nodes (15): dynamic, GET(), POST(), dynamic, GET(), maxDuration, ADMIN_ACTIONS, AdminAction (+7 more)

### Community 10 - "manifest.json"
Cohesion: 0.09
Nodes (22): action, default_popup, default_title, background, service_worker, type, content_scripts, description (+14 more)

### Community 11 - "Dashboard Overview Screen (Light Theme)"
Cohesion: 0.15
Nodes (20): Cohort-Scoped Ranking, Daily Public Profile Sync (LeetCode / CodeChef / GitHub), Points Allotment Rules, Rolling Points Stat Cards (Today / Yesterday / 7d / 30d), Leaderboard Privacy Mode, Leaderboard Screen (Year Scoreboard), Active Courses Progress Tracker, Active Streak Counter (+12 more)

### Community 12 - "Layora Desktop Dashboard Screenshot"
Cohesion: 0.15
Nodes (20): Active Courses Panel with Progress Bars, Active Streak Widget (12 Days), AI Assistant Launch Chips (ChatGPT, Gemini, Claude), Daily Schedule Panel, Dark Monospace Terminal-Inspired Visual Language, Layora Desktop Dashboard Screenshot, Quick Launchers Tile (LeetCode, GitHub, NPTEL, Drive), Persistent Sidebar Navigation (Dashboard, Weekly Planner, Tasks, Events, Courses, Resources, Certificates, Leaderboard, Global Resources, Settings) (+12 more)

### Community 13 - "Zen Focus Mode Fullscreen Timer"
Cohesion: 0.13
Nodes (20): Google Calendar Sync Control Bar, Destructive Action Color Coding, Planner Alerts On Toggle, Sync to Google Calendar Action, Wipe Week from Google Calendar Action, Course Tagging of Tasks, Dark Monospace Terminal Aesthetic, Layora Sidebar Navigation (+12 more)

### Community 14 - "Upload New Certificate Card (UI)"
Cohesion: 0.12
Nodes (18): Certificate Category (NPTEL / SWAYAM), PDF Drag-Drop / Paste / Browse Dropzone, Upload New Certificate Card (UI), Upload PDF vs Paste Link Input Modes, Certificates Stored in the Student's Own Google Drive, Active Courses Page (UI), Layora App Shell (sidebar nav, workspace header, clock, Zen mode), Online Course Card (platform, progress, target, due date) (+10 more)

### Community 15 - "Weekly Planner Screen (landing screenshot)"
Cohesion: 0.15
Nodes (18): Course Code Tag on Study Block (BCS502/BCS501/BCSL504), Layora Dashboard Shell (sidebar, workspace clock, Zen mode), Google Calendar Sync / Wipe Week / Clear Day, Planner Alerts Toggle, Planning Guide (deadline-gap advisory panel), Sequence Timeline (day block list), Weekly Planner Screen (landing screenshot), Resource Vault Screen (landing screenshot) (+10 more)

### Community 16 - "dependencies"
Cohesion: 0.12
Nodes (17): axios, @clerk/themes, framer-motion, lucide-react, next, dependencies, axios, @clerk/themes (+9 more)

### Community 17 - "devDependencies"
Cohesion: 0.12
Nodes (17): clerk, eslint, eslint-config-next, devDependencies, clerk, eslint, eslint-config-next, @tailwindcss/postcss (+9 more)

### Community 18 - "githubService.ts"
Cohesion: 0.32
Nodes (7): AxiosErrorLike, ContributionDay, fetchActivityForDate(), GitHubUserResponse, GitHubValidationError, queryGitHub(), validateUsername()

### Community 19 - "DailyActivity.ts"
Cohesion: 0.16
Nodes (12): dynamic, Range, VALID_RANGES, dynamic, GET(), ActivityTotalsRow, DailyActivity, DailyActivityRow (+4 more)

### Community 20 - "requireStudent"
Cohesion: 0.31
Nodes (7): DELETE(), dynamic, GET(), POST(), requireStudent(), mapUserRow(), User

### Community 21 - "app/page.tsx"
Cohesion: 0.10
Nodes (6): GALLERY, STEPS, LayoraMark(), LayoraMarkProps, MARK_PURPLE, COLLEGE_EMAIL_DOMAIN

### Community 22 - "Bearer Token Pairing (extension auth)"
Cohesion: 0.21
Nodes (12): Connect gate state, Quicklaunch panel + add-link form, Quick Access popup UI (360x480, two tabs), background.js (service worker / event page), Bearer Token Pairing (extension auth), build-zip.py (dual-manifest packager), connect.js content script (token relay), Cross-browser parity (Chromium vs Gecko, three divergences) (+4 more)

### Community 23 - "app/layout.tsx"
Cohesion: 0.18
Nodes (9): geistMono, geistSans, hankenGrotesk, inter, jetbrainsMono, metadata, viewport, CookieConsent() (+1 more)

### Community 24 - "syncLogic.ts (activity aggregator & points calculator)"
Cohesion: 0.20
Nodes (11): /api/user/purge (data purge), CodeChef solve-count scraper, /api/cron/daily-sync (scheduled activity sync), Gamification & Points Ledger Pipeline, GitHub Events API source, LeetCode GraphQL stats source, syncLogic.ts (activity aggregator & points calculator), certificates table & Supabase Storage bucket (+3 more)

### Community 25 - "schema.sql"
Cohesion: 0.27
Nodes (9): public, public.admin_logs, public.certificates, public.daily_activities, public.events, public.extension_tokens, public.leaderboard_activity_totals(), public.user_states (+1 more)

### Community 26 - "Server-Side Database Proxy (/api/user/state)"
Cohesion: 0.27
Nodes (10): Clerk Authentication, Local Demo Mode (missing Supabase keys fallback), Supabase Row-Level Security Isolation, Server-Side Database Proxy (/api/user/state), /api/calendar/sync (Google Calendar push), /api/user/state (secure Supabase state proxy), Clerk Middleware (route protection & token check), isAdminEmail admin allowlist (+2 more)

### Community 27 - "leetcodeService.ts"
Cohesion: 0.27
Nodes (10): difficultyCache, DifficultyCounts, fetchActivityForDate(), fetchTotalSolves(), getQuestionDifficulty(), LeetCodeQuestion, LeetCodeResponse, LeetCodeSubmission (+2 more)

### Community 28 - "Layora: Autonomous AI Student Productivity Suite"
Cohesion: 0.28
Nodes (9): Next.js Agent Rules (breaking-change warning), CLAUDE.md AGENTS.md include, Known limit: a launcher added in the extension can be overwritten, Admin Root Console, Client Write-Timestamp Queue (anti-race-condition), Layora: Autonomous AI Student Productivity Suite, SyncProvider (Zustand synchronizer & realtime listener), Layora Architecture & System Structure (+1 more)

### Community 29 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, start, version

### Community 30 - "requireAdmin"
Cohesion: 0.20
Nodes (9): dynamic, GET(), DELETE(), describeStudent(), dynamic, POST(), requireAdmin(), DatabaseUserRow (+1 more)

### Community 31 - "Resource Vault"
Cohesion: 0.29
Nodes (8): Courses panel, Known limit: a course without a link opens Layora instead, Google Drive webViewLink Fallback Construction, No Study Materials on Supabase Storage (privacy stance), Online Course Tracker, Resource Vault, Vercel 4.5MB Upload Size Guard, /api/resources/upload-drive (Google Drive proxy upload)

### Community 32 - "Generative Timetable Compiler"
Cohesion: 0.29
Nodes (8): Google site-verification token file, Generative Timetable Compiler, Google Calendar Sync, Groq API (LLM inference), Study Copilot (LLM assistant), /api/ai/planner (weekly timetable generator), /api/ai/proactive (AI academic mentor), Duality Rule (task + timetable block bound together)

### Community 33 - "syncLogic.ts"
Cohesion: 0.16
Nodes (17): maxDuration, POST(), POST(), fetchProfileHtml(), fetchTotalSolves(), validateUsername(), UserRow, DEFAULT_SLICE_BUDGET_MS (+9 more)

### Community 34 - "build-zip.py"
Cohesion: 0.47
Nodes (5): build(), firefox_manifest(), main(), Package the extension for distribution. Writes two zips from the one source…, The Chromium manifest, with the three Gecko differences applied.

### Community 35 - "ExtensionInstall.tsx"
Cohesion: 0.40
Nodes (5): BrowserFamily, Build, BUILDS, detectBrowser(), ExtensionInstall()

### Community 36 - "icon.tsx"
Cohesion: 0.40
Nodes (3): contentType, runtime, size

### Community 37 - "Main Workspace Dashboard"
Cohesion: 0.67
Nodes (3): Milestone Tracker & Global Stopwatch, Onboarding Portal (7-step routine wizard), Main Workspace Dashboard

### Community 48 - "global/route.ts"
Cohesion: 0.18
Nodes (22): DELETE(), dynamic, GET(), POST(), readResourceList(), StoredResource, visibleTo(), writeResourceList() (+14 more)

### Community 50 - "getRequester"
Cohesion: 0.24
Nodes (9): dynamic, GET(), dynamic, GET(), POST(), POST(), ADMIN_EMAILS, isAdminEmail() (+1 more)

### Community 51 - "calendar/courses/route.ts"
Cohesion: 0.39
Nodes (7): at(), CoursePayload, dynamic, POST(), toDateKey(), untilStamp(), wallClock()

### Community 54 - "proxy.ts"
Cohesion: 0.38
Nodes (5): redirectForRole(), config, emailFromClaims(), isProtectedRoute, resolveEmail()

### Community 55 - "draw_mark"
Cohesion: 0.40
Nodes (5): Image, draw_mark(), main(), Generate every Layora raster mark from one definition. The mark is a rounded…, One mark, drawn at `size` pixels square.

## Ambiguous Edges - Review These
- `Layora Architecture & System Structure` → `Next.js Agent Rules (breaking-change warning)`  [AMBIGUOUS]
  AGENTS.md · relation: conceptually_related_to

## Knowledge Gaps
- **256 isolated node(s):** `StoredResource`, `dynamic`, `GlobalResource`, `RESOURCE_TAGS`, `ResourceTag` (+251 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Layora Architecture & System Structure` and `Next.js Agent Rules (breaking-change warning)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Cohort` connect `global/route.ts` to `authz.ts`, `Event.ts`, `admin/page.tsx`, `useStore.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `supabaseAdmin` connect `requireAdmin` to `authz.ts`, `Event.ts`, `extensionAuth.ts`, `admin/page.tsx`, `syncLogic.ts`, `AdminLog.ts`, `global/route.ts`, `getRequester`, `DailyActivity.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `getRequester()` connect `getRequester` to `syncLogic.ts`, `authz.ts`, `extensionAuth.ts`, `global/route.ts`, `DailyActivity.ts`, `requireStudent`, `requireAdmin`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `StoredResource`, `dynamic`, `GlobalResource` to the rest of the system?**
  _256 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useStore` be split into smaller, more focused modules?**
  _Cohesion score 0.07347915242652085 - nodes in this community are weakly interconnected._
- **Should `authz.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1265597147950089 - nodes in this community are weakly interconnected._