"use client";

import { useActionState, useState, useTransition } from "react";
import { createLessonNoteAction, aiGenerateNoteAction, type ActionState } from "./actions";

const init: ActionState = {};

export function LessonNotesForm({
  subjects,
  classes,
  terms,
}: {
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  terms: { id: string; name: string }[];
}) {
  const [manualState, manualAction, manualPending] = useActionState(createLessonNoteAction, init);
  const [aiPending, startAi] = useTransition();
  const [aiResult, setAiResult] = useState<ActionState>({});

  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");

  async function handleAiGenerate(fd: FormData) {
    setAiResult({});
    startAi(async () => {
      setAiResult(await aiGenerateNoteAction({}, fd));
    });
  }

  const pending = manualPending || aiPending;
  const state = activeTab === "manual" ? manualState : aiResult;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
      <div className="mb-4 flex border-b border-outline-variant font-body-sm text-body-sm">
        <button
          onClick={() => setActiveTab("manual")}
          className={`pb-2 pr-4 ${
            activeTab === "manual" ? "border-b-2 border-primary text-on-surface" : "text-on-surface-variant"
          }`}
        >
          Manual entry
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`pb-2 pr-4 ${
            activeTab === "ai" ? "border-b-2 border-primary text-on-surface" : "text-on-surface-variant"
          }`}
        >
          AI Generator (PRD 14)
        </button>
      </div>

      <form action={activeTab === "manual" ? manualAction : handleAiGenerate} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="subjectId" className="mb-1 block font-label-md text-label-md text-on-surface">Subject</label>
            <select id="subjectId" name="subjectId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
              <option value="">Select subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="classId" className="mb-1 block font-label-md text-label-md text-on-surface">Class</label>
            <select id="classId" name="classId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
              <option value="">Select class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="termId" className="mb-1 block font-label-md text-label-md text-on-surface">Term</label>
            <select id="termId" name="termId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors">
              <option value="">Select term…</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name} Term</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="topic" className="mb-1 block font-label-md text-label-md text-on-surface">Topic</label>
          <input
            id="topic"
            name="topic"
            placeholder="e.g. Introduction to Cells"
            required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          />
        </div>

        {activeTab === "manual" && (
          <div>
            <label htmlFor="content" className="mb-1 block font-label-md text-label-md text-on-surface">Content</label>
            <textarea
              id="content"
              name="content"
              rows={6}
              required
              placeholder="Enter the lesson note content here..."
              className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
        >
          {pending
            ? activeTab === "manual" ? "Saving…" : "Generating draft…"
            : activeTab === "manual" ? "Save note" : "AI generate note"
          }
        </button>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-green-600">{state.success}</p>
        )}
      </form>
    </div>
  );
}