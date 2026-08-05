"use client";

import { useActionState } from "react";
import { ArrowUpRight } from "lucide-react";
import { referralLoginAction, type ReferralLoginResult } from "./actions";

const init: ReferralLoginResult = {};

export function ReferralLoginForm() {
  const [state, action, pending] = useActionState(referralLoginAction, init);

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" name="email" type="email" placeholder="your@email.com" required />
      <Field label="Password" name="password" type="password" placeholder="Your password" required />

      {state.error && <ErrorBanner message={state.error} />}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </form>
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
