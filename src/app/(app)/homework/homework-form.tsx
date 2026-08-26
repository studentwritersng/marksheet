"use client";

import { useState, useActionState } from "react";
import {
  createHomeworkAction,
  searchBankQuestionsAction,
  type ActionState,
  type BankQuestionDTO,
} from "./actions";

const MAX_MCQ = 20;
const MAX_ESSAY = 5;

interface ClassOption {
  id: string;
  name: string;
  level: string;
}
interface SubjectOption {
  id: string;
  name: string;
}
interface TermOption {
  id: string;
  name: string;
}

interface QuestionDraft {
  type: "mcq" | "essay";
  text: string;
  marks: number;
  order: number;
  options?: { text: string; isCorrect: boolean }[];
  rubric?: unknown;
  sourceQuestionId?: string;
}

const init: ActionState = {};

const inputCls =
  "rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors";
const btnCls =
  "bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60";
const sectionCls =
  "bg-surface-container-lowest border border-outline-variant rounded-xl p-5";

export function HomeworkForm({
  classes,
  subjects,
  terms,
  activeTermId,
}: {
  classes: ClassOption[];
  subjects: SubjectOption[];
  terms: TermOption[];
  activeTermId: string;
}) {
  const [createState, createAction, createPending] = useActionState(
    createHomeworkAction,
    init,
  );

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const mcqCount = questions.filter((q) => q.type === "mcq").length;
  const essayCount = questions.filter((q) => q.type === "essay").length;

  // Question bank search state.
  const [searchSubject, setSearchSubject] = useState(subjects[0]?.id ?? "");
  const [searchLevel, setSearchLevel] = useState("");
  const [searchType, setSearchType] = useState<"mcq" | "essay" | "all">("all");
  const [bankResults, setBankResults] = useState<BankQuestionDTO[]>([]);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  // Manual MCQ state.
  const [mcqText, setMcqText] = useState("");
  const [mcqOpts, setMcqOpts] = useState<string[]>(["", "", "", ""]);
  const [mcqCorrect, setMcqCorrect] = useState(0);
  const [mcqMarks, setMcqMarks] = useState(1);

  // Manual essay state.
  const [essayText, setEssayText] = useState("");
  const [essayRubric, setEssayRubric] = useState("");
  const [essayMarks, setEssayMarks] = useState(5);

  const levels = Array.from(new Set(classes.map((c) => c.level))).sort();

  function addQuestion(q: QuestionDraft) {
    if (q.type === "mcq" && mcqCount >= MAX_MCQ) return;
    if (q.type === "essay" && essayCount >= MAX_ESSAY) return;
    setQuestions((prev) => [...prev, { ...q, order: prev.length + 1 }]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setBankLoading(true);
    setBankError(null);
    const res = await searchBankQuestionsAction(searchSubject, searchLevel, searchType);
    setBankLoading(false);
    if (res.error) {
      setBankError(res.error);
      setBankResults([]);
      return;
    }
    setBankResults(res.questions);
  }

  function addBankQuestion(q: BankQuestionDTO) {
    addQuestion({
      type: q.type,
      text: q.text,
      marks: q.marks || (q.type === "mcq" ? 1 : 5),
      order: 0,
      options: q.options,
      rubric: q.rubric,
      sourceQuestionId: q.id,
    });
  }

  function addManualMcq() {
    if (!mcqText.trim()) return;
    if (mcqOpts.some((o) => !o.trim())) return;
    addQuestion({
      type: "mcq",
      text: mcqText.trim(),
      marks: mcqMarks,
      order: 0,
      options: mcqOpts.map((text, i) => ({
        text: text.trim(),
        isCorrect: i === mcqCorrect,
      })),
    });
    setMcqText("");
    setMcqOpts(["", "", "", ""]);
    setMcqCorrect(0);
    setMcqMarks(1);
  }

  function addManualEssay() {
    if (!essayText.trim()) return;
    let rubric: unknown;
    if (essayRubric.trim()) {
      try {
        rubric = JSON.parse(essayRubric);
      } catch {
        rubric = { guidance: essayRubric.trim() };
      }
    }
    addQuestion({
      type: "essay",
      text: essayText.trim(),
      marks: essayMarks,
      order: 0,
      rubric,
    });
    setEssayText("");
    setEssayRubric("");
    setEssayMarks(5);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Details + questions editor */}
      <form action={createAction} className="flex flex-col gap-5">
        <section className={sectionCls}>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Assignment details
          </h2>
          <input type="hidden" name="questions" value={JSON.stringify(questions)} />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Class</label>
              <select name="classId" className={inputCls} required defaultValue={classes[0]?.id ?? ""}>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Subject</label>
              <select name="subjectId" className={inputCls} required defaultValue={subjects[0]?.id ?? ""}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Term</label>
              <select name="termId" className={inputCls} required defaultValue={activeTermId}>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Due date (optional)</label>
              <input name="dueDate" type="date" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="font-label-md text-label-md text-on-surface">Title</label>
              <input name="title" className={inputCls} required placeholder="e.g. Algebra Practice 1" />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="font-label-md text-label-md text-on-surface">Instructions (optional)</label>
              <textarea name="instructions" className={inputCls} rows={3} placeholder="Guidance for students" />
            </div>
          </div>
        </section>

        {/* Search question bank */}
        <section className={sectionCls}>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Import from question bank
          </h2>
          <form onSubmit={handleSearch} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Subject</label>
              <select
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
                className={inputCls}
                required
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Class level</label>
              <select
                value={searchLevel}
                onChange={(e) => setSearchLevel(e.target.value)}
                className={inputCls}
              >
                <option value="">All levels</option>
                {levels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface">Type</label>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as "mcq" | "essay" | "all")}
                className={inputCls}
              >
                <option value="all">All</option>
                <option value="mcq">MCQ</option>
                <option value="essay">Essay</option>
              </select>
            </div>
            <button type="submit" disabled={bankLoading} className={btnCls}>
              {bankLoading ? "Searching…" : "Search"}
            </button>
          </form>
          {bankError && <p className="mt-3 text-sm text-red-600">{bankError}</p>}
          {bankResults.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {bankResults.map((q) => {
                const atLimit = q.type === "mcq" ? mcqCount >= MAX_MCQ : essayCount >= MAX_ESSAY;
                return (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-3 rounded border border-outline-variant bg-surface-container px-3 py-2"
                  >
                    <span className="font-body-sm text-body-sm text-on-surface">
                      <span className="uppercase text-on-surface-variant">[{q.type}]</span> {q.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => addBankQuestion(q)}
                      disabled={atLimit}
                      className="font-label-sm text-label-sm text-primary hover:text-primary-container disabled:opacity-50"
                    >
                      Add
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Manual MCQ */}
        <section className={sectionCls}>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add manual MCQ</h2>
          <div className="mt-4 flex flex-col gap-3">
            <input
              value={mcqText}
              onChange={(e) => setMcqText(e.target.value)}
              className={inputCls}
              placeholder="Question text"
            />
            {mcqOpts.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mcqCorrect"
                  checked={mcqCorrect === i}
                  onChange={() => setMcqCorrect(i)}
                  aria-label={`Mark option ${i + 1} correct`}
                />
                <input
                  value={opt}
                  onChange={(e) =>
                    setMcqOpts((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  className={inputCls}
                  placeholder={`Option ${i + 1}`}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <label className="font-label-md text-label-md text-on-surface">Marks</label>
              <input
                type="number"
                min={0}
                value={mcqMarks}
                onChange={(e) => setMcqMarks(Number(e.target.value))}
                className={`${inputCls} w-24`}
              />
              <button
                type="button"
                onClick={addManualMcq}
                disabled={mcqCount >= MAX_MCQ}
                className={btnCls}
              >
                Add MCQ
              </button>
            </div>
          </div>
        </section>

        {/* Manual essay */}
        <section className={sectionCls}>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Add manual essay</h2>
          <div className="mt-4 flex flex-col gap-3">
            <input
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              className={inputCls}
              placeholder="Essay question"
            />
            <textarea
              value={essayRubric}
              onChange={(e) => setEssayRubric(e.target.value)}
              className={inputCls}
              rows={3}
              placeholder="Rubric (plain text or JSON)"
            />
            <div className="flex items-center gap-2">
              <label className="font-label-md text-label-md text-on-surface">Marks</label>
              <input
                type="number"
                min={0}
                value={essayMarks}
                onChange={(e) => setEssayMarks(Number(e.target.value))}
                className={`${inputCls} w-24`}
              />
              <button
                type="button"
                onClick={addManualEssay}
                disabled={essayCount >= MAX_ESSAY}
                className={btnCls}
              >
                Add essay
              </button>
            </div>
          </div>
        </section>

        {/* Question list */}
        <section className={sectionCls}>
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Questions</h2>
            <span className="font-label-md text-label-md text-on-surface-variant">
              MCQ: {mcqCount}/{MAX_MCQ}, Essay: {essayCount}/{MAX_ESSAY}
            </span>
          </div>
          {questions.length === 0 ? (
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
              No questions added yet.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {questions.map((q, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded border border-outline-variant bg-surface-container px-3 py-2"
                >
                  <span className="font-body-sm text-body-sm text-on-surface">
                    <span className="uppercase text-on-surface-variant">[{q.type}]</span> {q.text}{" "}
                    <span className="text-on-surface-variant">({q.marks} marks)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="font-label-sm text-label-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5">
            <button type="submit" disabled={createPending || questions.length === 0} className={btnCls}>
              {createPending ? "Creating…" : "Create homework"}
            </button>
          </div>
          {createState.error && <p className="mt-3 text-sm text-red-600">{createState.error}</p>}
          {createState.success && <p className="mt-3 text-sm text-green-600">{createState.success}</p>}
        </section>
      </form>
    </div>
  );
}
