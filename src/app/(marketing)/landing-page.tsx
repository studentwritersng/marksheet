"use client";

import { useState, useEffect, useRef } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { trackDemoRequest, trackVerificationLookup } from "@/lib/analytics/events";
import Image from "next/image";
import {
  ArrowUpRight,
  BadgeCheck,
  Mail,
  MapPin,
  Phone,
  Plus,
  Quote,
  Search,
} from "lucide-react";
import { submitDemoRequestAction, type DemoRequestResult } from "./actions";

const marquee = [
  "3 terms per session",
  "CA + exam weighting",
  "NERDC-aligned topics",
  "Offline exam hall",
  "AI essay grading",
  "Verified report cards",
  "NDPR compliant",
  "CSV migration",
];

const timeline = [
  {
    week: "Weeks 1–2",
    title: "Set up the session",
    body: "Create the session and its three terms, load classes and arms, and import students from a validated CSV. Nothing touches live records until the staging report is clean.",
  },
  {
    week: "Weeks 3–9",
    title: "Teach and track coverage",
    body: "Upload syllabi once, then tick off topics week by week. Lesson notes are written or AI-drafted against the same NERDC-aligned topic tree, so coverage gaps show up early.",
  },
  {
    week: "Weeks 10–11",
    title: "Run CA and the main exam",
    body: "Build papers from a shared question bank, print or deliver online, and invigilate on the school LAN. MCQs grade instantly; essays get rubric-grounded AI assistance for the teacher to confirm.",
  },
  {
    week: "Week 12",
    title: "Compute, publish, verify",
    body: "Weighted term scores compute automatically. Publish report cards with a verification code any parent or employer can check on the public portal in seconds.",
  },
];

const addons = [
  { n: "01", title: "Timetable Generator", body: "Collision-free timetables from staff availability and subject load." },
  { n: "02", title: "Period Tracker", body: "Two-way verification of coverage between teachers and class captains." },
  { n: "03", title: "Daily Attendance", body: "QR-based student and staff attendance with ID card generation." },
  { n: "04", title: "WhatsApp & SMS", body: "Result alerts and school notices delivered straight to guardians." },
  { n: "05", title: "Multi-Branch", body: "Proprietor oversight across branches without breaking tenant isolation." },
];

const faqs = [
  {
    q: "What if the internet drops during exams?",
    a: "Exam delivery and MCQ grading run on the school LAN with no internet at all. Answers are stored locally and sync to the cloud once connectivity returns.",
  },
  {
    q: "Can we move records from our current system?",
    a: "Yes. CSV templates for students and staff are staged, validated and shown with clear error reports before anything is committed to live records.",
  },
  {
    q: "What happens if our license lapses?",
    a: "Nothing is deleted. The platform soft-locks so you keep reading historical records, while renewal is arranged with our team.",
  },
  {
    q: "How is student data protected?",
    a: "Guardian consent capture, role-scoped access and a full audit log of who viewed or changed sensitive records, in line with the NDPR.",
  },
  {
    q: "How does result verification work?",
    a: "Every published report card carries a unique code. Anyone with it can check the authenticated summary on our public portal.",
  },
  {
    q: "Do we sign up and pay online?",
    a: "No. Onboarding is sales-led: you book a demo, we understand your school, and we activate your license personally.",
  },
];

const COUNT_RANGES = ["Under 100", "100 – 300", "300 – 500", "500 – 1,000", "1,000+"];

type BlogCardVM = {
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  publishedAt: string | null;
  featuredImageUrl: string | null;
};

