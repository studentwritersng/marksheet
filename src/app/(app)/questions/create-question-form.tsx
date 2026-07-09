"use client";

import { useActionState, useState, useTransition } from "react";
import { createQuestionAction, aiGenerateQuestionsMultiAction, getLessonNotesBySubjectAction, type ActionState } from "./actions";

const init: ActionState = {};

export function CreateQuestionForm({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<"mcq" | "essay" | "ai">("mcq");
  const [manualState, manualAction, manualPending] = useActionState(
    createQuestionAction,
    init,
  );
  const [aiPending, startAi] = useTransition();
  const [aiResult, setAiResult] = useState<ActionState>({});
  const [rubricPoints, setRubricPoints] = useState([{ description: "", mark: 0 }]);

  // AI multi-select state
  const [aiSubjectId, setAiSubjectId] = useState("");
  const [aiClassLevel, setAiClassLevel] = useState("SSS1");
  const [subjectNotes, setSubjectNotes] = useState<{ id: string; topic: string; class: string }[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [loadingNotes, setLoadingNotes] = useState(false);

  function addRubricPoint() {
    setRubricPoints([...rubricPoints, { description: "", mark: 0 }]);
  }

  function updateRubric(i: number, field: string, value: string | number) {
    const updated = [...rubricPoints];
    updated[i] = { ...updated[i], [field]: value };
    setRubricPoints(updated);
  }

  function toggleNote(id: string) {
    const next = new Set(selectedNoteIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedNoteIds(next);
  }

  async function loadNotes(subjectId: string, classLevel?: string) {
    if (!subjectId) { setSubjectNotes([]); return; }
    setLoadingNotes(true);
    try {
      const notes = await getLessonNotesBySubjectAction(subjectId, classLevel);
      setSubjectNotes(notes);
      setSelectedNoteIds(new Set());
    } finally {
      setLoadingNotes(false);
    }
  }

  async function handleAiGenerate(fd: FormData) {
    if (selectedNoteIds.size === 0) {
      setAiResult({ error: "Select at least one lesson note." });
      return;
    }
    fd.set("subjectId", aiSubjectId);
    fd.delete("lessonNoteIds");
    for (const id of selectedNoteIds) fd.append("lessonNoteIds", id);
    setAiResult({});
    startAi(async () => setAiResult(await aiGenerateQuestionsMultiAction({}, fd)));
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
          <TopicClassFields />
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
          <TopicClassFields />
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
            Select a subject and topic, then choose one or more published lesson notes. Set the question type, class level, number, and marks before generating.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Subject</label>
              <select
                value={aiSubjectId}
                onChange={(e) => { setAiSubjectId(e.target.value); loadNotes(e.target.value, aiClassLevel); }}
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              >
                <option value="">Select subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">Topic *</label>
              <input
                type="text"
                name="topic"
                placeholder="e.g. Photosynthesis, Fractions, Organs of Speech"
                required
                className="w-full border border-outline-variant rounded p-3 font-body-md bg-surface-container-lowest focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Generation options */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Question Type</label>
              <select name="questionType" defaultValue="essay" className="w-full border border-outline-variant rounded p-2 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary">
                <option value="essay">Essay (Theory)</option>
                <option value="mcq">MCQ (Objective)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Class Level</label>
              <select name="classLevel" value={aiClassLevel} onChange={(e) => { setAiClassLevel(e.target.value); if (aiSubjectId) loadNotes(aiSubjectId, e.target.value); }} className="w-full border border-outline-variant rounded p-2 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary">
                {["JSS1","JSS2","JSS3","SSS1","SSS2","SSS3"].map((lv) => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Number of Questions</label>
              <input type="number" name="questionCount" defaultValue={3} min={1} max={50}
                className="w-full border border-outline-variant rounded p-2 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Total Marks per Question</label>
              <input type="number" name="marksPerQuestion" defaultValue={5} min={1}
                className="w-full border border-outline-variant rounded p-2 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary" />
              <p className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant">For essay, AI distributes across (a)(b)(c) sub-parts</p>
            </div>
            <div>
              <label className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">Grounding % (lesson-note based)</label>
              <input type="number" name="groundingPercentage" defaultValue={75} min={0} max={100}
                className="w-full border border-outline-variant rounded p-2 font-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary" />
            </div>
            <div className="col-span-3">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Questions auto-distributed: 40% Easy · 40% Medium · 20% Hard
              </p>
            </div>
          </div>

          {aiSubjectId && (
            <div>
              <label className="mb-1 block font-label-md text-label-md text-on-surface">
                Lesson Notes {subjectNotes.length > 0 ? `(${selectedNoteIds.size} selected)` : ""}
              </label>
              {loadingNotes && <p className="font-body-sm text-body-sm text-on-surface-variant">Loading lesson notes…</p>}
              {!loadingNotes && subjectNotes.length === 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">No published lesson notes for this subject.</p>
              )}
              {subjectNotes.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-outline-variant rounded-lg divide-y divide-outline-variant">
                  {subjectNotes.map((n) => (
                    <label key={n.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-surface-container ${
                      selectedNoteIds.has(n.id) ? "bg-primary-container text-on-primary-container" : ""
                    }`}>
                      <input type="checkbox"
                        checked={selectedNoteIds.has(n.id)}
                        onChange={() => toggleNote(n.id)}
                        className="text-primary"
                      />
                      <span className="font-body-sm text-body-sm">{n.topic} <span className="text-on-surface-variant">({n.class})</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={pending || selectedNoteIds.size === 0}
            className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[#003366] disabled:opacity-60"
          >
            {aiPending ? "Generating…" : `AI generate questions (${selectedNoteIds.size} notes)`}
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
        <select
          name="difficulty"
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        >
          <option value="">Difficulty</option>
          {["Easy", "Medium", "Hard"].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TopicClassFields() {
  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <input
          name="topic"
          placeholder="Topic (e.g. Photosynthesis, Fractions)"
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>
      <div className="w-32">
        <select
          name="classLevel"
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
        >
          <option value="">Class level</option>
          {["JSS1","JSS2","JSS3","SSS1","SSS2","SSS3"].map((lv) => (
            <option key={lv} value={lv}>{lv}</option>
          ))}
        </select>
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
