'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import {
  ArrowRight, ArrowDown, ShieldCheck, Award, Terminal,
  FolderLock, Globe, BookMarked, Smartphone, Check,
} from 'lucide-react';
import { isAdminEmail } from '@/lib/admin';
import {
  motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion,
} from 'framer-motion';

/* ────────────────────────────────────────────────────────────────
   One feature per screen.

   The tour is a pinned stage: the screenshot holds still while the
   copy for each feature scrolls past it, and the left rail is a
   running index of where you are. Zen mode goes first and takes the
   page to black with it — everything after that is a hairline, a
   mono label and a screenshot of the real workspace.
   ──────────────────────────────────────────────────────────────── */

const INK = '#0A0B0D';
const SLAB = '#14161A';

/** The tour, in the order a student meets the product. */
const STEPS = [
  {
    label: 'Zen mode',
    title: 'One black screen and a timer.',
    body: 'Everything else gets out of the way — sidebar, header, notifications, the lot. Space pauses, Esc leaves, and the session counts towards the streak on your dashboard.',
    src: '/images/landing/zen.webp',
    alt: 'Zen mode: a black screen with a large 24:58 focus countdown and pause, restart and skip controls.',
    black: true,
    facts: ['Space to pause · Esc to leave', 'Focus and break lengths are yours', 'Logs to your streak'],
  },
  {
    label: 'Weekly planner',
    title: 'The week builds itself around your classes.',
    body: 'Add your subjects once — code, credits, how hard they are. Layora fills the gaps between lectures with focus sessions sized to your Pomodoro rhythm, and calls out any deadline it could not find time for.',
    src: '/images/landing/planner.webp',
    alt: 'The weekly planner with Friday selected: a Computer Networks revision block, a break, and two more study sessions.',
    facts: ['Sized to your focus timer', 'Reorder or delete any block', 'Regenerates when subjects change'],
  },
  {
    label: 'Google Calendar',
    title: 'It lands in the calendar you already check.',
    body: 'One button writes the week into Google Calendar in your own time zone. Change a block and sync again — Layora clears the copies it wrote before, so a fortnight of edits never becomes a fortnight of duplicates.',
    src: '/images/landing/sync-detail.webp',
    alt: 'The planner action bar: planner alerts on, sync to Google Calendar, and wipe week from Google Calendar.',
    panel: 'calendar',
    facts: ['Writes with an IANA time zone', 'Wipe a day or the whole week', 'Course deadlines sync too'],
  },
  {
    label: 'Tasks',
    title: 'Every deadline, with the time it actually took.',
    body: 'Give a task an estimate and start the timer when you sit down. The planner uses what you log to decide how much room the next one needs.',
    src: '/images/landing/tasks.webp',
    alt: 'The tasks page showing pending, in-progress and completed work with estimates and logged minutes.',
    facts: ['Estimate vs. logged minutes', 'Grouped by subject', 'Feeds the next timetable'],
  },
  {
    label: 'Events',
    title: 'Department notices and your own reminders, one calendar.',
    body: 'Assessments, project reviews and placement drives are posted by the department to your year. Your own reminders sit on the same grid in a different colour, and repeat weekly if you tell them to.',
    src: '/images/landing/events.webp',
    alt: 'The events month grid for August with department events in amber and personal reminders in violet.',
    facts: ['Posted to your year only', 'Daily, weekly or monthly repeats', 'Push notification on the day'],
  },
  {
    label: 'Leaderboard',
    title: 'Your coding week, ranked inside your year.',
    body: 'Connect LeetCode, GitHub and CodeChef. Every night at 10 PM Layora reads the public profiles, scores solves and contributions, and ranks you against your own year group — nobody else.',
    src: '/images/landing/leaderboard.webp',
    alt: 'The third-year scoreboard with points for today, the last seven days and the last thirty days, above a ranked table.',
    facts: ['Synced nightly at 22:00 IST', 'Public profile data only', 'Ranked within your year'],
  },
] as const;

