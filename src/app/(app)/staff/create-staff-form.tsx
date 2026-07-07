"use client";

import { useActionState } from "react";
import { createStaffAction, type ActionState } from "./actions";

const initial: ActionState = {};

export function CreateStaffForm() {
  const [state, action, pending] = useActionState(createStaffAction, initial);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
    >
      <div>
        <label htmlFor="fullName" className="mb-1 block font-label-md text-label-md text-on-surface">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          placeholder="e.g. Ada Eze"
          required
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block font-label-md text-label-md text-on-surface">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="ada@school.edu.ng"
          required
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block font-label-md text-label-md text-on-surface">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          placeholder="08030000000"
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add staff"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="w-full text-sm text-green-600">{state.success}</p>
      )}
    </form>
  );
}
