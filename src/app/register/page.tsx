import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ArrowUpRight, ChevronRight, Quote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SchoolRegistrationForm } from "./school-registration-form";

export const metadata: Metadata = {
  title: "Register your school — Marksheet",
  description:
    "Apply to bring your school's term — syllabus, lesson notes, exams and verified report cards — into one place. Sales-led onboarding, no online checkout.",
};

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

const steps = [
  {
    n: "01",
    title: "We review your application",
    body: "Our team checks your registration within one working day and reaches out on the contact details you provide.",
  },
  {
    n: "02",
    title: "We book your onboarding demo",
    body: "A live 25-minute walkthrough — we set up your session, run a mock exam and publish a verified report card.",
  },
  {
    n: "03",
    title: "We activate your licence personally",
    body: "No online checkout and no surprise renewals. We arrange your licence with your school and turn on the addons you need.",
  },
];

const whatYouGet = [
  {
    title: "Syllabus & lesson notes",
    body: "Upload syllabi, track coverage week by week and draft notes against NERDC-aligned topics.",
  },
  {
    title: "Exams & AI-assisted grading",
    body: "Shared question bank, LAN or online delivery, instant MCQ scoring and rubric-grounded essay help.",
  },
  {
    title: "Report cards parents trust",
    body: "Weighted scores compute themselves and every published card carries a public verification code.",
  },
  {
    title: "One home for the term",
    body: "Three terms, one source of truth, role-scoped for proprietors, teachers, bursars and guardians.",
  },
];

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const referralCode = params.ref || undefined;

  const [paymentMethods, setting] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.referralCommissionSetting.findFirst(),
  ]);

  const registrationFee = setting ? Number(setting.registrationFee) : 10000;

  const methods = paymentMethods.map((m) => ({
    id: m.id,
    type: m.type,
    label: m.label,
    details: m.details as { bankName?: string; accountNumber?: string; accountName?: string; instructions?: string } | null,
  }));

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
          <Link href="/" className="flex min-w-0 items-center gap-1.5">
            <img src="/marksheet_logo.png" alt="Marksheet" className="h-8 w-auto" />
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/verify"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-mk-muted-fg transition-colors hover:text-mk-fg"
            >
              Verify a result
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="#form"
              className="inline-flex items-center gap-1.5 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-semibold text-mk-ink-fg transition-colors hover:bg-mk-primary"
            >
              Apply now
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <a
            href="#form"
            className="inline-flex items-center gap-1.5 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-semibold text-mk-ink-fg lg:hidden"
          >
            Apply now
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-mk-hero text-mk-ink-fg">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-16 sm:pt-20 lg:pb-20 lg:pt-28">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">
            School registration
          </p>
          <h1 className="mt-6 max-w-3xl font-mk-display text-[2.4rem] font-bold leading-[1.02] sm:text-5xl lg:text-6xl">
            Bring the whole term into
            <br />
            one <span className="text-mk-amber">verified</span> place.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-mk-ink-fg/75 sm:text-lg">
            Tell us about your school and we&apos;ll personally walk you through setup, exams and
            result publication — before you pay a naira.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#form"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-mk-warm px-7 py-3.5 text-sm font-bold text-mk-ink"
            >
              Start your application
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="#what-you-get"
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-mk-ink-fg/90 hover:text-mk-ink-fg"
            >
              What you get
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl glass sm:grid-cols-4">
            {[
              ["1 day", "review turn-around"],
              ["25 min", "onboarding demo"],
              ["0", "online checkout"],
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

      {/* Content + form */}
      <section id="form" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* Editorial column */}
          <div className="min-w-0">
            <div id="what-you-get" className="scroll-mt-24">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
                What you get
              </p>
              <h2 className="mt-5 font-mk-display text-3xl font-bold leading-tight sm:text-4xl">
                A full term, run once,
                <br />
                right the first time.
              </h2>

              <ul className="mt-8 space-y-6">
                {whatYouGet.map((w) => (
                  <li key={w.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
                      <BadgeCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-mk-display text-lg font-bold">{w.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-mk-muted-fg">{w.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-12 border-t border-mk-border pt-8">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
                What happens next
              </p>
              <ol className="mt-6 space-y-4">
                {steps.map((s) => (
                  <li key={s.n} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                    <span className="font-mk-display text-2xl font-bold text-mk-amber">{s.n}</span>
                    <div>
                      <h3 className="font-mk-display text-base font-bold">{s.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-mk-muted-fg">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <figure className="mt-12 rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft">
              <Quote className="h-8 w-8 text-mk-coral" />
              <blockquote className="mt-4 font-mk-display text-lg font-bold leading-snug">
                &quot;The demo was with our real class list — we published first term results four
                days after the last paper.&quot;
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-bold">Mrs. Ngozi Eze</span>
                <span className="block text-mk-muted-fg">Principal, Bright Future College, Enugu</span>
              </figcaption>
            </figure>
          </div>

          {/* Form column */}
          <div className="min-w-0">
            <SchoolRegistrationForm
              defaultReferralCode={referralCode}
              paymentMethods={methods}
              registrationFee={registrationFee}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-mk-ink pb-10 text-mk-ink-fg">
        <div className="mx-auto grid max-w-6xl gap-6 border-t border-white/10 px-5 pt-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-1.5">
            <img src="/marksheet_logo.png" alt="Marksheet" className="h-6 w-auto brightness-0 invert" />
          </div>
          <div className="flex items-center gap-6 text-xs text-mk-ink-fg/50">
            <Link href="/login" className="inline-flex items-center gap-1.5 transition-colors hover:text-mk-ink-fg">
              <BadgeCheck className="h-3.5 w-3.5" />
              School login
            </Link>
            <Link href="/verify" className="transition-colors hover:text-mk-ink-fg">
              Verify a result
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