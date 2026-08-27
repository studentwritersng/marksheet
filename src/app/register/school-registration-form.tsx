"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  UserRound,
  TicketPlus,
  ChevronLeft,
  PhoneCall,
  Wallet,
  FileText,
  CreditCard,
} from "lucide-react";
import { registerSchoolAction, type SchoolRegistrationActionResult } from "./actions";
import Link from "next/link";

const init: SchoolRegistrationActionResult = {};

const STUDENT_BANDS = ["50-100", "101-200", "201-300", "300+"];
const BRANCH_BANDS = ["Single branch", "2 branches", "3 branches", "4 branches", "5+ branches"];
const TEACHER_BANDS = ["5-10", "11-15", "16-20", "21+"];

type PaymentMethodOption = {
  id: string;
  type: string;
  label: string;
  details: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    instructions?: string;
  } | null;
};

export function SchoolRegistrationForm({
  defaultReferralCode,
  paymentMethods = [],
  registrationFee = 250000,
}: {
  defaultReferralCode?: string;
  paymentMethods?: PaymentMethodOption[];
  registrationFee?: number;
}) {
  const [state, action, pending] = useActionState(registerSchoolAction, init);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payChoice, setPayChoice] = useState<"choice" | "now" | "later">("choice");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const amount = state.invoiceAmount ?? registrationFee;

  const handlePaystack = async () => {
    setPayError(null);
    setPayLoading(true);
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.principalEmail,
          amount,
          invoiceId: state.invoiceId,
          invoiceNumber: state.invoiceNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.authorizationUrl) {
        setPayError(data.error || "Could not start Paystack payment.");
        setPayLoading(false);
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch {
      setPayError("Network error starting payment.");
      setPayLoading(false);
    }
  };

  if (state.success) {
    return (
      <div className="rounded-3xl border border-mk-border bg-mk-card p-6 text-mk-card-fg shadow-mk-lift sm:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
          <Check className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-center font-mk-display text-2xl font-bold">Application received</h2>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-mk-muted-fg">
          Thank you for applying. Our team will call you within 24 hours on the contact details you
          provided to take the next steps.
        </p>

        {payChoice === "choice" && (
          <div className="mt-8 space-y-3">
            <p className="text-center text-sm font-semibold text-mk-fg">How would you like to pay?</p>
            <button
              type="button"
              onClick={() => setPayChoice("now")}
              className="flex w-full items-center gap-4 rounded-2xl border border-mk-input bg-mk-bg p-4 text-left transition-colors hover:border-mk-primary"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
                <Wallet className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold">Pay now</span>
                <span className="block text-xs text-mk-muted-fg">Bank transfer or Paystack (card / transfer)</span>
              </span>
              <ArrowUpRight className="ml-auto h-5 w-5 text-mk-muted-fg" />
            </button>
            <button
              type="button"
              onClick={() => setPayChoice("later")}
              className="flex w-full items-center gap-4 rounded-2xl border border-mk-input bg-mk-bg p-4 text-left transition-colors hover:border-mk-primary"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
                <FileText className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold">Pay later</span>
                <span className="block text-xs text-mk-muted-fg">We&apos;ll generate an invoice with our bank details</span>
              </span>
              <ArrowUpRight className="ml-auto h-5 w-5 text-mk-muted-fg" />
            </button>
          </div>
        )}

        {payChoice === "now" && (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => setPayChoice("choice")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-mk-muted-fg hover:text-mk-fg"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <p className="text-sm font-semibold">Pay {formatNaira(amount)} by bank transfer</p>
            <div className="space-y-3">
              {paymentMethods.map((m) => (
                <div key={m.id} className="rounded-2xl border border-mk-input bg-mk-bg p-4">
                  <p className="font-bold">{m.label}</p>
                  {m.details?.bankName && (
                    <p className="mt-1 text-sm text-mk-muted-fg">
                      {m.details.bankName} — {m.details.accountNumber} ({m.details.accountName})
                    </p>
                  )}
                  {m.details?.instructions && (
                    <p className="mt-1 text-xs text-mk-muted-fg">{m.details.instructions}</p>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePaystack}
              disabled={payLoading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-mk-warm px-6 py-3.5 text-sm font-bold text-mk-ink transition-colors disabled:opacity-60"
            >
              <CreditCard className="h-4 w-4" />
              {payLoading ? "Redirecting…" : "Pay with Paystack"}
            </button>
            {payError && <p className="text-center text-xs text-red-600">{payError}</p>}
            <p className="text-center text-xs text-mk-muted-fg">
              You&apos;ll be redirected to Paystack to pay by card or transfer. After paying, our team
              will call you within 24 hours.
            </p>
          </div>
        )}

        {payChoice === "later" && (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => setPayChoice("choice")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-mk-muted-fg hover:text-mk-fg"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="rounded-2xl border border-dashed border-mk-primary/40 bg-mk-muted p-5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-bold text-mk-primary">
                  <FileText className="h-4 w-4" /> Invoice
                </p>
                <span className="rounded-full bg-mk-secondary px-3 py-1 text-xs font-bold text-mk-secondary-fg">
                  {state.invoiceNumber}
                </span>
              </div>
              <p className="mt-3 font-mk-display text-2xl font-bold">{formatNaira(amount)}</p>
              <div className="mt-4 space-y-2">
                {paymentMethods.map((m) => (
                  <div key={m.id} className="text-sm text-mk-muted-fg">
                    <p className="font-semibold text-mk-fg">{m.label}</p>
                    {m.details?.bankName && (
                      <p>
                        {m.details.bankName}: {m.details.accountNumber} — {m.details.accountName}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-mk-muted-fg">
                Make payment to any of the accounts above and quote invoice {state.invoiceNumber}.
                Our team will confirm within 24 hours.
              </p>
            </div>
          </div>
        )}

        <Link
          href="/"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
        >
          Back to home
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-3xl border border-mk-border bg-mk-card p-6 text-mk-card-fg shadow-mk-lift sm:p-8"
    >
      {/* Honeypot — hidden from real users; bots that fill it get rejected. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-mk-display text-2xl font-bold">Apply to register</h2>
          <p className="mt-1 text-sm text-mk-muted-fg">Takes about two minutes. No payment required to apply.</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-mk-secondary px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-mk-secondary-fg sm:block">
          Step {step} of 3
        </span>
      </div>

      {/* Progress */}
      <div className="mt-6 flex items-center gap-3">
        <StepDot active={step === 1} done={step > 1} label="School details" />
        <div className="h-px flex-1 bg-mk-border" />
        <StepDot active={step === 2} done={step > 2} label="School profile" />
        <div className="h-px flex-1 bg-mk-border" />
        <StepDot active={step === 3} done={false} label="Principal" />
      </div>

      {/* Step 1 — School details (always mounted; hidden when inactive so values submit) */}
      <div className={step === 1 ? "mt-8 space-y-7" : "hidden"}>
        <SectionTitle icon={<Building2 className="h-4 w-4" />} title="School information" />
        <div className="space-y-4">
          <Field label="School name" name="schoolName" required placeholder="e.g. Unity Model Secondary School" />
          <Field label="School address" name="schoolAddress" placeholder="123 Education Road, Lagos" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="School phone" name="schoolPhone" placeholder="0801 234 5678" />
            <Field label="School email" name="schoolEmail" type="email" placeholder="info@school.edu.ng" />
          </div>
        </div>

        {state.error && step === 1 && <ErrorBanner message={state.error} />}

        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
        >
          Continue to school profile
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* Step 2 — School profile */}
      <div className={step === 2 ? "mt-8 space-y-7" : "hidden"}>
        <SectionTitle icon={<Building2 className="h-4 w-4" />} title="School profile" />
        <BandGroup name="studentBand" label="Number of students" options={STUDENT_BANDS} required />
        <BandGroup name="branchBand" label="Number of branches" options={BRANCH_BANDS} required />
        <BandGroup name="teacherBand" label="Number of teachers" options={TEACHER_BANDS} required />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-mk-border bg-mk-bg px-5 py-3.5 text-sm font-semibold text-mk-muted-fg transition-colors hover:border-mk-primary/40 hover:text-mk-fg"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
          >
            Continue to principal details
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Step 3 — Principal / owner */}
      <div className={step === 3 ? "mt-8 space-y-7" : "hidden"}>
        <SectionTitle icon={<UserRound className="h-4 w-4" />} title="Principal / owner" />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" name="principalFirstName" required placeholder="John" />
            <Field label="Last name" name="principalLastName" required placeholder="Doe" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="principalEmail" type="email" required placeholder="john@school.edu.ng" />
            <Field label="Phone" name="principalPhone" placeholder="0801 234 5678" />
          </div>
        </div>

        <div className="h-px rule-line" />

        <SectionTitle icon={<TicketPlus className="h-4 w-4" />} title="Referral code" />
        <Field
          label="Referral code (optional)"
          name="referralCode"
          defaultValue={defaultReferralCode || ""}
          placeholder="Enter referral code"
          hint={
            defaultReferralCode
              ? "Referral code auto-filled from your link."
              : "Someone referred you? Enter their code and they earn a commission."
          }
          hintTone={defaultReferralCode ? "good" : "muted"}
        />

        {state.error && step === 3 && <ErrorBanner message={state.error} />}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-mk-border bg-mk-bg px-5 py-3.5 text-sm font-semibold text-mk-muted-fg transition-colors hover:border-mk-primary/40 hover:text-mk-fg"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-mk-warm px-6 py-3.5 text-sm font-bold text-mk-ink transition-colors disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit application"}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-center text-xs text-mk-muted-fg">
          Applying creates no payment obligation. Choose how to pay on the next screen.
        </p>
      </div>
    </form>
  );
}

function formatNaira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${active || done ? "text-mk-primary" : "text-mk-muted-fg"}`}>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
          active ? "bg-mk-primary text-white" : done ? "bg-mk-teal text-white" : "bg-mk-border text-mk-muted-fg"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <span className={active ? "font-bold" : ""}>{label}</span>
    </div>
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
  defaultValue,
  hint,
  hintTone = "muted",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  hintTone?: "muted" | "good";
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-mk-input bg-mk-bg px-4 py-3 text-sm font-normal outline-none transition-colors focus:border-mk-primary"
      />
      {hint && (
        <p className={`mt-1 text-xs ${hintTone === "good" ? "text-mk-primary" : "text-mk-muted-fg"}`}>
          {hint}
        </p>
      )}
    </label>
  );
}

function BandGroup({
  name,
  label,
  options,
  required = false,
}: {
  name: string;
  label: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 font-label-md text-label-md text-on-surface">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((opt) => (
          <label key={opt} className="cursor-pointer">
            <input type="radio" name={name} value={opt} required={required} className="peer sr-only" />
            <span className="block rounded-xl border border-mk-input bg-mk-bg px-3 py-3 text-center text-sm font-semibold text-mk-muted-fg transition-colors peer-checked:border-mk-primary peer-checked:bg-mk-secondary peer-checked:text-mk-primary">
              {opt}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-medium text-red-700">{message}</p>
  );
}
