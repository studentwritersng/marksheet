"use client";

import { useActionState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Landmark,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { registerReferralAction, type ReferralActionResult } from "./actions";

const init: ReferralActionResult = {};

export function ReferralForm({
  commissionAmount,
  commissionPercent,
}: {
  commissionAmount: number;
  commissionPercent: number;
}) {
  const [state, action, pending] = useActionState(registerReferralAction, init);

  if (state.success && state.referralCode) {
    const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${state.referralCode}`;
    return (
      <div className="rounded-3xl border border-mk-border bg-mk-card p-8 text-mk-card-fg shadow-mk-lift sm:p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
          <Check className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-center font-mk-display text-2xl font-bold">You&apos;re in!</h2>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-mk-muted-fg">
          Your agent account is ready. Log in anytime to track your referrals and commissions.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-2xl bg-mk-muted p-5 text-center">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-mk-muted-fg">
              Your referral code
            </p>
            <p className="mt-2 font-mk-display text-2xl font-bold tracking-widest text-mk-ink">
              {state.referralCode}
            </p>
          </div>

          <div className="rounded-2xl border border-mk-border bg-mk-bg p-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-mk-muted-fg">
              Your referral link
            </p>
            <p className="mt-2 break-all font-mono text-xs leading-relaxed text-mk-muted-fg">
              {referralLink}
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(referralLink)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-ink px-5 py-2.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
            >
              <Copy className="h-4 w-4" />
              Copy link
            </button>
          </div>

          <div className="rounded-2xl bg-mk-secondary p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-mk-primary">
              <ShieldCheck className="h-4 w-4" />
              What happens next
            </p>
            <ol className="mt-3 space-y-2 text-sm text-mk-muted-fg">
              <li>1. Share your code with schools you know.</li>
              <li>
                2. Earn {commissionPercent}% (₦{commissionAmount.toLocaleString()}) per paid
                registration.
              </li>
              <li>3. Track payouts in your agent dashboard.</li>
            </ol>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/referral/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
          >
            Log in to your dashboard
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-mk-border bg-mk-bg px-6 py-3.5 text-sm font-semibold text-mk-muted-fg transition-colors hover:border-mk-primary/40 hover:text-mk-fg"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-3xl border border-mk-border bg-mk-card p-6 text-mk-card-fg shadow-mk-lift sm:p-8"
    >
      <h2 className="font-mk-display text-2xl font-bold">Become a referral agent</h2>
      <p className="mt-1 text-sm text-mk-muted-fg">
        Free to join. Earn ₦{commissionAmount.toLocaleString()} ({commissionPercent}%) on every
        paid school registration.
      </p>

      <div className="mt-8 space-y-7">
        <SectionTitle icon={<UserRound className="h-4 w-4" />} title="Your details" />
        <div className="space-y-4">
          <Field label="Full name" name="fullName" required placeholder="John Doe" />
          <Field label="Address" name="address" required placeholder="123 Street, Lagos" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth" name="dateOfBirth" type="date" required placeholder="" />
            <Field label="Phone number" name="phoneNumber" required placeholder="08012345678" />
          </div>
          <Field label="Email" name="email" type="email" required placeholder="john@example.com" />
          <Field
            label="WhatsApp number"
            name="whatsappNumber"
            required
            placeholder="08012345678"
          />
        </div>

        <div className="h-px rule-line" />

        <SectionTitle icon={<Landmark className="h-4 w-4" />} title="Bank details" />
        <div className="space-y-4">
          <Field label="Bank name" name="bankName" required placeholder="e.g. GTBank, First Bank" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Account number"
              name="bankAccountNumber"
              required
              placeholder="1234567890"
            />
            <Field label="Account name" name="bankAccountName" required placeholder="John Doe" />
          </div>
        </div>

        <div className="h-px rule-line" />

        <SectionTitle icon={<Wallet className="h-4 w-4" />} title="Account password" />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Password"
              name="password"
              type="password"
              required
              placeholder="Min 6 characters"
            />
            <Field
              label="Confirm password"
              name="confirmPassword"
              type="password"
              required
              placeholder="Re-enter password"
            />
          </div>
        </div>

        {state.error && <ErrorBanner message={state.error} />}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-warm px-6 py-3.5 text-sm font-bold text-mk-ink transition-colors disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create my agent account"}
          <ArrowUpRight className="h-4 w-4" />
        </button>
        <p className="text-center text-xs text-mk-muted-fg">
          Already registered?{" "}
          <Link href="/referral/login" className="font-semibold text-mk-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </form>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-mk-primary">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
        {icon}
      </span>
      {title}
    </h3>
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
        className="mt-1.5 w-full rounded-xl border border-mk-input bg-mk-bg px-4 py-3 text-sm font-normal outline-none transition-colors focus:border-mk-primary"
      />
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}
