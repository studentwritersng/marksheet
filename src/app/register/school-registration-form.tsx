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
  ShieldCheck,
} from "lucide-react";
import { registerSchoolAction, type SchoolRegistrationActionResult } from "./actions";
import Link from "next/link";

type PaymentMethod = {
  id: string;
  type: string;
  label: string;
  details: { bankName?: string; accountNumber?: string; accountName?: string; instructions?: string } | null;
};

const init: SchoolRegistrationActionResult = {};

export function SchoolRegistrationForm({
  defaultReferralCode,
  paymentMethods,
  registrationFee,
}: {
  defaultReferralCode?: string;
  paymentMethods: PaymentMethod[];
  registrationFee: number;
}) {
  const [state, action, pending] = useActionState(registerSchoolAction, init);
  const [step, setStep] = useState<"details" | "payment">("details");
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  if (state.success) {
    return (
      <div className="rounded-3xl border border-mk-border bg-mk-card p-8 text-mk-card-fg shadow-mk-lift sm:p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
          <Check className="h-8 w-8" />
        </div>
        <h2 className="mt-6 text-center font-mk-display text-2xl font-bold">Application received</h2>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-mk-muted-fg">
          Your school registration is safely with our team. We&apos;ll review it within one working
          day and reach out on the contact details you provided.
        </p>
        <div className="mt-8 rounded-2xl bg-mk-muted p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-mk-primary">
            <ShieldCheck className="h-4 w-4" />
            What happens next
          </p>
          <ol className="mt-3 space-y-2 text-sm text-mk-muted-fg">
            <li>1. We review your application and payment record.</li>
            <li>2. We book your onboarding demo.</li>
            <li>3. We activate your licence personally.</li>
          </ol>
        </div>
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

  const selectedMethodData = paymentMethods.find((m) => m.id === selectedMethod);

  return (
    <form
      action={action}
      className="rounded-3xl border border-mk-border bg-mk-card p-6 text-mk-card-fg shadow-mk-lift sm:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-mk-display text-2xl font-bold">Apply to register</h2>
          <p className="mt-1 text-sm text-mk-muted-fg">Takes about two minutes. No payment required to apply.</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-mk-secondary px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest text-mk-secondary-fg sm:block">
          {step === "details" ? "Step 1 of 2" : "Step 2 of 2"}
        </span>
      </div>

      {/* Progress */}
      <div className="mt-6 flex items-center gap-3">
        <StepDot active={step === "details"} done={step === "payment"} label="School details" />
        <div className="h-px flex-1 bg-mk-border" />
        <StepDot active={step === "payment"} done={false} label="Registration fee" />
      </div>

      {step === "details" && (
        <div className="mt-8 space-y-7">
          <SectionTitle icon={<Building2 className="h-4 w-4" />} title="School information" />
          <div className="space-y-4">
            <Field label="School name" name="schoolName" required placeholder="e.g. Unity Model Secondary School" />
            <Field label="School address" name="schoolAddress" placeholder="123 Education Road, Lagos" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="School phone" name="schoolPhone" placeholder="0801 234 5678" />
              <Field label="School email" name="schoolEmail" type="email" placeholder="info@school.edu.ng" />
            </div>
          </div>

          <div className="h-px rule-line" />

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

          {state.error && step === "details" && <ErrorBanner message={state.error} />}

          <button
            type="button"
            onClick={() => setStep("payment")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
          >
            Continue to registration fee
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === "payment" && (
        <div className="mt-8 space-y-6">
          {/* Registration fee */}
          <div className="flex items-center justify-between rounded-2xl bg-mk-muted p-5">
            <div>
              <p className="text-sm text-mk-muted-fg">Registration fee</p>
              <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-mk-muted-fg">
                Not charged now. Used to reconcile your payment once you&apos;re approved.
              </p>
            </div>
            <p className="font-mk-display text-3xl font-bold">₦{registrationFee.toLocaleString()}</p>
          </div>

          {/* Payment method */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-mk-primary">
              Payment method
            </h3>
            <div className="mt-3 space-y-2">
              {paymentMethods.map((method) => (
                <label
                  key={method.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ${
                    selectedMethod === method.id
                      ? "border-mk-primary bg-mk-secondary"
                      : "border-mk-border hover:border-mk-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethodId"
                    value={method.id}
                    checked={selectedMethod === method.id}
                    onChange={() => setSelectedMethod(method.id)}
                    className="h-4 w-4 accent-mk-primary"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{method.label}</p>
                    <p className="text-xs capitalize text-mk-muted-fg">{method.type.replace("_", " ")}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Payment details */}
          {selectedMethodData && (
            <div className="space-y-3 rounded-2xl border border-mk-border bg-mk-muted p-5">
              {selectedMethodData.type === "bank_transfer" && selectedMethodData.details && (
                <>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-mk-muted-fg">
                    Transfer to this account
                  </p>
                  <InfoLine label="Bank" value={selectedMethodData.details.bankName || ""} />
                  <InfoLine label="Account number" value={selectedMethodData.details.accountNumber || ""} />
                  <InfoLine label="Account name" value={selectedMethodData.details.accountName || ""} />
                  {selectedMethodData.details.instructions && (
                    <p className="text-xs italic text-mk-muted-fg">
                      {selectedMethodData.details.instructions}
                    </p>
                  )}
                </>
              )}
              {selectedMethodData.type === "online" && (
                <p className="text-sm text-mk-muted-fg">
                  You&apos;ll be guided to complete payment after your application is approved.
                </p>
              )}
              {selectedMethodData.type === "cash" && (
                <p className="text-sm text-mk-muted-fg">
                  Contact the platform team to arrange cash payment.
                </p>
              )}
            </div>
          )}

          {/* Payment reference */}
          <Field
            label="Payment reference / teller number"
            name="paymentReference"
            placeholder="e.g. GTB123456789"
            hint="Enter the reference from your receipt once you&apos;ve paid."
          />

          <input type="hidden" name="registrationFee" value={registrationFee} />

          {state.error && step === "payment" && <ErrorBanner message={state.error} />}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("details")}
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
            Applying creates no payment obligation. Our team confirms everything with you first.
          </p>
        </div>
      )}
    </form>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${active || done ? "text-mk-primary" : "text-mk-muted-fg"}`}>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
          active ? "bg-mk-primary" : done ? "bg-mk-teal" : "bg-mk-border text-mk-muted-fg"
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-red-100 px-4 py-2.5 text-sm font-medium text-red-700">{message}</p>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-sm text-mk-muted-fg">{label}</span>
      <span className="truncate text-right text-sm font-bold">{value}</span>
    </div>
  );
}