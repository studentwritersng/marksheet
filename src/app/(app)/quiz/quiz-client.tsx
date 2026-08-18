"use client";

import { useState } from "react";
import {
  startQuizAction,
  submitQuizAction,
  type AvailableQuiz,
  type QuizQuestionView,
} from "@/lib/quiz/actions";

export function QuizClient({ quizzes }: { quizzes: AvailableQuiz[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionView[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    earnedPoints: number;
    correctCount: number;
    totalQuestions: number;
  } | null>(null);

  const selectedQuiz = quizzes.find((q) => q.key === selectedKey) ?? null;

  async function startQuiz(key: string) {
    setSelectedKey(key);
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setLoadError(null);
    setLoading(true);
    try {
      const res = await startQuizAction(key);
      if (Array.isArray(res)) {
        setQuestions(res);
      } else {
        setLoadError(res.error);
      }
    } catch {
      setLoadError("Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedQuiz) return;
    setSubmitting(true);
    setLoadError(null);
    try {
      const formData = new FormData();
      formData.append("mode", selectedQuiz.mode);
      for (const q of questions) formData.append("questionIds[]", q.id);
      formData.append("answers", JSON.stringify(answers));
      const res = await submitQuizAction(formData);
      if (res.error) {
        setLoadError(res.error);
      } else {
        setResult({
          earnedPoints: res.earnedPoints ?? 0,
          correctCount: res.correctCount ?? 0,
          totalQuestions: res.totalQuestions ?? 0,
        });
      }
    } catch {
      setLoadError("Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="flex flex-col gap-stack-lg">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Quiz Result
        </h2>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col gap-2">
          <p className="font-body-lg text-body-lg text-on-surface">
            You scored {result.correctCount} / {result.totalQuestions}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Points earned: {result.earnedPoints}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setSelectedKey(null);
            setQuestions([]);
            setAnswers({});
          }}
          className="w-fit flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors"
        >
          Back to quizzes
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Quizzes
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Take your daily quiz or practice by subject.
        </p>
      </div>

      {!selectedKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No quizzes available yet.
            </p>
          )}
          {quizzes.map((quiz) => (
            <div
              key={quiz.key}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-3"
            >
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                {quiz.title}
              </h3>
              <span className="bg-surface-variant text-on-surface-variant font-label-sm text-label-sm px-2 py-0.5 rounded w-fit capitalize">
                {quiz.mode}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                disabled={!quiz.available}
                onClick={() => startQuiz(quiz.key)}
                className="mt-auto w-full flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {quiz.available ? "Start" : "Unavailable"}
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedKey && (
        <div className="flex flex-col gap-stack-md">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedKey(null);
                setQuestions([]);
                setAnswers({});
              }}
              className="flex items-center gap-2 font-label-sm text-label-sm text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>
          </div>

          {loading && (
            <p className="font-body-md text-body-md text-on-surface-variant">Loading questions…</p>
          )}
          {loadError && (
            <p className="font-body-md text-body-md text-error">{loadError}</p>
          )}

          {!loading && questions.length > 0 && (
            <form
              className="flex flex-col gap-stack-lg"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-3"
                >
                  <p className="font-body-md text-body-md text-on-surface font-medium">
                    {idx + 1}. {q.questionText}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className="flex items-center gap-3 p-3 border border-outline-variant rounded cursor-pointer hover:bg-surface-container-low"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={oi}
                          checked={answers[q.id] === oi}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                        />
                        <span className="font-body-sm text-body-sm text-on-surface">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="submit"
                disabled={submitting}
                className="w-fit flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Quiz"}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
