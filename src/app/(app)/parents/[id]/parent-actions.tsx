"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resetParentPasswordAction,
  toggleSuspendParentAction,
  deleteParentAction,
} from "./actions";

export function ParentActions({
  guardianId,
  hasUser,
  isSuspended,
}: {
  guardianId: string;
  hasUser: boolean;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const act = async (fn: () => Promise<{ error?: string; success?: string }>, redirectTo?: string) => {
    setError(null);
    setSuccess(null);
    const res = await fn();
    if (res.error) setError(res.error);
    if (res.success) {
      setSuccess(res.success);
      if (redirectTo) setTimeout(() => router.push(redirectTo), 1000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {hasUser && (
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-outline-variant rounded p-2 font-body-sm text-body-sm w-40"
            />
            <button
              onClick={() => {
                if (!password) return;
                start(() => act(() => resetParentPasswordAction(guardianId, password)));
              }}
              disabled={pending || !password}
              className="bg-primary text-on-primary font-label-sm text-label-sm py-2 px-3 rounded hover:bg-primary-container disabled:opacity-60"
            >
              Reset Password
            </button>
          </div>
        )}

        <button
          onClick={() => start(() => act(() => toggleSuspendParentAction(guardianId, !isSuspended)))}
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
            if (!confirm("Delete this parent/guardian record permanently?")) return;
            start(() => act(() => deleteParentAction(guardianId), "/parents"));
          }}
          disabled={pending}
          className="font-label-sm text-label-sm py-2 px-3 rounded border border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
      {error && <p className="font-label-sm text-label-sm text-red-600">{error}</p>}
      {success && <p className="font-label-sm text-label-sm text-green-600">{success}</p>}
    </div>
  );
}
