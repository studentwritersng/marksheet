import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ArrowUpRight, ChevronRight, Quote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ReferralForm } from "./referral-form";

export const metadata: Metadata = {
  title: "Referral program | Marksheet",
  description:
    "Earn a commission on every school you refer to Marksheet. Share your code, track referrals and payouts from your own dashboard. Free to join.",
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
    title: "Join for free",
    body: "Create your agent account in under two minutes. You get a unique referral code and link the moment you sign up.",
  },
  {
    n: "02",
    title: "Share your code",
    body: "Send your link to school owners you know, or share it in groups and communities where it belongs.",
  },
  {
    n: "03",
    title: "Earn per registration",
    body: "Each time a school registers through your code and completes their registration fee, a commission is credited to your account.",
  },
];

const benefits = [
  {
    title: "Your own dashboard",
    body: "Track every registration, pending and paid commission, and your payout history in one place.",
  },
  {
    title: "No quotas, no cost",
    body: "Joining is free and there is no minimum number of schools to refer. Earn whenever a referral converts.",
  },
  {
    title: "Clear commission tracking",
    body: "Every school you refer is linked to your code, so the commission you earn is easy to verify.",
  },
];

export default async function ReferralPage() {
  const setting = await prisma.referralCommissionSetting.findFirst();

  const registrationFee = setting ? Number(setting.registrationFee) : 10000;
  const commissionPercent = setting ? Number(setting.commissionPercent) : 10;
  const commissionAmount = Math.round((registrationFee * commissionPercent) / 100);

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
              href="/referral/login"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold text-mk-muted-fg transition-colors hover:text-mk-fg"
            >
              Agent login
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="#form"
              className="inline-flex items-center gap-1.5 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-semibold text-mk-ink-fg transition-colors hover:bg-mk-primary"
            >
              Join now
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <a
            href="#form"
            className="inline-flex items-center gap-1.5 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-semibold text-mk-ink-fg lg:hidden"
          >
            Join now
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-mk-hero text-mk-ink-fg">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-16 sm:pt-20 lg:pb-20 lg:pt-28">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-amber">
            Referral program
          </p>
          <h1 className="mt-6 max-w-3xl font-mk-display text-[2.4rem] font-bold leading-[1.02] sm:text-5xl lg:text-6xl">
            Refer a school.
            <br />
            Earn <span className="text-mk-amber">on every registration.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-mk-ink-fg/75 sm:text-lg">
            Know a school that would run its term calmer with Marksheet? Share your unique code
            and earn a commission each time a school registers and pays through you.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#form"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-mk-warm px-7 py-3.5 text-sm font-bold text-mk-ink"
            >
              Join the program
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="/referral/login"
              className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-mk-ink-fg/90 hover:text-mk-ink-fg"
            >
              I already have an account
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl glass sm:grid-cols-4">
            {[
              [`₦${commissionAmount.toLocaleString()}`, "per paid registration"],
              [`${commissionPercent}%`, "commission rate"],
              ["0", "joining cost"],
              ["0", "quota to hit"],
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
            <div id="how-it-works" className="scroll-mt-24">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
                How it works
              </p>
              <h2 className="mt-5 font-mk-display text-3xl font-bold leading-tight sm:text-4xl">
                Share a code,
                <br />
                earn a commission.
              </h2>

              <ol className="mt-8 space-y-4">
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

            <div className="mt-12 border-t border-mk-border pt-8">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
                Why join
              </p>
              <ul className="mt-6 space-y-6">
                {benefits.map((b) => (
                  <li key={b.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
                      <BadgeCheck className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-mk-display text-lg font-bold">{b.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-mk-muted-fg">{b.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <figure className="mt-12 rounded-3xl border border-mk-border bg-mk-card p-7 shadow-mk-soft">
              <Quote className="h-8 w-8 text-mk-coral" />
              <blockquote className="mt-4 font-mk-display text-lg font-bold leading-snug">
                &quot;I shared my link with two principals at a school meeting. The commission on
                their registrations covered my data for the month.&quot;
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-bold">Chinedu O.</span>
                <span className="block text-mk-muted-fg">Marksheet referral agent, Lagos</span>
              </figcaption>
            </figure>
          </div>

          {/* Form column */}
          <div className="min-w-0">
            <ReferralForm
              commissionAmount={commissionAmount}
              commissionPercent={commissionPercent}
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
          <div className="flex flex-wrap items-center gap-6 text-xs text-mk-ink-fg/50">
            <Link href="/referral/login" className="inline-flex items-center gap-1.5 transition-colors hover:text-mk-ink-fg">
              <BadgeCheck className="h-3.5 w-3.5" />
              Agent login
            </Link>
            <Link href="/login" className="transition-colors hover:text-mk-ink-fg">
              School login
            </Link>
            <Link href="/verify" className="transition-colors hover:text-mk-ink-fg">
              Verify a result
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
