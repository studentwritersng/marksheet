"use client";

import { useState, useTransition, useMemo } from "react";
import {
  approveQuestionAction, rejectQuestionAction, deleteQuestionAction,
  bulkApproveQuestionsAction, bulkDeleteQuestionsAction, bulkEditTopicAction,
} from "./actions";

interface QuestionVM {
  id: string;
  topic: string | null;
  text: string;
  type: string;
  marks: number;
  subject: string;
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
                                {q.text.slice(0, 500)}
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
                            </div>
                          </div>

                          {/* Expanded question details */}
                          {qExpanded && (
                            <div className="border-t border-outline-variant bg-surface-container-low px-4 py-3">
                              <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap mb-3">{q.text}</p>
                              {q.mcqOptions.length > 0 && (
                                <div className="mb-3 space-y-1">
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
                                    {q.modelAnswer}
                                  </p>
                                </div>
                              )}
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
