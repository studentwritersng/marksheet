"use client";

import { useActionState } from "react";
import { createSubjectAction, type ActionState } from "./actions";

const init: ActionState = {};

export function SubjectForm() {
  const [state, action, pending] = useActionState(createSubjectAction, init);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
      <div>
        <label htmlFor="name" className="mb-1 block font-label-md text-label-md text-on-surface">Subject name</label>
        <input id="name" name="name" placeholder="e.g. Mathematics" required className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
      </div>
      <div>
        <label htmlFor="code" className="mb-1 block font-label-md text-label-md text-on-surface">Code (optional)</label>
        <input id="code" name="code" placeholder="e.g. MAT" className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
      </div>
      <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
        {pending ? "Adding…" : "Add subject"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-600">{state.success}</p>}
    </form>
  );
}
