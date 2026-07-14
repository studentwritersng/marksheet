"use client";

import { useActionState } from "react";
import { createSyllabusAction } from "./actions";

export function SyllabusForm({
  subjects,
  sessions,
}: {
  subjects: { id: string; name: string }[];
  sessions: { id: string; label: string; isCurrent: boolean }[];
}) {
  const [state, formAction, pending] = useActionState(createSyllabusAction, {});

  return (
    <form action={formAction} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Upload / Edit Syllabus</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="subjectId" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
          <select id="subjectId" name="subjectId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
            <option value="">Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="classLevel" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class Level</label>
          <select id="classLevel" name="classLevel" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
            <option value="">Select level</option>
            {["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sessionId" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Session</label>
          <select id="sessionId" name="sessionId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest">
            <option value="">Select session</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.label}{s.isCurrent ? " (current)" : ""}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="file" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Document URL (optional)</label>
        <input id="file" name="file" type="text" placeholder="https://example.com/syllabus.pdf" className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest" />
      </div>

      <div>
        <label htmlFor="topics" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Topics (one per line)</label>
        <textarea id="topics" name="topics" rows={6} placeholder="Enter syllabus topics, one per line..." className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest" />
      </div>

      {state.error && <p className="text-sm text-error bg-error-container px-3 py-2 rounded">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700 bg-green-100 px-3 py-2 rounded">{state.success}</p>}

      <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors disabled:opacity-60">
        {pending ? "Saving..." : "Save Syllabus"}
      </button>
    </form>
  );
}
