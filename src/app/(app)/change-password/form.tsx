"use client";

import { useActionState } from "react";
import { changePasswordAction } from "./actions";

export function ChangePasswordForm({ forceChange = false }: { forceChange?: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, {});

  return (
    <form action={action} className="space-y-4">
      {!forceChange && (
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Current Password</label>
          <input
            name="currentPassword"
            type="password"
            required
            className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
          />
        </div>
      )}
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">New Password</label>
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Confirm New Password</label>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        />
      </div>

      {state.error && (
        <p className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm border border-red-200">{state.error}</p>
      )}
      {state.success && (
        <p className="bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm border border-green-200">{state.success}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-primary text-white font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container disabled:opacity-60 transition-colors"
      >
        {pending ? "Changing…" : "Change Password & Continue"}
      </button>
    </form>
  );
}
