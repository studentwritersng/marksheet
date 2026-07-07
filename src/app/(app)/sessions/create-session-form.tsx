"use client";

import { useActionState } from "react";
import { createSessionAction, type ActionState } from "./actions";

const initial: ActionState = {};

export function CreateSessionForm() {
  const [state, action, pending] = useActionState(createSessionAction, initial);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
    >
      <div>
        <label
          htmlFor="label"
          className="mb-1 block font-label-md text-label-md text-on-surface"
        >
          New session label
        </label>
        <input
          id="label"
          name="label"
          placeholder="2025/2026"
          required
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create session"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600">{state.success}</p>
      )}
    </form>
  );
}
