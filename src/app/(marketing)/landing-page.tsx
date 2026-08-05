"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  Menu,
  Plus,
  Quote,
  Search,
  X,
} from "lucide-react";
import { submitDemoRequestAction, type DemoRequestResult } from "./actions";

const nav = [
  { label: "The term", href: "#term" },
  { label: "Platform", href: "#platform" },
  { label: "Verify", href: "#verify" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

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

export function MarketingLandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [code, setCode] = useState("");
  const [verifyState, setVerifyState] = useState<{
    status: "idle" | "loading" | "ok" | "error";
    message?: string;
    result?: { studentName: string; className: string; session: string; term: string; overallAverage: number | null };
  }>({ status: "idle" });

  const [demoState, demoAction, demoPending] = useActionState(submitDemoRequestAction, {} as DemoRequestResult);

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifyState({ status: "loading" });
    try {
      const res = await fetch(`/api/verify?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (data.error) {
        setVerifyState({ status: "error", message: data.error });
      } else {
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
    <div className="marketing-root min-h-screen bg-mk-bg text-mk-fg">
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

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-mk-border bg-mk-bg/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 lg:flex lg:justify-between">
          <a href="#top" className="flex min-w-0 items-center gap-1.5">
            <img src="/marksheet_logo.png" alt="Marksheet" className="h-8 w-auto" />
          </a>

          <nav className="hidden items-center gap-1 rounded-full border border-mk-border bg-mk-card p-1 lg:flex">
            {nav.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-mk-muted-fg transition-colors hover:bg-mk-secondary hover:text-mk-secondary-fg"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <a
            href="#demo"
            className="hidden items-center gap-1.5 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-semibold text-mk-ink-fg transition-colors hover:bg-mk-primary lg:inline-flex"
          >
            Book a demo
            <ArrowUpRight className="h-4 w-4" />
          </a>

          <button
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-mk-border lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-mk-border bg-mk-bg px-5 pb-5 pt-2 lg:hidden">
            {nav.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-mk-border py-3.5 text-sm font-medium"
              >
                {l.label}
                <ChevronRight className="h-4 w-4 text-mk-muted-fg" />
              </a>
            ))}
            <a
              href="#demo"
              onClick={() => setMenuOpen(false)}
              className="mt-4 block rounded-full bg-mk-ink px-5 py-3 text-center text-sm font-semibold text-mk-ink-fg"
            >
              Book a demo
            </a>
          </div>
        )}
      </header>

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
            {[
              ["3", "terms tracked"],
              ["1", "source of truth"],
              ["0", "re-typed scores"],
              ["24/7", "code verification"],
            ].map(([k, v]) => (
              <div key={v} className="px-5 py-4">
                <dt className="font-mk-display text-2xl font-bold text-mk-ink-fg">{k}</dt>
                <dd className="mt-0.5 text-xs text-mk-ink-fg/60">{v}</dd>
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

      {/* Bento platform grid */}
      <section id="platform" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1 lg:row-span-2 flex flex-col justify-between rounded-3xl bg-mk-ink p-8 text-mk-ink-fg">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">
                The platform
              </p>
              <h2 className="mt-5 font-mk-display text-3xl font-bold leading-tight">
                Everything the academic cycle touches
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-mk-ink-fg/70">
                One tenant per school. Role-scoped for proprietors, principals, teachers, bursars
                and guardians.
              </p>
            </div>
            <a
              href="#demo"
              className="mt-10 inline-flex w-fit items-center gap-2 rounded-full bg-mk-warm px-5 py-2.5 text-sm font-bold text-mk-ink"
            >
              See it live
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <article className="rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft">
            <span className="font-mk-display text-3xl font-bold text-mk-primary">01</span>
            <h3 className="mt-4 font-mk-display text-xl font-bold">Syllabus & lesson notes</h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
              Upload syllabi, track coverage week by week, and draft consistent lesson notes against
              NERDC-aligned topics.
            </p>
          </article>

          <article className="rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft">
            <span className="font-mk-display text-3xl font-bold text-mk-coral">02</span>
            <h3 className="mt-4 font-mk-display text-xl font-bold">Exams & AI grading</h3>
            <p className="mt-2 text-sm leading-relaxed text-mk-muted-fg">
              Shared question bank, hall or online delivery, instant MCQ scoring and rubric-grounded
              essay assistance.
            </p>
          </article>

          <article className="overflow-hidden rounded-3xl border border-mk-border bg-mk-card shadow-mk-soft sm:col-span-2">
            <img
              src="/marketing/parent-student.jpg"
              alt="A parent and student checking a published result on a phone"
              loading="lazy"
              width={1200}
              height={912}
              className="h-52 w-full object-cover sm:h-60"
            />
            <div className="p-7">
              <span className="font-mk-display text-3xl font-bold text-mk-teal">03</span>
              <h3 className="mt-4 font-mk-display text-xl font-bold">Results parents can trust</h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-mk-muted-fg">
                Weighted term scores compute themselves, report cards publish in a click, and every
                one of them carries a code that proves it came from your school.
              </p>
            </div>
          </article>
        </div>
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

      {/* Addons */}
      <section className="border-y border-mk-border bg-mk-secondary/40 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
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
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">Pricing</p>
        <h2 className="mt-5 max-w-xl font-mk-display text-3xl font-bold sm:text-4xl">
          One licence per school. Set up personally.
        </h2>

        <div className="mt-12 space-y-4">
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
              className={`grid gap-6 rounded-3xl p-7 sm:p-9 lg:grid-cols-[0.6fr_0.7fr_1fr_auto] lg:items-center ${
                p.dark ? "bg-mk-ink text-mk-ink-fg" : "border border-mk-border bg-mk-card shadow-mk-soft"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mk-display text-xl font-bold">{p.plan}</span>
                {p.dark && (
                  <span className="rounded-full bg-mk-warm px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-mk-ink">
                    Popular
                  </span>
                )}
              </div>
              <div>
                <p className="font-mk-display text-3xl font-bold">{p.price}</p>
                <p className={`text-xs ${p.dark ? "text-mk-ink-fg/60" : "text-mk-muted-fg"}`}>
                  {p.unit}
                </p>
              </div>
              <p className={`text-sm ${p.dark ? "text-mk-ink-fg/70" : "text-mk-muted-fg"}`}>
                {p.note}
              </p>
              <a
                href="#demo"
                className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold ${
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
          </div>
          <p className="text-xs text-mk-ink-fg/50">
            © {new Date().getFullYear()} Marksheet · Built for Nigerian schools
          </p>
        </div>
      </footer>
    </div>
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
