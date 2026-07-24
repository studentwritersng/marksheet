"use client";

import { useActionState, useState } from "react";
import { createClassAction, type ActionState } from "./actions";

const initial: ActionState = {};
const LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];
const DEPARTMENTS = [
  { value: "", label: "None (General)" },
  { value: "science", label: "Science" },
  { value: "art", label: "Art" },
  { value: "commercial", label: "Commercial" },
];

export function CreateClassForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(createClassAction, initial);
  const [level, setLevel] = useState("");
  const [section, setSection] = useState("");

  const isSSS = level.startsWith("SSS");

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-4"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <div>
        <label className="mb-1 block font-label-md text-label-md text-on-surface">Level</label>
        <select
          name="level" required value={level}
          onChange={(e) => { setLevel(e.target.value); setSection(""); }}
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        >
          <option value="">Select level…</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block font-label-md text-label-md text-on-surface">Section (optional)</label>
        <input
          name="section" value={section}
          onChange={(e) => setSection(e.target.value.toUpperCase())}
          placeholder="e.g. A, B, C"
          className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      {isSSS && (
        <div>
          <label className="mb-1 block font-label-md text-label-md text-on-surface">Department</label>
          <select
            name="department"
            className="border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          >
            {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
      >
        {pending ? "Creating\u2026" : "Create class"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-green-600">{state.success}</p>}
    </form>
  );
}