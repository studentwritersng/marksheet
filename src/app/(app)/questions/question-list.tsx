"use client";

import { useState, useTransition } from "react";
import { approveQuestionAction, rejectQuestionAction, deleteQuestionAction } from "./actions";

interface QuestionVM {
  id: string;
  text: string;
  type: string;
  marks: number;
  subject: string;
  status: string;
  source: string;
  difficulty: string | null;
  mcqOptions: { id: string; text: string; isCorrect: boolean }[];
  modelAnswer: string | null;
}

export function QuestionList({ questions }: { questions: QuestionVM[] }) {
  const [pending, start] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered =
    filterStatus === "all"
      ? questions
      : questions.filter((q) => q.status === filterStatus);

  function handleApprove(id: string) {
    if (!confirm("Approve this question? It becomes visible and usable by other teachers.")) return;
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

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 text-sm">
        {[
          { label: "All", value: "all" },
          { label: "Approved", value: "approved" },
          { label: "Pending", value: "pending_review" },
          { label: "Draft", value: "draft" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`rounded-full px-3 py-1 ${
              filterStatus === f.value
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-low"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">No questions found.</p>
      )}

      {filtered.map((q) => {
        const isExpanded = expandedId === q.id;
        return (
          <div
            key={q.id}
            onClick={() => setExpandedId(isExpanded ? null : q.id)}
            className="cursor-pointer bg-surface-container-lowest border border-outline-variant rounded-lg p-4 transition hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-label-md text-label-md text-on-surface">
                  {q.text.slice(0, 200)}
                  {q.text.length > 200 ? "…" : ""}
                </p>
                <p className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                  {q.subject} · {q.type.toUpperCase()} · {q.marks} mark(s)
                  {q.difficulty ? ` · ${q.difficulty}` : ""} · {q.source}
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

            {isExpanded && (
              <div
                className="mt-4 border-t border-outline-variant pt-4"
                onClick={(e) => e.stopPropagation()}
              >
                {q.mcqOptions.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1 font-label-sm text-label-sm text-on-surface">Options:</p>
                    <div className="space-y-1">
                      {q.mcqOptions.map((o) => (
                        <div
                          key={o.id}
                          className={`rounded px-2 py-1 font-label-sm text-label-sm ${
                            o.isCorrect
                              ? "bg-secondary-container font-medium text-on-secondary-container"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {o.isCorrect ? "✓ " : ""}
                          {o.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {q.modelAnswer && (
                  <div>
                    <p className="mb-1 font-label-sm text-label-sm text-on-surface">
                      Model answer:
                    </p>
                    <p className="rounded bg-surface-container-low px-2 py-1 font-label-sm text-label-sm text-on-surface">
                      {q.modelAnswer.slice(0, 300)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
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
