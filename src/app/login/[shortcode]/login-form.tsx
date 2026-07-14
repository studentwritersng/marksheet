"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/lib/auth/actions";

const initial: LoginState = {};

export function SchoolLoginForm({
  schoolId,
  schoolName,
}: {
  schoolId: string;
  schoolName: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const [mode, setMode] = useState<"staff" | "student" | "parent">("staff");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="schoolId" value={schoolId} />
      <input type="hidden" name="loginMode" value={mode} />

      {/* Tab Toggle */}
      <div className="flex rounded-lg border border-outline-variant overflow-hidden text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("staff")}
          className={`flex-1 py-2.5 text-center transition-colors ${
            mode === "staff"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          Staff Login
        </button>
        <button
          type="button"
          onClick={() => setMode("student")}
          className={`flex-1 py-2.5 text-center transition-colors ${
            mode === "student"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          Student Login
        </button>
        <button
          type="button"
          onClick={() => setMode("parent")}
          className={`flex-1 py-2.5 text-center transition-colors ${
            mode === "parent"
              ? "bg-primary text-on-primary"
              : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          Parent Login
        </button>
      </div>

      {mode === "staff" ? (
        <>
          <div>
            <label htmlFor="email" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
              placeholder="you@school.edu.ng"
            />
          </div>
          <div>
            <label htmlFor="password" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
              placeholder="Enter your password"
            />
          </div>
        </>
      ) : mode === "student" ? (
        <>
          <div>
            <label htmlFor="admissionNumber" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Admission Number
            </label>
            <input
              id="admissionNumber"
              name="admissionNumber"
              type="text"
              autoComplete="off"
              required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors uppercase"
              placeholder="e.g. TDC00123"
            />
          </div>
          <div>
            <label htmlFor="dateOfBirth" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Date of Birth
            </label>
            <input
              id="dateOfBirth"
              name="dateOfBirth"
              type="date"
              required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
        </>
      ) : (
        <>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Log in to view your ward&apos;s academic progress. Use the email and password provided by the school.
          </p>
          <div>
            <label htmlFor="parentEmail" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Email
            </label>
            <input
              id="parentEmail"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
              placeholder="you@email.com"
            />
          </div>
          <div>
            <label htmlFor="parentPassword" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
              Password
            </label>
            <input
              id="parentPassword"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
              placeholder="Enter your password"
            />
          </div>
        </>
      )}

      {state.error && (
        <p className="rounded bg-error-container px-3 py-2 font-body-sm text-body-sm text-on-error-container">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in…" : `Sign in to ${schoolName}`}
      </button>
    </form>
  );
}