export function MarketingLandingPage({
  stats,
  posts = [],
}: {
  stats?: Array<{ value: string; label: string }>;
  posts?: BlogCardVM[];
}) {
  const [code, setCode] = useState("");
  const [verifyState, setVerifyState] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    message?: string;
    result?: { studentName: string; className: string; session: string; term: string; overallAverage: number | null };
  }>({ status: "idle" });

  const [demoState, demoAction, demoPending] = useActionState(submitDemoRequestAction, {} as DemoRequestResult);

  // Fire the demo-request conversion event once, after a successful submission.
  const demoTrackedRef = useRef(false);
  useEffect(() => {
    if (demoState.success && !demoTrackedRef.current) {
      demoTrackedRef.current = true;
      trackDemoRequest();
    }
  }, [demoState]);

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifyState({ status: "loading" });
    try {
      const res = await fetch(`/api/verify?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      // NDPR-safe: only the aggregate success boolean is tracked — never the
      // code, name, school, or score.
      if (data.error) {
        trackVerificationLookup(false);
        setVerifyState({ status: "error", message: data.error });
      } else {
        trackVerificationLookup(true);
        setVerifyState({
          status: "ok",
          result: {
            studentName: data.studentName,
            className: data.className,
            session: data.session,
            term: data.term,
            overallAverage: data.overallAverage,
          },
        });
      }
    } catch {
      setVerifyState({ status: "error", message: "Could not reach the verification service. Try again." });
    }
  }

  return (
    <>
      {/* Utility strip */}
      <div className="bg-mk-ink py-2 text-mk-ink-fg">
        <div className="flex overflow-hidden">
          <div className="flex shrink-0 animate-mk-marquee gap-8 pr-8">
            {[...marquee, ...marquee].map((m, i) => (
              <span
                key={i}
                className="flex shrink-0 items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-mk-ink-fg/70"
              >
                <span className="h-1 w-1 rounded-full bg-mk-amber" />
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hero: full-bleed photograph */}
      <section id="top" className="relative isolate overflow-hidden">
        <img
          src="/marketing/classroom.jpg"
          alt="Students writing an exam in a Nigerian secondary school classroom"
          width={1408}
          height={1008}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-mk-ink/85" />

        <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-20 sm:pt-28 lg:pb-20 lg:pt-36">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">
            Built for Nigerian secondary schools
          </p>
          <h1 className="mt-6 max-w-3xl font-mk-display text-[2.6rem] font-bold leading-[0.98] text-mk-ink-fg sm:text-6xl lg:text-7xl">
            From syllabus to
            <br />
            verified report card
            <br />
            <span className="text-mk-amber">in one place.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-relaxed text-mk-ink-fg/75">
            Syllabus upload, lesson notes, continuous assessment, exams and results. Computed,
            published and verified. No more lost notebooks, no more re-typed scores.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#demo"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-mk-warm px-7 py-3.5 text-sm font-bold text-mk-ink"
            >
              Book a demo
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="/register"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full glass px-7 py-3.5 text-sm font-semibold text-mk-ink-fg"
            >
              <ArrowUpRight className="h-4 w-4 text-mk-amber" />
              Register
            </a>
          </div>

          <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl glass sm:grid-cols-4">
            {(stats && stats.length
              ? stats
              : [
                  { value: "3", label: "terms tracked" },
                  { value: "1", label: "source of truth" },
                  { value: "0", label: "re-typed scores" },
                  { value: "24/7", label: "code verification" },
                ]
            ).map((stat) => (
              <div key={stat.label} className="px-5 py-4">
                <dt className="font-mk-display text-2xl font-bold text-mk-ink-fg">{stat.value}</dt>
                <dd className="mt-0.5 text-xs text-mk-ink-fg/60">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Problem: editorial two column with rule */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <h2 className="font-mk-display text-3xl font-bold leading-tight sm:text-4xl">
            Paper files go missing.
            <br />
            Spreadsheets drift out of sync.
            <br />
            <span className="text-mk-primary">
              Neither leaves a trace you can trust.
            </span>
          </h2>
          <div className="min-w-0 space-y-6 text-base leading-relaxed text-mk-muted-fg">
            <p>
              Every term a school juggles syllabi, lesson notes, question papers, invigilation
              rosters and result computation. When that lives across notebooks and shared Excel
              files, results come out late, transcription mistakes creep in, and nobody can prove a
              report card is genuine.
            </p>
            <div className="h-px rule-line" />
            <p>
              Marksheet gives the whole academic cycle one structured home. Built around the
              Nigerian school calendar rather than bent into a generic school app.
            </p>
          </div>
        </div>
      </section>

      {/* Timeline: the term, week by week */}
      <section id="term" className="border-y border-mk-border bg-mk-secondary/40 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
                The term, week by week
              </p>
              <h2 className="mt-5 font-mk-display text-3xl font-bold sm:text-4xl">
                Twelve weeks, four moves
              </h2>
              <p className="mt-4 max-w-md text-mk-muted-fg">
                Marksheet follows the shape of the term you already run. It doesn&apos;t ask your staff
                to invent a new workflow.
              </p>
              <img
                src="/marketing/teacher-laptop.jpg"
                alt="A teacher entering student scores on a laptop beside a paper mark register"
                loading="lazy"
                width={1200}
                height={912}
                className="mt-8 hidden w-full rounded-3xl object-cover shadow-mk-lift lg:block"
              />
            </div>

            <ol className="min-w-0 space-y-3">
              {timeline.map((t, i) => (
                <li
                  key={t.title}
                  className="rounded-2xl border border-mk-border bg-mk-card p-6 shadow-mk-soft"
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mk-ink font-mk-display text-xs font-bold text-mk-ink-fg">
                      {i + 1}
                    </span>
                    <span className="truncate text-[0.7rem] font-bold uppercase tracking-[0.2em] text-mk-primary">
                      {t.week}
                    </span>
                  </div>
                  <h3 className="mt-4 font-mk-display text-xl font-bold">{t.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">{t.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Bento platform grid — now the Features hub teaser */}
      <section id="platform" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">The platform</p>
            <h2 className="mt-3 font-mk-display text-3xl font-bold leading-tight sm:text-4xl">
              Everything the academic cycle touches — 18 modules, one tenant.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-mk-muted-fg">
              From syllabus to verified report card. Role-scoped for proprietors, principals, teachers, bursars and guardians — so every screen shows only what that person is meant to see.
            </p>
          </div>
          <Link
            href="/features"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-mk-ink px-6 py-3 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
          >
            See all features
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col justify-between rounded-3xl bg-mk-ink p-8 text-mk-ink-fg">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">
                Featured
              </p>
              <h3 className="mt-5 font-mk-display text-3xl font-bold leading-tight">
                Start with the term you already run
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-mk-ink-fg/70">
                Marksheet does not ask your staff to invent a new workflow. It follows weeks 1–12 as you teach them — and gives each week a record that can be audited.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/features"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-mk-warm px-5 py-2.5 text-sm font-bold text-mk-ink"
              >
                Explore all 18 features
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href="#demo"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-mk-ink-fg backdrop-blur"
              >
                See it live
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <Link href="/features/exams" className="group rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft transition-colors hover:border-mk-primary/40">
            <span className="font-mk-display text-3xl font-bold text-mk-primary">01</span>
            <h3 className="mt-4 font-mk-display text-xl font-bold group-hover:text-mk-primary">Exams & AI grading</h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
              Shared question bank, hall or online delivery, instant MCQ scoring and rubric-grounded essay assistance.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mk-primary">
              Read about this feature <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>

          <Link href="/features/results-grading-report-cards" className="group rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft transition-colors hover:border-mk-primary/40">
            <span className="font-mk-display text-3xl font-bold text-mk-coral">02</span>
            <h3 className="mt-4 font-mk-display text-xl font-bold group-hover:text-mk-primary">Results & report cards</h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
              Weighted CA + exam totals, ranking, broadsheets and report cards with a code any parent or employer can verify.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mk-primary">
              Read about this feature <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>

          <Link href="/features/bursary-fee-management" className="group rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft transition-colors hover:border-mk-primary/40">
            <span className="font-mk-display text-3xl font-bold text-mk-teal">03</span>
            <h3 className="mt-4 font-mk-display text-xl font-bold group-hover:text-mk-primary">Bursary & fees</h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
              Fee items per level, payments per student, derived cleared/partial/not_paid and auto-reminders with {"{{variables}}"}.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mk-primary">
              Read about this feature <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>

          <Link href="/features/messaging" className="group rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft transition-colors hover:border-mk-primary/40">
            <span className="font-mk-display text-3xl font-bold text-mk-primary">04</span>
            <h3 className="mt-4 font-mk-display text-xl font-bold group-hover:text-mk-primary">Messaging at scale</h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
              Private 1:1 threads. Bulk to “all JSS2 parents” as 64 private conversations, each with {"{{student_name}}"}.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mk-primary">
              Read about this feature <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>

          <Link href="/features/curriculum-syllabus-lesson-notes" className="group overflow-hidden rounded-3xl border border-mk-border bg-mk-card shadow-mk-soft transition-colors hover:border-mk-primary/40 sm:col-span-2 lg:col-span-2">
            <img
              src="/marketing/parent-student.jpg"
              alt="A parent and student checking a published result on a phone"
              loading="lazy"
              width={1200}
              height={912}
              className="h-48 w-full object-cover sm:h-52"
            />
            <div className="p-7">
              <h3 className="font-mk-display text-xl font-bold">Syllabus, lesson notes & curriculum tracker</h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mk-muted-fg">
                NERDC-aligned topics, coverage you can prove (teacher marks, class captain verifies), and lesson notes that live where the syllabus lives — so an exam never asks what was not taught.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-mk-primary">
                Read about this feature <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </div>

        {/* Secondary strip: 6 more teasers */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/features/timetable", n: "06", t: "Timetable", d: "Manual grid or collision-free generator from rooms & availability." },
            { href: "/features/attendance", n: "07", t: "Attendance", d: "Daily or per-period, QR cards, flows into report cards." },
            { href: "/features/question-bank", n: "08", t: "Question Bank", d: "Stimulus → group → question, draft → approved, CSV staged." },
            { href: "/features/homework", n: "09", t: "Homework", d: "Take-home MCQs + essays, auto-grade, parent-visible." },
            { href: "/features/mobile-app-push-notifications", n: "10", t: "Mobile & Push", d: "Android APK + free, unlimited FCM to the lock screen." },
            { href: "/features/data-imports-exports", n: "11", t: "Imports & Exports", d: "Stage, validate, commit — then export CSV/DOC/PDF/XLSX." },
          ].map((f) => (
            <Link key={f.href} href={f.href} className="group flex items-center gap-4 rounded-2xl border border-mk-border bg-mk-card p-4 shadow-mk-soft transition-colors hover:border-mk-primary/40">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mk-secondary font-mono text-xs text-mk-muted-fg">{f.n}</span>
              <div className="min-w-0">
                <span className="block font-mk-display text-sm font-bold group-hover:text-mk-primary">{f.t}</span>
                <span className="block text-xs leading-relaxed text-mk-muted-fg">{f.d}</span>
              </div>
              <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-mk-muted-fg group-hover:text-mk-primary" />
            </Link>
          ))}
        </div>
        <p className="mt-4 text-right">
          <Link href="/features" className="inline-flex items-center gap-1.5 text-sm font-semibold text-mk-primary hover:underline">
            See all 18 features
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </p>
      </section>

      {/* Verify strip: wired to the real public verification API */}
      <section id="verify" className="bg-mk-hero py-20 text-mk-ink-fg lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">
              Public portal
            </p>
            <h2 className="mt-5 font-mk-display text-3xl font-bold sm:text-4xl">
              Anyone can check a report card in seconds
            </h2>
            <p className="mt-4 max-w-md text-mk-ink-fg/70">
              Employers, universities and parents type the code printed on the report card. No
              account, no phone call to the school office.
            </p>
            <a href="/verify" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-mk-amber hover:underline">
              Open the full verification portal
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <form
            onSubmit={checkCode}
            className="min-w-0 rounded-3xl bg-mk-card p-6 text-mk-card-fg shadow-mk-lift sm:p-8"
          >
            <label className="block text-sm font-semibold">
              Verification code
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setVerifyState({ status: "idle" });
                  }}
                  placeholder="MS-8KQ2X7L3P"
                  className="min-w-0 rounded-full border border-mk-input bg-mk-bg px-5 py-3 font-mono text-sm uppercase outline-none focus:border-mk-primary"
                />
                <button
                  type="submit"
                  disabled={verifyState.status === "loading"}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-mk-primary px-5 py-3 text-sm font-bold text-mk-primary-fg disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {verifyState.status === "loading" ? "Checking" : "Check"}
                  </span>
                </button>
              </div>
            </label>

            <div className="mt-5 rounded-2xl bg-mk-muted p-5">
              {verifyState.status === "ok" && verifyState.result ? (
                <>
                  <p className="flex items-center gap-2 text-sm font-bold text-mk-primary">
                    <BadgeCheck className="h-4 w-4" />
                    Verified
                  </p>
                  <p className="mt-3 font-mk-display text-lg font-bold">{verifyState.result.studentName}</p>
                  <p className="text-sm text-mk-muted-fg">
                    {verifyState.result.className} · {verifyState.result.session} ·{" "}
                    {verifyState.result.term}
                    {verifyState.result.overallAverage != null && ` · ${verifyState.result.overallAverage}%`}
                  </p>
                </>
              ) : verifyState.status === "error" ? (
                <p className="flex items-start gap-2 text-sm text-red-600">
                  <BadgeCheck className="h-4 w-4 mt-0.5" />
                  <span>{verifyState.message}</span>
                </p>
              ) : (
                <p className="text-sm text-mk-muted-fg">
                  Enter a code to see how a verified result looks. Live codes resolve to the issuing
                  school, session, term and overall grade.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[0.55fr_1fr] lg:items-center lg:gap-14">
          <img
            src="/marketing/principal.jpg"
            alt="Principal Mrs. Ngozi Eze standing in a school corridor"
            loading="lazy"
            width={912}
            height={1104}
            className="w-full rounded-3xl object-cover shadow-mk-lift"
          />
          <figure className="min-w-0">
            <Quote className="h-9 w-9 text-mk-coral" />
            <blockquote className="mt-5 font-mk-display text-2xl font-bold leading-snug sm:text-3xl">
              &quot;Broadsheet week used to swallow the whole holiday. Last term we published every
              result four days after the last paper. Not one parent called to query a total.&quot;
            </blockquote>
            <figcaption className="mt-6 text-sm">
              <span className="font-bold">Mrs. Ngozi Eze</span>
              <span className="block text-mk-muted-fg">Principal, Bright Future College, Enugu</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Blog */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
              From the blog
            </p>
            <h2 className="mt-5 font-mk-display text-3xl font-bold sm:text-4xl">
              Guides, updates and perspectives
            </h2>
          </div>
          <Link
            href="/blog"
            className="hidden shrink-0 items-center gap-2 rounded-full border border-mk-border bg-mk-card px-5 py-2.5 text-sm font-semibold text-mk-fg transition-colors hover:border-mk-primary/40 sm:inline-flex"
          >
            View all posts
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.length === 0 ? (
            <p className="text-sm text-mk-muted-fg">No posts published yet.</p>
          ) : (
            posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-mk-border bg-mk-card shadow-mk-soft transition-colors hover:border-mk-primary/40"
              >
                {post.featuredImageUrl ? (
                  <img
                    src={post.featuredImageUrl}
                    alt={post.title}
                    loading="lazy"
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="h-44 w-full bg-mk-secondary/50" />
                )}
                <div className="flex min-w-0 flex-1 flex-col p-6">
                  <div className="flex items-center gap-3 text-xs text-mk-muted-fg">
                    {post.category && (
                      <span className="rounded-full bg-mk-secondary px-2.5 py-0.5 font-medium text-mk-secondary-fg">
                        {post.category}
                      </span>
                    )}
                    {post.publishedAt && (
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString("en-NG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-mk-display text-xl font-bold leading-snug transition-colors group-hover:text-mk-primary">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mk-muted-fg">
                      {post.excerpt}
                    </p>
                  )}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-mk-primary">
                    Read post
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="mt-8 sm:hidden">
          <Link
            href="/blog"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-mk-border bg-mk-card px-6 py-3 text-sm font-semibold text-mk-fg"
          >
            View all posts
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Addons */}
      <section className="border-y border-mk-border bg-mk-secondary/40 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
                Addons
              </p>
              <h2 className="mt-5 font-mk-display text-3xl font-bold sm:text-4xl">
                Turn on only what your school needs
              </h2>
              <p className="mt-4 text-mk-muted-fg">
                Every addon is available on request and activated per school. No code changes, no
                new logins.
              </p>
              <div className="mt-8 overflow-hidden rounded-2xl border border-mk-border shadow-mk-soft">
                <Image
                  src="/addons-illustration.webp"
                  alt="Marksheet addons illustration"
                  width={1920}
                  height={1080}
                  className="h-auto w-full"
                />
              </div>
            </div>
            <ul className="min-w-0">
              {addons.map((a) => (
                <li
                  key={a.n}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-t border-mk-border py-5 last:border-b"
                >
                  <span className="font-mono text-xs text-mk-muted-fg">{a.n}</span>
                  <div className="min-w-0">
                    <h3 className="font-mk-display text-lg font-bold">{a.title}</h3>
                    <p className="mt-1 text-sm text-mk-muted-fg">{a.body}</p>
                  </div>
                  <Plus className="h-4 w-4 shrink-0 text-mk-muted-fg transition-transform group-hover:rotate-90" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:items-center">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">Pricing</p>
            <h2 className="mt-5 max-w-xl font-mk-display text-3xl font-bold sm:text-4xl">
              One licence per school. Set up personally.
            </h2>

            <div className="mt-10 space-y-4">
              {[
                {
                  plan: "Monthly",
                  price: "₦25,000",
                  unit: "per school, per month",
                  note: "Rolling. Good for a school trying a first term.",
                  dark: false,
                },
                {
                  plan: "Termly",
                  price: "₦70,000",
                  unit: "per school, per term",
                  note: "Best value. Covers a full term including result publication.",
                  dark: true,
                },
              ].map((p) => (
                <div
                  key={p.plan}
                  className={`rounded-3xl p-7 sm:p-8 ${
                    p.dark ? "bg-mk-ink text-mk-ink-fg" : "border border-mk-border bg-mk-card shadow-mk-soft"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mk-display text-xl font-bold">{p.plan}</span>
                      {p.dark && (
                        <span className="rounded-full bg-mk-warm px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-mk-ink">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className={`text-[0.65rem] font-bold uppercase tracking-widest ${p.dark ? "text-mk-ink-fg/60" : "text-mk-muted-fg"}`}>
                        Starting from
                      </p>
                      <p className="mt-0.5 font-mk-display text-3xl font-bold">{p.price}</p>
                      <p className={`text-xs ${p.dark ? "text-mk-ink-fg/60" : "text-mk-muted-fg"}`}>
                        {p.unit}
                      </p>
                    </div>
                  </div>
                  <p className={`mt-4 text-sm ${p.dark ? "text-mk-ink-fg/70" : "text-mk-muted-fg"}`}>
                    {p.note}
                  </p>
                  <a
                    href="#demo"
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold ${
                      p.dark ? "bg-mk-card text-mk-card-fg" : "bg-mk-ink text-mk-ink-fg"
                    }`}
                  >
                    Book a demo
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-mk-muted-fg">
              No online checkout, no surprise renewal fees. Licensing is arranged with our team.
            </p>
            <p className="mt-2 text-xs text-mk-muted-fg">
              Prices shown are the starting point. Larger schools use more AI credits and pay more than
              smaller schools.
            </p>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-3xl border border-mk-border shadow-mk-soft">
              <Image
                src="/license-illustration.webp"
                alt="Marksheet licence illustration"
                width={1080}
                height={1350}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-mk-border py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-mk-display text-3xl font-bold sm:text-4xl">Questions schools ask</h2>
          <div className="mt-10 grid gap-x-14 gap-y-2 md:grid-cols-2">
            {faqs.map((f) => (
              <details key={f.q} className="group border-b border-mk-border py-5">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                  <span className="font-mk-display text-base font-bold">{f.q}</span>
                  <Plus className="h-4 w-4 shrink-0 text-mk-muted-fg transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-mk-muted-fg">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Referral program */}
      <section id="referral" className="border-t border-mk-border bg-mk-secondary/40 py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
              Referral program
            </p>
            <h2 className="mt-5 font-mk-display text-3xl font-bold sm:text-4xl">
              Refer a school.
              <br />
              Earn on every registration.
            </h2>
            <p className="mt-4 max-w-md text-mk-muted-fg">
              Know a school that needs a calmer, more structured term? Share your unique code and
              earn a commission each time a school registers through you.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Your own referral link, shareable anywhere",
                "Commission on every paid school registration",
                "Track your referrals and commissions in your own dashboard",
              ].map((t) => (
                <li key={t} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm">
                  <BadgeCheck className="h-5 w-5 shrink-0 text-mk-teal" />
                  <span className="min-w-0">{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="/referral"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
              >
                Join the program
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href="/referral/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-mk-border bg-mk-card px-6 py-3 text-sm font-semibold text-mk-fg transition-colors hover:border-mk-primary/40"
              >
                Agent login
              </a>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl bg-mk-ink p-7 text-mk-ink-fg">
              <p className="font-mk-display text-4xl font-bold text-mk-amber">₦50,000</p>
              <p className="mt-2 text-sm leading-relaxed text-mk-ink-fg/70">
                commission on a ₦250,000 school registration fee
              </p>
            </div>
            <div className="rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft">
              <p className="font-mk-display text-4xl font-bold text-mk-teal">20%</p>
              <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
                of the registration fee paid to you per referred school
              </p>
            </div>
            <div className="rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft">
              <p className="font-mk-display text-4xl font-bold text-mk-coral">1</p>
              <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
                unique code, yours for every school you refer
              </p>
            </div>
            <div className="rounded-3xl bg-mk-hero p-7 text-mk-ink-fg">
              <p className="font-mk-display text-4xl font-bold text-mk-warm">0</p>
              <p className="mt-2 text-sm leading-relaxed text-mk-ink-fg/70">
                cost to join, no quota to hit
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact us */}
      <section id="contact" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
              Contact us
            </p>
            <h2 className="mt-5 font-mk-display text-3xl font-bold sm:text-4xl">
              Talk to us about your school
            </h2>
            <p className="mt-4 max-w-md text-mk-muted-fg">
              Prefer to ask a human? Reach us by email, phone or WhatsApp — or visit us in Surulere, Lagos.
            </p>
          </div>
          <div className="min-w-0 space-y-3">
            <a
              href="mailto:info@marksheet.top"
              className="flex items-center gap-4 rounded-2xl border border-mk-border bg-mk-card p-5 shadow-mk-soft transition-colors hover:border-mk-primary/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mk-secondary text-mk-primary">
                <Mail className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-widest text-mk-muted-fg">Email</span>
                <span className="mt-0.5 block truncate text-sm font-bold text-mk-fg">info@marksheet.top</span>
              </span>
            </a>
            <a
              href="tel:07042819602"
              className="flex items-center gap-4 rounded-2xl border border-mk-border bg-mk-card p-5 shadow-mk-soft transition-colors hover:border-mk-primary/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mk-secondary text-mk-teal">
                <Phone className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-widest text-mk-muted-fg">Phone</span>
                <span className="mt-0.5 block truncate text-sm font-bold text-mk-fg">07042819602</span>
              </span>
            </a>
            <div className="flex items-center gap-4 rounded-2xl border border-mk-border bg-mk-card p-5 shadow-mk-soft">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mk-secondary text-mk-coral">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-widest text-mk-muted-fg">Address</span>
                <span className="mt-0.5 block text-sm font-bold text-mk-fg">
                  1, Elder Adedigba street, Suberu-oje, Surulere, Lagos
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="bg-mk-ink py-20 text-mk-ink-fg lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">
              Book a demo
            </p>
            <h2 className="mt-5 font-mk-display text-3xl font-bold sm:text-5xl">
              See a full term run in 25 minutes
            </h2>
            <p className="mt-5 max-w-md text-mk-ink-fg/70">
              We&apos;ll set up your session live, run a mock exam, and publish a verified report card
              using your own class structure.
            </p>
            <ul className="mt-10 space-y-4 border-t border-white/10 pt-8">
              {[
                "A call with someone who knows the product",
                "A live walkthrough, not a slide deck",
                "A clear next step, no pressure",
              ].map((t) => (
                <li key={t} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm">
                  <BadgeCheck className="h-5 w-5 shrink-0 text-mk-amber" />
                  <span className="min-w-0 text-mk-ink-fg/85">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <form
            action={demoAction}
            className="min-w-0 rounded-3xl bg-mk-card p-6 text-mk-card-fg sm:p-8"
          >
            {/* Honeypot: bots fill this hidden field; it must stay empty */}
            <div className="sr-only" aria-hidden="true">
              <label>
                Leave this field empty
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <input type="hidden" name="source" value="homepage_demo" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" name="contactName" placeholder="Adaeze Okafor" required />
              <Field label="School name" name="schoolName" placeholder="Bright Future College" required />
              <Field label="Phone" name="phone" placeholder="0801 234 5678" />
              <Field label="Work email" name="email" type="email" placeholder="you@school.edu.ng" required />
            </div>

            <label className="mt-4 block text-sm font-semibold">
              Number of students
              <select
                name="studentCountRange"
                className="mt-1.5 w-full rounded-xl border border-mk-input bg-mk-bg px-4 py-3 text-sm outline-none focus:border-mk-primary"
              >
                <option value="">Select a range</option>
                {COUNT_RANGES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm font-semibold">
              Anything we should know?
              <textarea
                name="message"
                rows={3}
                placeholder="Tell us about your school"
                className="mt-1.5 w-full resize-none rounded-xl border border-mk-input bg-mk-bg px-4 py-3 text-sm outline-none focus:border-mk-primary"
              />
            </label>

            {demoState.error && (
              <p className="mt-4 rounded-xl bg-red-100 px-4 py-2.5 text-sm font-medium text-red-700">
                {demoState.error}
              </p>
            )}
            {demoState.success && (
              <p className="mt-4 rounded-xl bg-green-100 px-4 py-2.5 text-sm font-medium text-green-800">
                {demoState.success}
              </p>
            )}

            <button
              type="submit"
              disabled={demoPending}
              className="mt-6 w-full rounded-full bg-mk-warm px-6 py-3.5 text-sm font-bold text-mk-ink disabled:opacity-60"
            >
              {demoPending ? "Submitting…" : "Request my demo"}
            </button>
            <p className="mt-3 text-center text-xs text-mk-muted-fg">
              No account is created. This is purely a contact request.
            </p>
          </form>
        </div>
      </section>

      <footer className="bg-mk-ink pb-10 text-mk-ink-fg">
        <div className="mx-auto grid max-w-6xl gap-6 border-t border-white/10 px-5 pt-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-1.5">
            <img
              src="/marksheet_logo.png"
              alt="Marksheet"
              className="h-6 w-auto brightness-0 invert"
            />
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-mk-ink-fg/50">
            <Link href="/register" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-mk-ink-fg">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Register
            </Link>
            <Link href="/login" className="transition-colors hover:text-mk-ink-fg">
              School login
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-mk-ink-fg">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-mk-ink-fg">
              Terms
            </Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-mk-ink-fg">
              Cookies
            </Link>
            <Link href="/legal/refund" className="transition-colors hover:text-mk-ink-fg">
              Refund Policy
            </Link>
            <Link href="/referral" className="inline-flex items-center gap-1.5 transition-colors hover:text-mk-ink-fg">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Referral program
            </Link>
          </div>
          <p className="text-xs text-mk-ink-fg/50">
            © {new Date().getFullYear()} Marksheet · Built for Nigerian schools
          </p>
        </div>
      </footer>

      {/* Floating WhatsApp chat */}
      <a
        href="https://wa.me/2347042819602"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        </a>
    </>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-mk-input bg-mk-bg px-4 py-3 text-sm font-normal outline-none focus:border-mk-primary"
      />
    </label>
  );
}
