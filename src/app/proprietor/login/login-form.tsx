"use client";

import { useActionState } from "react";
import { proprietorLoginAction, type ProprietorLoginState } from "./actions";

const initial: ProprietorLoginState = {};

export function ProprietorLoginForm() {
  const [state, formAction, pending] = useActionState(proprietorLoginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
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
        />
      </div>
      {state.error && (
        <p className="text-sm text-error bg-error-container px-3 py-2 rounded-lg">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#002046] text-white font-label-md text-label-md py-2.5 px-4 rounded-lg hover:bg-[#003366] transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Sign in to Proprietor Console"}
      </button>
      <p className="text-xs text-on-surface-variant text-center pt-2">
        Proprietor accounts are created by the platform owner from the Owner Console.
      </p>
    </form>
  );
}
