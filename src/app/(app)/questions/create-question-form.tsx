"use client";

import { useActionState, useState, useTransition } from "react";
import { createQuestionAction, aiGenerateQuestionsAction, type ActionState } from "./actions";

const init: ActionState = {};

export function CreateQuestionForm({
  subjects,
  lessonNotes,
}: {
  subjects: { id: string; name: string }[];
  lessonNotes: { id: string; topic: string }[];
}) {
  const [tab, setTab] = useState<"mcq" | "essay" | "ai">("mcq");
  const [manualState, manualAction, manualPending] = useActionState(
    createQuestionAction,
    init,
  );
  const [aiPending, startAi] = useTransition();
  const [aiResult, setAiResult] = useState<ActionState>({});
  const [rubricPoints, setRubricPoints] = useState([{ description: "", mark: 0 }]);

  function addRubricPoint() {
    setRubricPoints([...rubricPoints, { description: "", mark: 0 }]);
  }

  function updateRubric(i: number, field: string, value: string | number) {
    const updated = [...rubricPoints];
    updated[i] = { ...updated[i], [field]: value };
    setRubricPoints(updated);
  }

  async function handleAiGenerate(fd: FormData) {
    const noteId = String(fd.get("lessonNoteId") ?? "");
    setAiResult({});
    startAi(async () => setAiResult(await aiGenerateQuestionsAction(noteId)));
  }

  const pending = manualPending || aiPending;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
      <div className="mb-4 flex border-b border-outline-variant font-body-sm text-body-sm">
        {(["mcq", "essay", "ai"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 pr-4 ${
              tab === t
                ? "border-b-2 border-primary text-on-surface"
                : "text-on-surface-variant"
            }`}
          >
            {t === "mcq" ? "MCQ" : t === "essay" ? "Essay" : "AI Generate"}
          </button>
        ))}
      </div>

      {/* Manual MCQ form */}
      {tab === "mcq" && (
        <form action={manualAction} className="space-y-4">
          <input type="hidden" name="type" value="mcq" />
          <SubjectMarksFields subjects={subjects} />
          <textarea
            name="text"
            placeholder="Question text"
            rows={3}
            required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          />
          <div className="grid grid-cols-2 gap-3">
            {["A", "B", "C", "D"].map((letter) => (
              <div key={letter} className="flex items-center gap-2">
                <label className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                  <input
                    type="radio"
                    name="correctAnswer"
                    value={letter}
                    required
                    className="text-on-surface"
                  />
                  {letter}.
                </label>
                <input
                  name={`option${letter}`}
                  placeholder={`Option ${letter}`}
                  className="flex-1 rounded border border-outline-variant px-2 py-1 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                  data-letter={letter}
                />
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
          >
            {manualPending ? "Saving…" : "Create MCQ"}
          </button>
          <ResultMessages state={manualState} />
        </form>
      )}

      {/* Manual Essay form */}
      {tab === "essay" && (
        <form action={manualAction} className="space-y-4">
          <input type="hidden" name="type" value="essay" />
          <SubjectMarksFields subjects={subjects} />
          <textarea
            name="text"
            placeholder="Question text"
            rows={3}
            required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          />
          <textarea
            name="modelAnswer"
            placeholder="Model answer"
            rows={4}
            required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          />
          <div>
            <p className="mb-2 font-label-md text-label-md text-on-surface">Rubric points</p>
            {rubricPoints.map((rp, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input
                  placeholder="Description"
                  value={rp.description}
                  onChange={(e) => updateRubric(i, "description", e.target.value)}
                  className="flex-1 rounded border border-outline-variant px-2 py-1 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                />
                <input
                  type="number"
                  placeholder="Marks"
                  value={rp.mark}
                  onChange={(e) => updateRubric(i, "mark", Number(e.target.value))}
                  className="w-20 rounded border border-outline-variant px-2 py-1 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addRubricPoint}
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
            >
              + Add rubric point
            </button>
            <input
              type="hidden"
              name="rubricPoints"
              value={JSON.stringify(rubricPoints.filter((r) => r.description))}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
          >
            {manualPending ? "Saving…" : "Create Essay"}
          </button>
          <ResultMessages state={manualState} />
        </form>
      )}

      {/* AI generate tab */}
      {tab === "ai" && (
        <form action={handleAiGenerate} className="space-y-4">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Select a published lesson note and generate questions from its content.
          </p>
          {lessonNotes.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-tertiary-container">
              No published lesson notes available. Publish lesson notes first.
            </p>
          )}
          <select
            name="lessonNoteId"
            required
            className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
          >
            <option value="">Select lesson note…</option>
            {lessonNotes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.topic}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || lessonNotes.length === 0}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
          >
            {aiPending ? "Generating…" : "AI generate questions"}
          </button>
          <ResultMessages state={aiResult} />
        </form>
      )}
    </div>
  );
}

function SubjectMarksFields({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <select
          name="subjectId"
          required
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        >
          <option value="">Select subject…</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-24">
        <input
          type="number"
          name="marks"
          placeholder="Marks"
          defaultValue={1}
          min={1}
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <div className="w-32">
        <input
          name="difficulty"
          placeholder="Difficulty"
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
    </div>
  );
}

function ResultMessages({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return (
    <p className={`text-sm ${state.error ? "text-red-600" : "text-green-600"}`}>
      {state.error ?? state.success}
    </p>
  );
}
