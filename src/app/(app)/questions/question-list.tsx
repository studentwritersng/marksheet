"use client";

import { useState, useTransition, useMemo, useRef, useActionState } from "react";
import {
  approveQuestionAction, rejectQuestionAction, deleteQuestionAction,
  bulkApproveQuestionsAction, bulkDeleteQuestionsAction, bulkEditTopicAction,
  updateQuestionAction,
  type ActionState,
} from "./actions";
import { exportToDOC } from "@/lib/export/doc";
import { MathRenderer } from "@/components/math-renderer";

interface QuestionVM {
  id: string;
  topic: string | null;
  text: string;
  type: string;
  marks: number;
  subject: string;
  subjectId: string;
  classLevel: string | null;
  status: string;
  source: string;
  difficulty: string | null;
  mcqOptions: { id: string; text: string; isCorrect: boolean }[];
  modelAnswer: string | null;
}

interface TopicGroup {
  topic: string;
  subject: string;
  classLevel: string;
  type: string;
  questions: QuestionVM[];
}

export function QuestionList({
  questions,
  classLevels,
  subjects,
}: {
  questions: QuestionVM[];
  classLevels: string[];
  subjects: string[];
}) {
  const [pending, start] = useTransition();
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editTopicValue, setEditTopicValue] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterClass !== "all" && q.classLevel !== filterClass) return false;
      if (filterSubject !== "all" && q.subject !== filterSubject) return false;
      if (filterType !== "all" && q.type !== filterType) return false;
      if (filterStatus !== "all" && q.status !== filterStatus) return false;
      return true;
    });
  }, [questions, filterClass, filterSubject, filterType, filterStatus]);

  const groups = useMemo(() => {
    const map = new Map<string, TopicGroup>();
    for (const q of filtered) {
      const key = q.topic ?? "Untitled";
      const existing = map.get(key);
      if (existing) {
        existing.questions.push(q);
      } else {
        map.set(key, {
          topic: key,
          subject: q.subject,
          classLevel: q.classLevel ?? "",
          type: q.type,
          questions: [q],
        });
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  function handleApprove(id: string) {
    if (!confirm("Approve this question?")) return;
    start(async () => {
      const r = await approveQuestionAction(id);
      if (r.error) alert(r.error);
    });
  }

  function handleReject(id: string) {
    const comment = prompt("Rejection reason (optional):");
    start(async () => {
      const r = await rejectQuestionAction(id, comment ?? undefined);
      if (r.error) alert(r.error);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Permanently delete this question?")) return;
    start(async () => {
      const r = await deleteQuestionAction(id);
      if (r.error) alert(r.error);
    });
  }

  function handleBulkApprove(ids: string[]) {
    if (!confirm(`Approve all ${ids.length} question(s) in this group?`)) return;
    start(async () => {
      const r = await bulkApproveQuestionsAction(ids);
      if (r.error) alert(r.error);
    });
  }

  function handleBulkDelete(ids: string[]) {
    if (!confirm(`Permanently delete all ${ids.length} question(s) in this group?`)) return;
    start(async () => {
      const r = await bulkDeleteQuestionsAction(ids);
      if (r.error) alert(r.error);
    });
  }

  function handleBulkEditTopic(oldTopic: string, ids: string[]) {
    const newTopic = prompt("Rename topic to:", oldTopic);
    if (!newTopic || newTopic.trim() === oldTopic) return;
    start(async () => {
      const r = await bulkEditTopicAction(ids, newTopic.trim());
      if (r.error) alert(r.error);
    });
  }

  function handleTopicExportDOC(topic: string, questions: QuestionVM[]) {
    const html = questions.map((q, i) => `
      <h2>${i + 1}. ${q.text.replace(/</g, "&lt;")}</h2>
      ${q.mcqOptions.length > 0 ? `<h4>Options:</h4>` + q.mcqOptions.map((o, oi) =>
        `<p>${String.fromCharCode(65 + oi)}. ${o.isCorrect ? "<strong>✓ </strong>" : ""}${o.text.replace(/</g, "&lt;")}</p>`
      ).join("") : ""}
      ${q.modelAnswer ? `<h4>Answer Key:</h4><p>${q.modelAnswer.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>` : ""}
      <hr/>
    `).join("");
    exportToDOC(html, `Questions_${topic.replace(/\s+/g, "_")}`, topic);
  }

  function handleTopicPrint(topic: string, questions: QuestionVM[]) {
    const printWin = window.open("", "_blank", "width=800,height=600");
    if (!printWin) return;
    const html = questions.map((q, i) => `
      <div style="margin-bottom: 24pt; page-break-inside: avoid;">
        <p style="font-weight: bold; font-size: 12pt;">${i + 1}. ${q.text.replace(/</g, "&lt;")}</p>
        ${q.mcqOptions.length > 0 ? `<p style="font-weight: bold; margin-top: 6pt;">Options:</p>` + q.mcqOptions.map((o, oi) =>
          `<p style="margin-left: 12pt; font-size: 11pt;">${String.fromCharCode(65 + oi)}. ${o.isCorrect ? "<strong>✓ </strong>" : ""}${o.text.replace(/</g, "&lt;")}</p>`
        ).join("") : ""}
        ${q.modelAnswer ? `<p style="font-weight: bold; margin-top: 6pt;">Answer Key:</p><p style="margin-left: 12pt; font-size: 11pt;">${q.modelAnswer.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>` : ""}
        <hr/>
      </div>
    `).join("");
    printWin.document.write(`<!DOCTYPE html><html><head><title>${topic}</title>
      <style>body{font-family:"Times New Roman",serif;margin:2cm;}hr{border:none;border-top:1pt solid #ccc;margin:12pt 0;}</style>
    </head><body>${html}</body></html>`);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="border border-outline-variant rounded px-2 py-1 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
        >
          <option value="all">All Classes</option>
          {classLevels.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
        </select>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="border border-outline-variant rounded px-2 py-1 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
        >
          <option value="all">All Subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-outline-variant rounded px-2 py-1 font-body-sm text-body-sm bg-surface-container-lowest focus:outline-none focus:border-primary"
        >
          <option value="all">All Types</option>
          <option value="mcq">MCQ</option>
          <option value="essay">Essay</option>
        </select>
        <div className="flex gap-1">
          {[
            { label: "All", value: "all" },
            { label: "Approved", value: "approved" },
            { label: "Pending", value: "pending_review" },
            { label: "Draft", value: "draft" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`rounded-full px-3 py-1 font-label-sm text-label-sm ${
                filterStatus === f.value
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant py-8 text-center">
          No questions match the selected filters.
        </p>
      )}

      {/* Topic-grouped cards */}
      <div className="space-y-3">
        {groups.map((g) => {
          const isExpanded = expandedTopic === g.topic;
          const qIds = g.questions.map((q) => q.id);
          const allApproved = g.questions.every((q) => q.status === "approved");

          return (
            <div
              key={g.topic}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
            >
              {/* Topic header — clickable to expand */}
              <button
                onClick={() => setExpandedTopic(isExpanded ? null : g.topic)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-container-low transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="font-label-md text-label-md text-on-surface">{g.topic}</span>
                  <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                    {g.questions[0]?.type?.toUpperCase() ?? ""}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {g.questions[0]?.subject ?? ""}
                  </span>
                  {g.questions[0]?.classLevel && (
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {g.questions[0].classLevel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary-container text-on-primary-container px-2 py-0.5 font-label-sm text-label-sm">
                    {g.questions.length} question{g.questions.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTopicExportDOC(g.topic, g.questions); }}
                    disabled={pending}
                    className="rounded bg-primary px-2 py-1 font-label-sm text-label-sm text-on-primary hover:bg-primary-container disabled:opacity-60"
                  >
                    Export DOC
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTopicPrint(g.topic, g.questions); }}
                    disabled={pending}
                    className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container disabled:opacity-60"
                  >
                    Print
                  </button>
                  <span className="text-on-surface-variant">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expanded — bulk actions + individual questions */}
              {isExpanded && (
                <>
                  {/* Bulk action toolbar */}
                  <div className="border-t border-outline-variant bg-surface-container-low px-4 py-2 flex items-center justify-between">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      {g.questions.length} question(s) · {g.questions.filter((q) => q.status === "approved").length} approved
                    </p>
                    <div className="flex items-center gap-2">
                      {!allApproved && (
                        <button
                          onClick={() => handleBulkApprove(qIds)}
                          disabled={pending}
                          className="rounded bg-primary px-2 py-1 font-label-sm text-label-sm text-on-primary hover:bg-primary-container disabled:opacity-60"
                        >
                          Approve All
                        </button>
                      )}
                      <button
                        onClick={() => handleBulkDelete(qIds)}
                        disabled={pending}
                        className="rounded bg-red-600 px-2 py-1 font-label-sm text-label-sm text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Delete All
                      </button>
                      <button
                        onClick={() => handleBulkEditTopic(g.topic, qIds)}
                        disabled={pending}
                        className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container disabled:opacity-60"
                      >
                        Edit Topic
                      </button>
                    </div>
                  </div>

                  {/* Individual questions */}
                  <div className="border-t border-outline-variant divide-y divide-outline-variant">
                    {g.questions.map((q) => {
                      const qExpanded = expandedQuestion === q.id;
                      return (
                        <div key={q.id}>
                          {/* Question row */}
                          <div
                            onClick={() => setExpandedQuestion(qExpanded ? null : q.id)}
                            className="flex items-start justify-between gap-4 px-4 py-3 cursor-pointer hover:bg-surface-container-low transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                                <MathRenderer text={q.text.slice(0, 500)} />
                                {q.text.length > 500 ? "…" : ""}
                              </p>
                              <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                                {q.marks} mark(s) · {q.difficulty ?? "N/A"} · {q.source}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <StatusBadge status={q.status} />
                              {q.status !== "approved" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleApprove(q.id); }}
                                  disabled={pending}
                                  className="rounded bg-primary px-2 py-1 font-label-sm text-label-sm text-on-primary hover:bg-primary-container disabled:opacity-60"
                                >
                                  Approve
                                </button>
                              )}
                              {q.status !== "draft" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReject(q.id); }}
                                  disabled={pending}
                                  className="rounded bg-tertiary-container px-2 py-1 font-label-sm text-label-sm text-on-tertiary-container hover:bg-surface-container-low disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }}
                                disabled={pending}
                                className="font-label-sm text-label-sm text-on-surface-variant hover:text-red-600 disabled:opacity-60"
                              >
                                Delete
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingQuestionId(q.id); }}
                                disabled={pending}
                                className="font-label-sm text-label-sm text-primary hover:underline disabled:opacity-60"
                              >
                                Edit
                              </button>
                            </div>
                          </div>

                          {/* Inline edit form */}
                          {editingQuestionId === q.id && (
                            <EditQuestionForm
                              question={q}
                              onSaved={() => setEditingQuestionId(null)}
                              onCancel={() => setEditingQuestionId(null)}
                            />
                          )}

                          {/* Expanded question details */}
                          {qExpanded && !editingQuestionId && (
                            <div className="border-t border-outline-variant bg-surface-container-low px-4 py-3">
                              <div id={`question-print-${q.id}`} className="space-y-3">
                                <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap mb-1"><MathRenderer text={q.text} /></p>
                                {q.mcqOptions.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="font-label-sm text-label-sm text-on-surface mb-1">Options:</p>
                                    {q.mcqOptions.map((o) => (
                                      <div
                                        key={o.id}
                                        className={`rounded px-2 py-1 font-label-sm text-label-sm ${
                                          o.isCorrect
                                            ? "bg-secondary-container font-medium text-on-secondary-container"
                                            : "text-on-surface-variant"
                                        }`}
                                      >
                                        {o.isCorrect ? "✓ " : ""}{o.text}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {q.modelAnswer && (
                                  <div>
                                    <p className="mb-1 font-label-sm text-label-sm text-on-surface">Model answer:</p>
                                    <p className="rounded bg-surface-container-lowest px-2 py-1 font-label-sm text-label-sm text-on-surface whitespace-pre-wrap">
                                      <MathRenderer text={q.modelAnswer} />
                                    </p>
                                  </div>
                                 )}
                               </div>
                             </div>
                           )}
                         </div>
                       );
                     })}
                   </div>
                 </>
               )}
             </div>
           );
         })}
       </div>
     </div>
   );
 }

function EditQuestionForm({ question, onSaved, onCancel }: { question: QuestionVM; onSaved: () => void; onCancel: () => void }) {
  const [state, formAction] = useActionState(updateQuestionAction, {});
  const [type, setType] = useState(question.type);
  const [optA, setOptA] = useState(question.mcqOptions[0]?.text ?? "");
  const [optB, setOptB] = useState(question.mcqOptions[1]?.text ?? "");
  const [optC, setOptC] = useState(question.mcqOptions[2]?.text ?? "");
  const [optD, setOptD] = useState(question.mcqOptions[3]?.text ?? "");
  const [correct, setCorrect] = useState(() => {
    const idx = question.mcqOptions.findIndex((o) => o.isCorrect);
    return idx >= 0 ? String.fromCharCode(65 + idx) : "A";
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    fd.append("questionId", question.id);
    const res = await updateQuestionAction({}, fd);
    setSaving(false);
    if (res.error) alert(res.error);
    else onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-outline-variant bg-surface-container-low px-4 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Question Text</label>
          <textarea name="text" required defaultValue={question.text} rows={3}
            className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm" />
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Type</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)}
            className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm">
            <option value="mcq">MCQ</option>
            <option value="essay">Essay</option>
          </select>
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Marks</label>
          <input type="number" name="marks" min={1} step={0.5} defaultValue={question.marks}
            className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm" />
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Topic</label>
          <input type="text" name="topic" defaultValue={question.topic ?? ""}
            className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm" />
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class Level</label>
          <input type="text" name="classLevel" defaultValue={question.classLevel ?? ""}
            className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm" />
        </div>
        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Difficulty</label>
          <select name="difficulty" defaultValue={question.difficulty ?? ""}
            className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm">
            <option value="">—</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
      </div>

      {type === "mcq" && (
        <div className="space-y-2">
          <p className="font-label-sm text-label-sm text-on-surface-variant font-medium">Options</p>
          {[
            { label: "A", value: optA, set: setOptA },
            { label: "B", value: optB, set: setOptB },
            { label: "C", value: optC, set: setOptC },
            { label: "D", value: optD, set: setOptD },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center gap-2">
              <input type="radio" name="correctAnswer" value={label} checked={correct === label}
                onChange={() => setCorrect(label)} className="text-[#002046]" />
              <input type="text" value={value} onChange={(e) => set(e.target.value)} name={`option${label}`}
                className="flex-1 border border-outline-variant rounded p-1.5 font-body-sm text-body-sm" required />
            </div>
          ))}
          <input type="hidden" name="correctAnswer" value={correct} />
        </div>
      )}

      {type === "essay" && (
        <div className="space-y-2">
          <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Model Answer</label>
          <textarea name="modelAnswer" required defaultValue={question.modelAnswer ?? ""} rows={4}
            className="w-full border border-outline-variant rounded p-2 font-body-sm text-body-sm" />
        </div>
      )}

      <input type="hidden" name="subjectId" value={question.subjectId} />
      <input type="hidden" name="rubricPoints" value={JSON.stringify([])} />

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="bg-primary text-white text-sm px-3 py-1.5 rounded hover:bg-primary-container disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel}
          className="text-sm text-on-surface-variant px-3 py-1.5 border border-outline-variant rounded">Cancel</button>
      </div>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-secondary-container text-on-secondary-container"
      : status === "pending_review"
        ? "bg-amber-100 text-amber-700"
        : "bg-surface-variant text-on-surface-variant";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}
