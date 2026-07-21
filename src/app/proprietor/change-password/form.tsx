"use client";

import { useActionState } from "react";
import { proprietorChangePasswordAction, type PropChangePasswordState } from "./actions";

const init: PropChangePasswordState = {};

export function ProprietorChangePasswordForm() {
  const [state, action, pending] = useActionState(proprietorChangePasswordAction, init);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="currentPassword" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
          New password (min 6 characters)
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={6}
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#002046] text-white font-label-md text-label-md py-2.5 px-4 rounded-lg hover:bg-[#003366] transition-colors disabled:opacity-60"
      >
        {pending ? "Saving..." : "Change Password"}
      </button>
    </form>
  );
}
