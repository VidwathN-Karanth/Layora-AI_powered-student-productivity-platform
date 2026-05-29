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

## 🛠️ Tech Stack & Tools

Layora is built on a modern, high-performance web stack:

- **Framework:** Next.js 15 (App Router, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Custom Cyberpunk/Glassmorphism UI
- **Authentication:** Clerk
- **AI Engine:** Groq API (Powered by ultra-fast LLM inference)
- **State Management:** Zustand (with Local Storage Persistence)
- **Integrations:**
  - Google Drive API (For syncing and uploading study materials)
  - Google Calendar API (For pushing study blocks to personal calendars)
- **Deployment:** Vercel

---

## ⚙️ How It Works

Layora is an all-in-one AI-powered dashboard designed to automate and streamline a student's academic life.

- **Proactive Academic Engine:** Instead of manually building a schedule, students input their courses, difficulty levels, and available hours. The AI automatically generates an optimized weekly study timetable.
- **Task Management:** A built-in system to track assignments, exams, and personal tasks.
- **Pomodoro Timer:** Integrated directly into the dashboard for deep-work focus sessions.
- **AI Co-Pilot Chatbot:** A persistent, context-aware AI assistant that can summarize notes, explain complex topics, and even execute commands (like `/schedule`) to automatically add tasks to the dashboard.

---

## 💾 Data Storage & Privacy

Layora is designed with a strong emphasis on privacy and security, acting primarily as a client-side interface:

- **User Accounts:** Managed securely by **Clerk**.
- **App State (Tasks, Timetables, Settings):** Stored locally in the user's browser using **Zustand Local Storage**. No central database is used to horde user task data.
- **Files & Notes:** Uploaded directly to the user's personal **Google Drive** using the Google API. Layora does not host or store any user files on its own servers.
- **AI Chat History:** Stored temporarily on the client-side.
