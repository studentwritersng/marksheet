"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markHomeworkAction, type ActionState } from "../../../actions";
import { type McqOption } from "@/lib/homework/grading";

export interface MarkingHomeworkQuestion {
  id: string;
  type: "mcq" | "essay";
  order: number;
  marks: number;
  text: string;
  options?: McqOption[];
  rubric?: unknown;
}

export interface MarkingAttemptAnswer {
  homeworkQuestionId: string;
  type: "mcq" | "essay";
  response: number | string;
  autoCorrect?: boolean | null;
  autoScore: number;
  teacherScore?: number | null;
  teacherComment?: string | null;
}

export interface MarkingHomework {
  id: string;
  title: string;
  questions: MarkingHomeworkQuestion[];
}

export interface MarkingAttempt {
  id: string;
  studentName: string;
  status: string;
  mcqScore: number;
  essayScore?: number | null;
  totalScore?: number | null;
  percentage?: number | null;
  answers: MarkingAttemptAnswer[];
}

const inputCls =
  "rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors";
const btnCls =
  "bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60";
const sectionCls =
  "bg-surface-container-lowest border border-outline-variant rounded-xl p-5";

interface EssayDraft {
  teacherScore: number;
  teacherComment: string;
}

export function MarkingClient({
  homework,
  attempt,
}: {
  homework: MarkingHomework;
  attempt: MarkingAttempt;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});
  const [error, setError] = useState<string | null>(null);

  const answerByQuestion = new Map(
    attempt.answers.map((a) => [a.homeworkQuestionId, a]),
  );

  const [drafts, setDrafts] = useState<Record<string, EssayDraft>>(() => {
    const init: Record<string, EssayDraft> = {};
    for (const q of homework.questions) {
      if (q.type !== "essay") continue;
      const a = answerByQuestion.get(q.id);
      init[q.id] = {
        teacherScore: a?.teacherScore != null ? a.teacherScore : 0,
        teacherComment: a?.teacherComment ?? "",
      };
    }
    return init;
  });

  function updateDraft(questionId: string, patch: Partial<EssayDraft>) {
    setDrafts((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);

    const scores: {
      homeworkQuestionId: string;
      teacherScore: number;
      teacherComment?: string;
    }[] = [];

    for (const q of homework.questions) {
      if (q.type !== "essay") continue;
      const draft = drafts[q.id];
      const score = draft.teacherScore;
      if (Number.isNaN(score) || score < 0 || score > q.marks) {
        setError(
          `Essay score for "${q.text}" must be between 0 and ${q.marks}.`,
        );
        return;
      }
      scores.push({
        homeworkQuestionId: q.id,
        teacherScore: score,
        teacherComment: draft.teacherComment.trim() || undefined,
      });
    }

    startTransition(async () => {
      const res = await markHomeworkAction(attempt.id, scores);
      setState(res);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {state.success && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
          <p className="font-body-sm text-body-sm text-green-700">{state.success}</p>
        </div>
      )}
      {error && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
          <p className="font-body-sm text-body-sm text-red-600">{error}</p>
        </div>
      )}

      {homework.questions.map((q, i) => {
        const a = answerByQuestion.get(q.id);
        return (
          <section key={q.id} className={sectionCls}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                <span className="uppercase text-on-surface-variant">[{q.type}]</span> Q{i + 1}. {q.text}
              </h2>
              <span className="font-label-md text-label-md text-on-surface-variant">
                {q.marks} marks
              </span>
            </div>

            {q.type === "mcq" ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Selected option:{" "}
                  <span className="text-on-surface">
                    {typeof a?.response === "number" && a.response >= 0 && q.options
                      ? `${a.response + 1}. ${q.options[a.response]?.text ?? "—"}`
                      : "No answer"}
                  </span>
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Auto-grade:{" "}
                  <span className="text-on-surface">
                    {a?.autoCorrect ? "✓ correct" : "✗ incorrect"} — {a?.autoScore ?? 0}/{q.marks}
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded border border-outline-variant bg-surface-container p-3">
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Student response
                  </p>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface whitespace-pre-wrap">
                    {typeof a?.response === "string" && a.response.trim()
                      ? a.response
                      : "No response provided."}
                  </p>
                </div>

                {q.rubric != null && (
                  <div className="rounded border border-outline-variant bg-surface-container p-3">
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Rubric
                    </p>
                    <pre className="mt-1 font-body-sm text-body-sm text-on-surface whitespace-pre-wrap">
                      {typeof q.rubric === "string"
                        ? q.rubric
                        : JSON.stringify(q.rubric, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">
                    Teacher score (max {q.marks})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={q.marks}
                    step={0.5}
                    value={drafts[q.id]?.teacherScore ?? 0}
                    onChange={(e) =>
                      updateDraft(q.id, { teacherScore: Number(e.target.value) })
                    }
                    className={`${inputCls} w-32`}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">
                    Teacher comment (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={drafts[q.id]?.teacherComment ?? ""}
                    onChange={(e) =>
                      updateDraft(q.id, { teacherComment: e.target.value })
                    }
                    className={inputCls}
                    placeholder="Feedback for the student"
                  />
                </div>
              </div>
            )}
          </section>
        );
      })}

      <form onSubmit={handleSubmit} className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "Saving…" : "Save marks"}
        </button>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          MCQ: {attempt.mcqScore} (auto-scored)
        </span>
      </form>
    </div>
  );
}
