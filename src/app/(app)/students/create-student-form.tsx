"use client";

import { useActionState } from "react";
import { createStudentAction, type ActionState } from "./actions";

const init: ActionState = {};

export function CreateStudentForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createStudentAction, init);

  return (
    <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
      <h2 className="mb-3 font-headline-sm text-headline-sm text-on-surface font-semibold">Register Student</h2>
      <div className="space-y-3">
        <input name="admissionNumber" placeholder="Admission no." required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        <div className="flex gap-2">
          <input name="firstName" placeholder="First name" required className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
          <input name="lastName" placeholder="Last name" required className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        </div>
        <select name="gender" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
          <option value="">— Gender —</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <select name="classId" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
          <option value="">— Class —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <hr className="border-outline-variant" />
        <p className="font-label-sm text-label-sm text-on-surface-variant">Guardian (optional)</p>
        <input name="guardianName" placeholder="Full name" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        <input name="guardianPhone" placeholder="Phone" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors" />
        <button type="submit" disabled={pending} className="w-full bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
          {pending ? "Saving…" : "Register"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      </div>
    </form>
  );
}