/** The quieter half of the workspace — shown as plates, not stages. */
const GALLERY: {
  icon: typeof BookMarked; label: string; title: string; body: string;
  src: string; alt: string; portrait?: boolean;
}[] = [
  {
    icon: BookMarked, label: 'Courses',
    title: 'Online courses with a weekly target',
    body: 'NPTEL, Coursera, Udemy — progress, hours per week and a reminder before the deadline.',
    src: '/images/landing/courses.webp',
    alt: 'The courses page with progress meters for four online courses.',
  },
  {
    icon: Award, label: 'Certificates',
    title: 'Certificates, sorted for placement season',
    body: 'NPTEL, courses and competitions, each a link to the file in your own Google Drive.',
    src: '/images/landing/certificates.webp',
    alt: 'The upload card: certificate title, an NPTEL category, upload PDF or paste link, and a drop zone capped at 4.5 MB.',
    portrait: true,
  },
  {
    icon: FolderLock, label: 'Resources',
    title: 'Notes filed by subject',
    body: 'Every PDF indexed under the subject it belongs to, stored in your Drive, not on our server.',
    src: '/images/landing/resources.webp',
    alt: 'The personal resource vault with notes grouped by subject.',
  },
  {
    icon: Globe, label: 'Shared library',
    title: 'What your year has already found',
    body: 'Question papers and cheat sheets uploaded by classmates, with the uploader on every row.',
    src: '/images/landing/shared.webp',
    alt: 'The shared library listing question papers uploaded by classmates.',
  },
];

/* ── Small pieces ─────────────────────────────────────────────── */

function Eyebrow({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'blue' | 'brass' | 'paper' }) {
  const colors = { violet: '#C56BF5', blue: '#2E95FF', brass: '#E0A93B', paper: '#8A5E1A' };
  return (
    <span
      className="font-jetbrains text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em]"
      style={{ color: colors[tone] }}
    >
      {children}
    </span>
  );
}

function Plate({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/10"
      style={{ background: SLAB, boxShadow: '0 30px 80px -40px rgba(0,0,0,0.9)' }}
    >
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="w-full object-cover object-top"
      />
    </div>
  );
}

/** The calendar step has no screenshot to show — the result lands in Google,
 *  not in Layora. So it shows the control that does it, and the event it
 *  writes, spelled out. */
function CalendarPanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-6 sm:p-9" style={{ background: SLAB, boxShadow: '0 30px 80px -40px rgba(0,0,0,0.9)' }}>
      <img src={src} alt={alt} loading="lazy" decoding="async" className="w-full rounded-lg border border-white/[0.08]" />
      <p className="mt-7 font-jetbrains text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
        What one press writes
      </p>
      <dl className="mt-4 border-t border-white/[0.07] font-jetbrains text-[11px] leading-relaxed">
        {[
          ['Event', 'Computer Networks — Unit 3 revision'],
          ['When', 'Fri 21/08 · 17:00–17:50'],
          ['Time zone', 'Asia/Kolkata — wall clock, not UTC'],
          ['On re-sync', 'The old copy is deleted first'],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1 border-b border-white/[0.05] py-3 last:border-b-0 sm:flex-row sm:gap-6">
            <dt className="w-28 shrink-0 uppercase tracking-[0.16em] text-white/30">{k}</dt>
            <dd className="text-white/70">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Nav ──────────────────────────────────────────────────────── */

function Nav({ onSignIn }: { onSignIn: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl" style={{ background: 'rgba(10,11,13,0.72)' }}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2E95FF]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#C56BF5] text-[11px] font-bold text-black">L</span>
          <span className="font-jetbrains text-[13px] font-bold tracking-[0.18em] text-white">LAYORA</span>
        </a>

        <nav className="hidden items-center gap-8 font-jetbrains text-[11px] uppercase tracking-[0.15em] text-white/45 md:flex">
          <a href="#features" className="transition hover:text-white">Features</a>
          <a href="#workspace" className="transition hover:text-white">Workspace</a>
          <a href="#access" className="transition hover:text-white">Access</a>
          <a href="/privacy" className="transition hover:text-white">Privacy</a>
        </nav>

        <button
          onClick={onSignIn}
          className="cursor-pointer rounded-lg bg-white px-4 py-2 font-jetbrains text-[11px] font-bold uppercase tracking-[0.12em] text-black transition hover:bg-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E95FF]"
        >
          Sign in
        </button>
      </div>
    </header>
  );
}

/* ── Hero ─────────────────────────────────────────────────────── */

function Hero({ onSignIn }: { onSignIn: () => void }) {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <section id="top" className="relative px-5 pt-28 sm:px-8 sm:pt-36">
      <div className="mx-auto max-w-7xl">
        <motion.div {...rise(0)}>
          <Eyebrow>MITE · Dept. of Computer Science &amp; Engineering</Eyebrow>
        </motion.div>

        <motion.h1
          {...rise(0.08)}
          className="mt-6 max-w-4xl font-hanken text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.75rem]"
        >
          Your semester, planned
          <br className="hidden sm:block" /> down to the hour.
        </motion.h1>

        <motion.p {...rise(0.16)} className="mt-7 max-w-xl text-[15px] leading-relaxed text-white/55 sm:text-base">
          Add your subjects once. Layora lays out the week around your classes, pushes it to
          Google Calendar, and keeps every deadline, note and certificate where you can find
          it at 2 AM the night before.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-3">
          <button
            onClick={onSignIn}
            className="group flex cursor-pointer items-center gap-2 rounded-xl bg-[#2E95FF] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0A7CF0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Sign in with your college account
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </button>
          <a
            href="#features"
            className="flex items-center gap-2 rounded-xl border border-white/12 px-6 py-3.5 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E95FF]"
          >
            See what is inside
            <ArrowDown className="h-4 w-4" strokeWidth={2} />
          </a>
        </motion.div>

        <motion.p {...rise(0.3)} className="mt-6 font-jetbrains text-[11px] leading-relaxed tracking-wide text-white/35">
          @mite.ac.in accounts on the CSE roster · 2nd, 3rd and 4th year
        </motion.p>

        {/* The screenshot is cropped at the fold on purpose: the workspace
            continues past the edge, which is the invitation to scroll. */}
        <motion.figure
          initial={{ opacity: 0, y: reduce ? 0 : 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-16 sm:mt-20"
        >
          <div
            className="overflow-hidden rounded-t-2xl border border-b-0 border-white/10"
            style={{ maskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 62%, transparent 100%)' }}
          >
            {/* On a phone the whole dashboard at 390px is unreadable mush, so
                the shot runs wider than the screen and crops at the right —
                the detail stays legible and the frame keeps its scale. */}
            <img
              src="/images/landing/overview.webp"
              alt="The Layora dashboard: today's schedule, active courses with progress meters, and quick launchers."
              width={1680}
              height={880}
              decoding="async"
              className="w-[190%] max-w-none sm:w-full"
            />
          </div>
          <figcaption className="sr-only">The Layora dashboard for a third-year student.</figcaption>
        </motion.figure>
      </div>

      {/* Fact strip — the four things people ask before signing in. */}
      <div className="mx-auto -mt-8 max-w-7xl border-t border-white/[0.07] pt-8 sm:-mt-16">
        <dl className="grid grid-cols-2 gap-y-7 font-jetbrains text-[11px] lg:grid-cols-4">
          {[
            ['Sync target', 'Google Calendar'],
            ['Ranked against', 'Your year group'],
            ['Files live in', 'Your own Drive'],
            ['Email sent to you', 'None, ever'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="uppercase tracking-[0.18em] text-white/30">{k}</dt>
              <dd className="mt-1.5 text-[13px] font-medium tracking-wide text-white/80">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── The day: sticky feature cinema with a clock rail ─────────── */

function Cinema() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const i = Math.min(STEPS.length - 1, Math.max(0, Math.floor(p * STEPS.length + 0.15)));
    setActive(i);
  });

  // Zen mode opens the tour and takes the page with it: the stage starts at
  // true black and only lifts to the page ground as the planner arrives.
  const band = 1 / STEPS.length;
  const bg = useTransform(
    scrollYProgress,
    [0, band * 0.62, band * 0.96],
    ['#000000', '#000000', INK],
  );

  const fill = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={ref} data-cinema className="relative">
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: bg }} aria-hidden />

      <div className="relative mx-auto max-w-[96rem] px-5 sm:px-8">
        {/* ── Desktop: rail · copy · pinned media ── */}
        <div className="hidden lg:grid lg:grid-cols-[152px_minmax(0,22rem)_minmax(0,1fr)] lg:gap-x-12">
          {/* Rail */}
          <div>
            <div className="sticky top-0 flex h-screen flex-col py-24">
              <div className="relative flex flex-1 flex-col pl-px">
                <div className="absolute left-[3px] top-0 h-full w-px bg-white/10" aria-hidden />
                <motion.div className="absolute left-[3px] top-0 w-px bg-[#C56BF5]" style={{ height: fill }} aria-hidden />
                <ol className="flex flex-1 flex-col justify-between">
                  {STEPS.map((s, i) => (
                    <li key={s.label} className="relative pl-6">
                      <span
                        className={`absolute left-0 top-[6px] block h-[7px] w-[7px] -translate-x-[2px] rounded-full transition-colors duration-500 ${
                          i === active ? 'bg-[#C56BF5]' : i < active ? 'bg-white/35' : 'bg-white/15'
                        }`}
                        aria-hidden
                      />
                      <span
                        className={`font-jetbrains text-[10px] uppercase leading-[1.5] tracking-[0.12em] transition-colors duration-500 ${
                          i === active ? 'font-bold text-white' : 'text-white/30'
                        }`}
                      >
                        {s.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div>
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex h-screen flex-col justify-center">
                <motion.div
                  initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-35% 0px -35% 0px' }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Eyebrow tone={'black' in s ? 'blue' : 'violet'}>{s.label}</Eyebrow>
                  <h3 className="mt-5 font-hanken text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white xl:text-[2.6rem]">
                    {s.title}
                  </h3>
                  <p className="mt-5 text-[15px] leading-relaxed text-white/55">{s.body}</p>
                  <ul className="mt-8 space-y-2.5 border-t border-white/[0.08] pt-6">
                    {s.facts.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 font-jetbrains text-[11px] tracking-wide text-white/45">
                        <Check className="mt-[3px] h-3 w-3 shrink-0 text-[#2E95FF]" strokeWidth={2.5} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            ))}
          </div>

          {/* Pinned media */}
          <div>
            <div className="sticky top-0 flex h-screen items-center">
              <div className="relative w-full">
                {STEPS.map((s, i) => (
                  <motion.div
                    key={s.src}
                    className={i === 0 ? 'relative' : 'absolute inset-0'}
                    animate={{
                      opacity: i === active ? 1 : 0,
                      scale: reduce ? 1 : i === active ? 1 : 0.985,
                      y: reduce ? 0 : i === active ? 0 : 10,
                    }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden={i !== active}
                  >
                    {'panel' in s
                      ? <CalendarPanel src={s.src} alt={s.alt} />
                      : <Plate src={s.src} alt={s.alt} priority={i === 0} />}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile: the same story, stacked ── */}
        <div className="space-y-24 py-16 lg:hidden">
          {STEPS.map((s) => (
            <motion.section
              key={s.label}
              initial={{ opacity: 0, y: reduce ? 0 : 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-4">
                <Eyebrow tone={'black' in s ? 'blue' : 'violet'}>{s.label}</Eyebrow>
                <span className="h-px flex-1 bg-white/10" aria-hidden />
              </div>
              <h3 className="mt-5 font-hanken text-[1.75rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-white">
                {s.title}
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-white/55">{s.body}</p>
              <div className="mt-7">
                {'panel' in s
                  ? <CalendarPanel src={s.src} alt={s.alt} />
                  : <Plate src={s.src} alt={s.alt} />}
              </div>
            </motion.section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Daylight: the page itself changes theme ──────────────────── */

function Daylight() {
  const reduce = useReducedMotion();
  return (
    <section className="px-5 py-24 sm:px-8 sm:py-32" style={{ background: '#FAF8F5' }}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <Eyebrow tone="paper">Daylight</Eyebrow>
          <h2 className="mt-5 font-hanken text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[2.6rem]" style={{ color: '#2B2723' }}>
            A light mode that is warm paper, not a white wall.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: '#6A625A' }}>
            The whole workspace switches for a bright classroom: paper ground, brass labels,
            a highlighter wash on the page you are working from. Every label was checked
            against the background it sits on, so nothing turns to grey mist at noon.
          </p>
          <p className="mt-6 border-t pt-6 font-jetbrains text-[11px] leading-relaxed tracking-wide" style={{ borderColor: '#DAD2C7', color: '#7A7065' }}>
            Four accent colours · dd/mm/yyyy dates everywhere · 24-hour clock optional
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: '#DAD2C7', boxShadow: '0 24px 60px -35px rgba(74,58,42,0.45)' }}
        >
          <img
            src="/images/landing/light-planner.webp"
            alt="The weekly planner in light mode: warm paper background with violet study blocks and a green break."
            loading="lazy"
            decoding="async"
            className="w-full"
          />
        </motion.div>
      </div>
    </section>
  );
}

/* ── The rest of the workspace ────────────────────────────────── */

function Gallery() {
  const reduce = useReducedMotion();
  return (
    <section id="workspace" className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <Eyebrow tone="blue">The rest of the workspace</Eyebrow>
        <h2 className="mt-5 max-w-2xl font-hanken text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.6rem]">
          Four more pages you will actually open.
        </h2>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {GALLERY.map((g, i) => {
            const Icon = g.icon;
            return (
              <motion.article
                key={g.label}
                initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-12%' }}
                transition={{ duration: 0.6, delay: reduce ? 0 : (i % 2) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] transition-colors hover:border-white/20"
                style={{ background: SLAB }}
              >
                <div className="p-7 pb-6">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-[#C56BF5]" strokeWidth={1.75} />
                    <span className="font-jetbrains text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{g.label}</span>
                  </div>
                  <h3 className="mt-4 font-hanken text-xl font-bold tracking-[-0.02em] text-white">{g.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-white/50">{g.body}</p>
                </div>
                <div className={`mt-auto overflow-hidden border-t border-white/[0.06] px-7 ${g.portrait ? 'flex justify-center pt-7' : ''}`}>
                  <img
                    src={g.src}
                    alt={g.alt}
                    loading="lazy"
                    decoding="async"
                    className={
                      g.portrait
                        ? 'w-[62%] translate-y-3 rounded-t-lg border border-b-0 border-white/[0.08] transition-transform duration-700 group-hover:translate-y-1'
                        : 'w-full translate-y-3 rounded-t-lg border border-b-0 border-white/[0.08] transition-transform duration-700 group-hover:translate-y-1'
                    }
                  />
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Phone band */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08]" style={{ background: SLAB }}>
          <div className="grid items-center gap-10 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-4 w-4 text-[#C56BF5]" strokeWidth={1.75} />
                <span className="font-jetbrains text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">On your phone</span>
              </div>
              <h3 className="mt-4 max-w-md font-hanken text-xl font-bold tracking-[-0.02em] text-white">
                Add it to your home screen and reminders arrive like any other app.
              </h3>
              <p className="mt-2.5 max-w-md text-sm leading-relaxed text-white/50">
                Layora installs as a web app, so a block starting in ten minutes shows up as a
                notification on the phone in your pocket — no email, no inbox rules.
              </p>
            </div>
            <div className="flex justify-center gap-5">
              {[
                ['/images/landing/phone-overview.webp', 'The Layora dashboard on a phone screen.'],
                ['/images/landing/phone-zen.webp', 'Zen mode on a phone: a large focus countdown on black.'],
              ].map(([src, alt]) => (
                <img
                  key={src}
                  src={src}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                  className="w-[124px] rounded-[18px] border border-white/12 sm:w-[150px]"
                  style={{ boxShadow: '0 24px 60px -30px rgba(0,0,0,0.95)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Access + Google transparency ─────────────────────────────── */

function Access({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section id="access" className="border-t border-white/[0.07] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20">
          <div>
            <Eyebrow tone="brass">Who gets in</Eyebrow>
            <h2 className="mt-5 font-hanken text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.6rem]">
              A closed workspace for one department.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-white/55">
              Layora is not open to the internet. Your lecturer keeps the roster, and only the
              addresses on it can sign in — checked before a single page of the workspace is sent
              to your browser.
            </p>
            <button
              onClick={onSignIn}
              className="group mt-9 flex cursor-pointer items-center gap-2 rounded-xl bg-[#2E95FF] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0A7CF0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Sign in with Google
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
            </button>
          </div>

          <div className="space-y-px overflow-hidden rounded-2xl border border-white/[0.08]" style={{ background: SLAB }}>
            {[
              ['01', 'Your college account', 'Sign in with the @mite.ac.in Google account the college issued you. There is no password to make and no other way in.'],
              ['02', 'Your year, from the roster', 'The roster decides whether you are 2nd, 3rd or 4th year. That is what the scoreboard, the shared library and department events are scoped to.'],
              ['03', 'Not on it yet?', 'Ask your lecturer to add your address. Until then the workspace answers with a page that tells you exactly that.'],
            ].map(([n, t, b]) => (
              <div key={n} className="flex gap-6 border-b border-white/[0.06] p-7 last:border-b-0">
                <span className="font-jetbrains text-[11px] font-bold tabular-nums text-[#E0A93B]">{n}</span>
                <div>
                  <h3 className="font-hanken text-base font-bold tracking-[-0.01em] text-white">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Google API disclosure — required for the OAuth verification, and
            the honest answer to "what does it do with my calendar?". */}
        <div className="mt-6 rounded-2xl border border-white/[0.08] p-7 sm:p-10" style={{ background: SLAB }}>
          <div className="flex items-center gap-3 border-b border-white/[0.07] pb-5">
            <ShieldCheck className="h-4 w-4 text-[#2E95FF]" strokeWidth={1.75} />
            <h3 className="font-jetbrains text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              Google API scopes &amp; data boundaries
            </h3>
          </div>
          <div className="grid gap-10 pt-7 md:grid-cols-3">
            <div>
              <h4 className="font-jetbrains text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Scope requested</h4>
              <code className="mt-3 block select-all break-all rounded-lg border border-white/10 bg-black p-3 font-jetbrains text-[11px] text-[#2E95FF]">
                https://www.googleapis.com/auth/calendar.events
              </code>
              <p className="mt-3 text-xs leading-relaxed text-white/40">Sensitive scope · create and remove the events Layora itself wrote.</p>
            </div>
            <div>
              <h4 className="font-jetbrains text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">What it is used for</h4>
              <p className="mt-3 text-xs leading-relaxed text-white/55">
                Writing your timetable blocks and course deadlines into your calendar, and deleting
                those same events when you re-sync or wipe a week. Layora&rsquo;s use of information
                received from Google APIs adheres to the{' '}
                <span className="text-white/80">Google API Services User Data Policy</span>, including
                the Limited Use requirements.
              </p>
            </div>
            <div>
              <h4 className="font-jetbrains text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">What it never does</h4>
              <p className="mt-3 text-xs leading-relaxed text-white/55">
                It does not read your existing events, does not store your calendar on our servers,
                and does not sell, rent or transfer your Google user data to anyone. Files you upload
                go to your own Drive — Layora keeps the link, not the file.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/[0.07] px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#C56BF5] text-[11px] font-bold text-black">L</span>
              <span className="font-jetbrains text-[13px] font-bold tracking-[0.18em] text-white">LAYORA</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/40">
              Built for the CSE department at Mangalore Institute of Technology &amp; Engineering.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-jetbrains text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Built by</span>
            <div className="flex items-center gap-4">
              <span className="font-hanken text-base font-bold text-white">Vidwath N Karanth</span>
              <span className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 font-jetbrains text-[10px] text-white/45">
                <Terminal className="h-3 w-3" strokeWidth={2} /> Next.js · Supabase · Clerk
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/[0.06] pt-7 font-jetbrains text-[11px] text-white/30 sm:flex-row">
          <span>© {new Date().getFullYear()} Vidwath N Karanth. All rights reserved.</span>
          <div className="flex gap-7">
            <a href="/privacy" className="transition hover:text-white/70">Privacy Policy</a>
            <a href="/terms" className="transition hover:text-white/70">Terms &amp; Conditions</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function RootPage() {
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  // Derived, not stored: a state set inside the effect only to mirror what the
  // props already say costs an extra render pass on every visit.
  const showLanding = isAuthLoaded && isUserLoaded && !isSignedIn;

  useEffect(() => {
    if (!isAuthLoaded || !isUserLoaded || !isSignedIn) return;

    // Admins never see the student workspace — send them straight to the admin console.
    const email = user?.primaryEmailAddress?.emailAddress || '';
    const destination = isAdminEmail(email) ? '/admin' : '/dashboard';
    const timeout = setTimeout(() => {
      router.replace(destination);
    }, 500);
    return () => clearTimeout(timeout);
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, router]);

  const goToLogin = () => router.push('/login');

  if (showLanding) {
    return (
      <main className="relative min-h-screen overflow-x-clip font-geist" style={{ background: INK, color: '#EDEEF0' }}>
        {/* `overflow-x: hidden` — here and on body in globals.css — turns the
            element into a scroll container, which stops every `position:
            sticky` descendant from ever sticking. `clip` crops the same
            overflow without creating one, so the day rail can pin. */}
        <style>{`body { overflow-x: clip; }`}</style>
        <Nav onSignIn={goToLogin} />
        <Hero onSignIn={goToLogin} />

        <section id="features" className="px-5 pb-6 pt-28 sm:px-8 sm:pt-36">
          <div className="mx-auto max-w-7xl">
            <Eyebrow>Inside the workspace</Eyebrow>
            <h2 className="mt-5 max-w-2xl font-hanken text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.6rem]">
              Six features, one screen at a time.
            </h2>
          </div>
        </section>

        <Cinema />
        <Daylight />
        <Gallery />
        <Access onSignIn={goToLogin} />
        <Footer />
      </main>
    );
  }

  // Handing a signed-in student over to their workspace.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6" style={{ background: INK }}>
      <div className="flex flex-col items-center gap-7">
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C56BF5]"
        >
          <span className="text-2xl font-bold tracking-tighter text-black">L</span>
        </motion.div>
        <div className="text-center">
          <h1 className="font-jetbrains text-lg font-bold tracking-[0.2em] text-white">LAYORA</h1>
          <p className="mt-2 font-jetbrains text-[11px] uppercase tracking-[0.18em] text-white/35">Opening your workspace</p>
        </div>
      </div>
    </main>
  );
}
