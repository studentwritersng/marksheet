"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { startExamAction, submitExamAction } from "@/lib/exams/actions";

interface McqOption { id: string; optionText: string }
interface Question {
  id: string;
  text: string;
  type: string;
  marks: number;
  mcqOptions: McqOption[];
  hasModelAnswer: boolean;
}

export function ExamTakingView({
  examId,
  studentId,
  attemptId: existingAttemptId,
  subjectName,
  className,
  assessmentTypeId,
  durationMinutes,
  termName,
  questions,
}: {
  examId: string;
  studentId: string;
  attemptId?: string;
  subjectName: string;
  className: string;
  assessmentTypeId: string;
  durationMinutes: number;
  termName: string;
  questions: Question[];
}) {
  const [attemptId, setAttemptId] = useState(existingAttemptId);
  const [answers, setAnswers] = useState<Record<string, { mcqSelectedOptionId?: string; essayResponseText?: string }>>({});
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState("");
  const [starting, setStarting] = useState(!existingAttemptId);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const startExam = useCallback(async () => {
    const res = await startExamAction(examId, studentId);
    if (res.attemptId) {
      setAttemptId(res.attemptId);
      setStarting(false);
    } else {
      setMsg(res.error ?? "Failed to start exam.");
    }
  }, [examId, studentId]);

  useEffect(() => {
    if (starting || !attemptId) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [starting, attemptId]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId) return;
    clearInterval(intervalRef.current);
    setSubmitted(true);
    const answerList = Object.entries(answers).map(([questionId, value]) => ({
      questionId,
      ...value,
    }));
    const res = await submitExamAction(attemptId, answerList);
    setMsg(res.success ?? res.error ?? "Submitted.");
  }, [attemptId, answers]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (starting) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-primary-fixed" style={{fontVariationSettings: "'FILL' 1"}}>quiz</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">{subjectName}</h2>
          <div className="font-body-md text-body-md text-on-surface-variant space-y-1">
            <p>{assessmentTypeId} · {className} · {termName}</p>
            <p>{questions.length} questions · {durationMinutes} minutes</p>
          </div>
          <button
            onClick={startExam}
            className="bg-primary text-on-primary font-label-md text-label-md py-3 px-8 rounded hover:bg-primary-container transition-colors"
          >
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-secondary-container">check_circle</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Exam Submitted</h2>
          {msg && <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{msg}</p>}
          <a
            href="/exams"
            className="mt-6 inline-block bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors"
          >
            Back to Exams
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg p-4 mb-4 sticky top-0 z-10">
        <div>
          <p className="font-label-md text-label-md text-on-surface font-semibold">{subjectName} · {assessmentTypeId}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{questions.length} questions</p>
        </div>
        <div className={`font-headline-md text-headline-md ${remaining < 300 ? "text-error" : "text-primary"}`}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        <button
          onClick={handleSubmit}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors"
        >
          Submit
        </button>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="font-body-md text-body-md text-on-surface font-medium flex-1">
                <span className="text-on-surface-variant">{i + 1}.</span> {q.text}
              </p>
              <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
            </div>

            {q.type === "mcq" && (
              <div className="space-y-2">
                {q.mcqOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      answers[q.id]?.mcqSelectedOptionId === opt.id
                        ? "border-primary bg-primary-fixed"
                        : "border-outline-variant hover:bg-surface-container-low"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt.id}
                      checked={answers[q.id]?.mcqSelectedOptionId === opt.id}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], mcqSelectedOptionId: opt.id } }))
                      }
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      answers[q.id]?.mcqSelectedOptionId === opt.id
                        ? "border-primary"
                        : "border-outline"
                    }`}>
                      {answers[q.id]?.mcqSelectedOptionId === opt.id && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="font-body-md text-body-md text-on-surface">{opt.optionText}</span>
                  </label>
                ))}
              </div>
            )}

            {q.type === "essay" && (
              <textarea
                placeholder="Write your answer here…"
                value={answers[q.id]?.essayResponseText ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], essayResponseText: e.target.value } }))
                }
                rows={5}
                className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom submit */}
      <div className="mt-6 text-center">
        <button
          onClick={handleSubmit}
          className="bg-primary text-on-primary font-label-md text-label-md py-3 px-8 rounded hover:bg-primary-container transition-colors"
        >
          Submit All Answers
        </button>
      </div>
      <div className="h-16" />
    </div>
  );
}
