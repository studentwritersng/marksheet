"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { submitHomeworkAction } from "../../../homework/actions";

export interface TakeQuestion {
  id: string;
  type: "mcq" | "essay";
  order: number;
  marks: number;
  text: string;
  options?: { text: string; isCorrect: boolean }[];
  rubric?: unknown;
}

export interface TakeAnswer {
  homeworkQuestionId: string;
  response: unknown;
  autoCorrect?: boolean | null;
  autoScore: number;
}

export type AttemptStatus = "in_progress" | "submitted" | "graded";

export interface ExistingAttempt {
  id: string;
  status: AttemptStatus;
  answers: TakeAnswer[];
}

export interface TakeHomeworkDTO {
  id: string;
  title: string;
  dueDate: string | null;
  questions: TakeQuestion[];
}

export function TakeHomeworkClient({
  homework,
  existingAttempt,
}: {
  homework: TakeHomeworkDTO;
  existingAttempt: ExistingAttempt | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isPastDue = homework.dueDate ? new Date(homework.dueDate) < new Date() : false;
  const isSubmitted =
    existingAttempt?.status === "submitted" || existingAttempt?.status === "graded";
  const readOnly = isSubmitted;

  function findAnswer(qId: string): TakeAnswer | undefined {
    return existingAttempt?.answers.find((a) => a.homeworkQuestionId === qId);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPastDue || readOnly) return;
    setError(null);
    startTransition(async () => {
      const payload = homework.questions.map((q) => ({
        homeworkQuestionId: q.id,
        response: answers[q.id] ?? (q.type === "mcq" ? null : ""),
      }));
      const res = await submitHomeworkAction(homework.id, payload);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">{homework.title}</h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          {homework.questions.length} question{homework.questions.length === 1 ? "" : "s"}
          {homework.dueDate
            ? ` · Due ${new Date(homework.dueDate).toLocaleString()}`
            : ""}
        </p>
      </div>

      {isPastDue && (
        <p className="rounded border border-outline-variant bg-surface-container px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
          This homework is past due and can no longer be submitted.
        </p>
      )}

      {isSubmitted && (
        <p className="rounded border border-outline-variant bg-surface-container px-3 py-2 font-body-sm text-body-sm text-on-surface">
          You have submitted this homework. Your responses are shown read-only below.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {homework.questions.map((q) => {
          const existing = findAnswer(q.id);
          return (
            <section
              key={q.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5"
            >
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                <span className="text-on-surface-variant">{q.order}. </span>
                {q.text}{" "}
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  ({q.marks} marks)
                </span>
              </h2>

              {q.type === "mcq" ? (
                <div className="mt-3 flex flex-col gap-2">
                  {(q.options ?? []).map((opt, i) => {
                    const selected = readOnly
                      ? typeof existing?.response === "number" && existing.response === i
                      : answers[q.id] === i;
                    return (
                      <label
                        key={i}
                        className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface"
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          disabled={readOnly}
                          checked={selected}
                          onChange={() => setAnswers((p) => ({ ...p, [q.id]: i }))}
                        />
                        <span>{opt.text}</span>
                        {readOnly &&
                          typeof existing?.response === "number" &&
                          existing.response === i &&
                          existing.autoCorrect != null && (
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              {existing.autoCorrect ? "✓ correct" : "✗ incorrect"}
                            </span>
                          )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  disabled={readOnly}
                  rows={5}
                  className="mt-3 w-full rounded border border-outline-variant px-2 py-1 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                  value={
                    readOnly
                      ? String(existing?.response ?? "")
                      : typeof answers[q.id] === "string"
                        ? (answers[q.id] as string)
                        : ""
                  }
                  onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  placeholder="Write your answer…"
                />
              )}
            </section>
          );
        })}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {done && !readOnly && (
          <p className="text-sm text-green-600">Homework submitted successfully.</p>
        )}

        {!readOnly && !isPastDue && (
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
          >
            {isPending ? "Submitting…" : "Submit homework"}
          </button>
        )}
      </form>
    </div>
  );
}
