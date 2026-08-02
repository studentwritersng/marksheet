"use client";

import { useActionState } from "react";
import { submitDemoRequestAction, type DemoRequestResult } from "./actions";

const COUNT_RANGES = [
  "Under 100",
  "100 – 300",
  "300 – 500",
  "500 – 1,000",
  "1,000+",
];

export function DemoRequestForm({ source = "homepage" }: { source?: string }) {
  const [state, formAction, pending] = useActionState(submitDemoRequestAction, {} as DemoRequestResult);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="source" value={source} />
      {/* Honeypot — hidden from humans, filled by bots. Must stay empty. */}
      <div className="sr-only" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
          Your name *
        </label>
        <input
          name="contactName"
          required
          placeholder="e.g. Mrs. Adebayo"
          className="w-full border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div>
        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
          School name *
        </label>
        <input
          name="schoolName"
          required
          placeholder="e.g. Unity Model Secondary School"
          className="w-full border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
            Phone
          </label>
          <input
            name="phone"
            placeholder="e.g. 0803 123 4567"
            className="w-full border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
            Work email *
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="you@school.edu.ng"
            className="w-full border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div>
        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
          Number of students
        </label>
        <select
          name="studentCountRange"
          className="w-full border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          defaultValue=""
        >
          <option value="">Select a range</option>
          {COUNT_RANGES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1.5">
          Message (optional)
        </label>
        <textarea
          name="message"
          rows={3}
          placeholder="Anything specific you'd like us to cover in the demo?"
          className="w-full border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
        />
      </div>

      {state.error && (
        <p className="font-body-sm text-body-sm text-error bg-error-container rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="font-body-sm text-body-sm text-on-secondary-container bg-secondary-container rounded-lg px-3 py-2">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 px-6 rounded-lg hover:bg-primary-container transition-colors disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Book a Demo"}
      </button>
      <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
        No account is created — this is purely a contact request. We&apos;ll reach out personally.
      </p>
    </form>
  );
}
