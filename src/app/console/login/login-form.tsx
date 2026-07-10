"use client";

import { useActionState } from "react";
import { consoleLoginAction, type ConsoleLoginState } from "./actions";

const initial: ConsoleLoginState = {};

export function ConsoleLoginForm() {
  const [state, formAction, pending] = useActionState(consoleLoginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="console-email" className="font-label-sm text-label-sm text-white/60 block mb-1">
          Email
        </label>
        <input
          id="console-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full border border-white/10 rounded-lg p-3 font-body-md text-body-md text-white bg-white/5 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-colors placeholder:text-white/20"
          placeholder="owner@yourplatform.com"
        />
      </div>
      <div>
        <label htmlFor="console-password" className="font-label-sm text-label-sm text-white/60 block mb-1">
          Password
        </label>
        <input
          id="console-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full border border-white/10 rounded-lg p-3 font-body-md text-body-md text-white bg-white/5 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-colors placeholder:text-white/20"
          placeholder="Enter your password"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-900/50 border border-red-500/30 px-3 py-2 font-body-sm text-body-sm text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gradient-to-r from-[#002046] to-[#1e3a5f] text-white font-label-md text-label-md py-2.5 px-4 rounded-lg hover:from-[#003366] hover:to-[#2d4a7a] transition-all disabled:opacity-60 shadow-lg"
      >
        {pending ? "Signing in…" : "Sign in to Console"}
      </button>
    </form>
  );
}
