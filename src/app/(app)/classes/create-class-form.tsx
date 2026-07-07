"use client";

import { useActionState } from "react";
import { createClassAction, type ActionState } from "./actions";

const initial: ActionState = {};

export function CreateClassForm({
  sessionId,
}: {
  sessionId: string;
}) {
  const [state, action, pending] = useActionState(createClassAction, initial);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <div>
        <label
          htmlFor="name"
          className="mb-1 block font-label-md text-label-md text-on-surface"
        >
          Class name
        </label>
        <input
          id="name"
          name="name"
          placeholder="JSS1A"
          required
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <div>
        <label
          htmlFor="level"
          className="mb-1 block font-label-md text-label-md text-on-surface"
        >
          Level
        </label>
        <input
          id="level"
          name="level"
          placeholder="JSS1"
          required
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !sessionId}
        className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create class"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="w-full text-sm text-green-600">{state.success}</p>
      )}
    </form>
  );
}
