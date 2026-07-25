"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetStaffPasswordAction, toggleSuspendStaffAction, deleteStaffAction, createStaffLoginAction } from "./actions";

export function StaffActions({
  staffId,
  hasUser,
  isSuspended,
}: {
  staffId: string;
  hasUser: boolean;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);

  const act = async (fn: () => Promise<{ error?: string; success?: string; generatedPassword?: string }>, redirectTo?: string) => {
    setError(null);
    setSuccess(null);
    const res = await fn();
    if (res.error) setError(res.error);
    if (res.success) {
      setSuccess(res.success);
      if (res.generatedPassword) setGeneratedPassword(res.generatedPassword);
      if (redirectTo) setTimeout(() => router.push(redirectTo), 1000);
    }
  };

  const showPasswordReset = hasUser || accountCreated;

  return (
    <div className="space-y-4">
      {/* Create login account (shown when no account exists) */}
      {!showPasswordReset && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="font-label-md text-label-md text-amber-800">No login account</p>
            <p className="font-body-sm text-body-sm text-amber-700">
              This staff member cannot log in yet. Create an account to give them access.
            </p>
          </div>
          <button
            onClick={() => start(async () => {
              const res = await createStaffLoginAction(staffId);
              if (res.error) setError(res.error);
              if (res.success) {
                setSuccess(res.success);
                setAccountCreated(true);
                if (res.generatedPassword) setGeneratedPassword(res.generatedPassword);
              }
            })}
            disabled={pending}
            className="shrink-0 bg-amber-700 text-white font-label-sm text-label-sm py-2 px-3 rounded hover:bg-amber-800 disabled:opacity-60"
          >
            Create Login Account
          </button>
        </div>
      )}

      {/* Generated password display */}
      {generatedPassword && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="font-label-md text-label-md text-green-800 mb-1">Account created — temporary password:</p>
          <code className="font-mono text-sm bg-green-100 px-2 py-1 rounded text-green-900 select-all">
            {generatedPassword}
          </code>
          <p className="mt-1 font-body-sm text-body-sm text-green-700">
            Share this with the staff member. They must change it on first login.
          </p>
        </div>
      )}

      {/* Password reset (shown when account exists) */}
      <div className="flex flex-wrap items-center gap-3">
        {showPasswordReset && (
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-outline-variant rounded p-2 font-body-sm text-body-sm w-44"
            />
            <button
              onClick={() => {
                if (!password) return;
                start(() => act(() => resetStaffPasswordAction(staffId, password)));
              }}
              disabled={pending || !password}
              className="bg-primary text-on-primary font-label-sm text-label-sm py-2 px-3 rounded hover:bg-primary-container disabled:opacity-60"
            >
              Reset Password
            </button>
          </div>
        )}

        <button
          onClick={() => start(() => act(() => toggleSuspendStaffAction(staffId, !isSuspended)))}
          disabled={pending}
          className={`font-label-sm text-label-sm py-2 px-3 rounded border disabled:opacity-60 ${
            isSuspended
              ? "border-green-600 text-green-700 hover:bg-green-50"
              : "border-amber-600 text-amber-700 hover:bg-amber-50"
          }`}
        >
          {isSuspended ? "Reactivate" : "Suspend"}
        </button>

        <button
          onClick={() => {
            if (!confirm("Delete this staff member permanently?")) return;
            start(() => act(() => deleteStaffAction(staffId), "/staff"));
          }}
          disabled={pending}
          className="font-label-sm text-label-sm py-2 px-3 rounded border border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Delete
        </button>
      </div>

      {error && <p className="font-label-sm text-label-sm text-red-600">{error}</p>}
      {success && !generatedPassword && <p className="font-label-sm text-label-sm text-green-600">{success}</p>}
    </div>
  );
}
