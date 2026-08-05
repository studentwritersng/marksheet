import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ReferralLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Agent login | Marksheet",
  description:
    "Log in to your Marksheet referral agent dashboard to track registrations, commissions and payouts.",
};

export default async function ReferralLoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "referral") redirect("/referral/dashboard");

  return (
    <main className="marketing-root min-h-screen bg-mk-bg text-mk-fg">
      <header className="border-b border-mk-border bg-mk-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-1.5">
            <img src="/marksheet_logo.png" alt="Marksheet" className="h-8 w-auto" />
          </Link>
          <Link
            href="/referral"
            className="inline-flex items-center gap-1.5 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-semibold text-mk-ink-fg transition-colors hover:bg-mk-primary"
          >
            Join the program
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-mk-primary">
            Agent login
          </p>
          <h1 className="mt-5 font-mk-display text-4xl font-bold leading-tight sm:text-5xl">
            Back to your
            <br />
            <span className="text-mk-primary">referral dashboard.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mk-muted-fg">
            Track the schools you&apos;ve referred, watch commissions as they land and review
            your payout history, all in one place.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            {[
              "Live count of your referred schools",
              "Commission history with status for every payout",
              "Your referral code and link, always at hand",
            ].map((t) => (
              <p key={t} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mk-teal" />
                <span className="min-w-0 text-mk-muted-fg">{t}</span>
              </p>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="rounded-3xl border border-mk-border bg-mk-card p-6 text-mk-card-fg shadow-mk-lift sm:p-8">
            <h2 className="font-mk-display text-xl font-bold">Log in</h2>
            <p className="mt-1 text-sm text-mk-muted-fg">
              Use the email and password you registered with.
            </p>
            <div className="mt-6">
              <ReferralLoginForm />
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-mk-muted-fg">
            Not registered?{" "}
            <Link href="/referral" className="font-semibold text-mk-primary hover:underline">
              Create an agent account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
