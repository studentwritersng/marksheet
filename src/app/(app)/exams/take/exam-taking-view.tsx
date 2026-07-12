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

interface SubQuestion {
  letter: string;
  text: string;
  marks?: string;
}

function parseSubQuestions(text: string): { stem: string; parts: SubQuestion[] } {
  const regex = /^\s*\(?([a-z])\)\s+(.+)/gim;
  const matches = [...text.matchAll(regex)];
  if (matches.length < 2) return { stem: text, parts: [] };
  const firstIdx = matches[0].index!;
  const stem = text.slice(0, firstIdx).trim();
  const parts: SubQuestion[] = matches.map((m) => ({
    letter: m[1].toLowerCase(),
    text: m[2].trim(),
  }));
  return { stem, parts };
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
  studentName,
  studentPhoto,
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
  studentName: string;
  studentPhoto: string | null;
}) {
  const [attemptId, setAttemptId] = useState(existingAttemptId);
  const [answers, setAnswers] = useState<Record<string, { mcqSelectedOptionId?: string; essayResponseText?: string }>>({});
  const [essayParts, setEssayParts] = useState<Record<string, Record<string, string>>>({});
  const [remaining, setRemaining] = useState(durationMinutes * 60);
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [starting, setStarting] = useState(!existingAttemptId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
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
    const answerList = Object.entries(answers).map(([questionId, value]) => {
      const parts = essayParts[questionId];
      if (parts) {
        const combined = Object.entries(parts)
          .filter(([, v]) => v.trim())
          .map(([l, v]) => `(${l}) ${v}`)
          .join("\n\n");
        return { questionId, essayResponseText: combined || value.essayResponseText };
      }
      return { questionId, ...value };
    });
    const res = await submitExamAction(attemptId, answerList);
    setMsg(res.success ?? res.error ?? "Submitted.");
  }, [attemptId, answers, essayParts]);

  /** Auto-submit when timer hits 0 */
  const hasAutoSubmitted = useRef(false);
  useEffect(() => {
    if (remaining > 0 || submitted || hasAutoSubmitted.current || !attemptId) return;
    hasAutoSubmitted.current = true;
    handleSubmit();
  }, [remaining, submitted, attemptId, handleSubmit]);

  const q = questions[currentIndex];
  const isAnswered = (id: string) =>
    answers[id]?.mcqSelectedOptionId != null ||
    (answers[id]?.essayResponseText?.trim().length ?? 0) > 0 ||
    Object.values(essayParts[id] ?? {}).some((v) => v.trim().length > 0);
  const isSkipped = (id: string) => skipped.has(id) && !isAnswered(id);

  function goTo(index: number) {
    if (!skipped.has(questions[currentIndex].id) && !isAnswered(questions[currentIndex].id)) {
      setSkipped((prev) => new Set(prev).add(questions[currentIndex].id));
    }
    setCurrentIndex(index);
  }

  function goNext() {
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
  }

  function goPrev() {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }

  function handleSkip() {
    setSkipped((prev) => new Set(prev).add(questions[currentIndex].id));
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const initials = studentName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

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
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header bar — student info, timer, submit */}
      <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg p-3 sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {studentPhoto ? (
            <img src={studentPhoto} alt={studentName} className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary font-label-md text-label-md font-semibold shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface truncate">{studentName}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{subjectName} · {assessmentTypeId}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className={`font-headline-sm text-headline-sm ${remaining < 300 ? "text-error" : "text-primary"}`}>
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <button
            onClick={() => setConfirming(true)}
            className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors"
          >
            Submit
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main question area */}
        <div className="flex-1 min-w-0">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-1">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Question {currentIndex + 1} of {questions.length}
              </p>
              <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface font-medium mt-3 mb-4">
              {q.text}
            </p>

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
                      onChange={() => {
                        setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], mcqSelectedOptionId: opt.id } }));
                        setSkipped((prev) => { const n = new Set(prev); n.delete(q.id); return n; });
                      }}
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

            {q.type === "essay" && (() => {
              const { stem, parts } = parseSubQuestions(q.text);
              if (parts.length > 0) {
                return (
                  <div className="space-y-4">
                    {stem && <p className="font-body-md text-body-md text-on-surface font-medium">{stem}</p>}
                    {parts.map((sq) => (
                      <div key={sq.letter}>
                        <p className="font-body-md text-body-md text-on-surface mb-1">
                          ({sq.letter}) {sq.text}
                        </p>
                        <textarea
                          placeholder={`Answer for (${sq.letter})…`}
                          value={essayParts[q.id]?.[sq.letter] ?? ""}
                          onChange={(e) => {
                            setEssayParts((prev) => ({
                              ...prev,
                              [q.id]: { ...(prev[q.id] ?? {}), [sq.letter]: e.target.value },
                            }));
                            if (e.target.value.trim()) {
                              setSkipped((prev) => { const n = new Set(prev); n.delete(q.id); return n; });
                            }
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: {
                                ...prev[q.id],
                                essayResponseText: Object.entries({
                                  ...(essayParts[q.id] ?? {}),
                                  [sq.letter]: e.target.value,
                                })
                                  .filter(([, v]) => v.trim())
                                  .map(([l, v]) => `(${l}) ${v}`)
                                  .join("\n\n"),
                              },
                            }));
                          }}
                          rows={3}
                          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <textarea
                  placeholder="Write your answer here…"
                  value={answers[q.id]?.essayResponseText ?? ""}
                  onChange={(e) => {
                    setAnswers((prev) => ({ ...prev, [q.id]: { ...prev[q.id], essayResponseText: e.target.value } }));
                    if (e.target.value.trim()) {
                      setSkipped((prev) => { const n = new Set(prev); n.delete(q.id); return n; });
                    }
                  }}
                  rows={5}
                  className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors"
                />
              );
            })()}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 font-label-md text-label-md text-primary px-4 py-2 rounded border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              Previous
            </button>
            <button
              onClick={handleSkip}
              className="font-label-md text-label-md text-on-surface-variant px-4 py-2 rounded border border-outline-variant hover:bg-surface-container-low transition-colors"
            >
              Skip
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === questions.length - 1}
              className="flex items-center gap-1 font-label-md text-label-md text-primary px-4 py-2 rounded border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Question navigator */}
        <div className="w-56 shrink-0">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 sticky top-[72px]">
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-3">Questions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((question, i) => {
                let bg = "bg-surface-container-high";
                let text = "text-on-surface";
                if (isAnswered(question.id)) { bg = "bg-secondary-container"; text = "text-on-secondary-container"; }
                else if (isSkipped(question.id)) { bg = "bg-error-container"; text = "text-on-error-container"; }
                return (
                  <button
                    key={question.id}
                    onClick={() => goTo(i)}
                    className={`w-8 h-8 rounded text-xs font-semibold transition-all ${bg} ${text} ${
                      currentIndex === i ? "ring-2 ring-primary ring-offset-1" : ""
                    } hover:opacity-80`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-[11px] text-on-surface-variant">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-secondary-container" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-error-container" />
                <span>Skipped</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-surface-container-high" />
                <span>Unanswered</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                {Object.keys(answers).length} of {questions.length} answered
              </p>
              <div className="mt-1.5 w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full bg-secondary-container transition-all"
                  style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom submit */}
      <div className="text-center">
        <button
          onClick={() => setConfirming(true)}
          className="bg-primary text-on-primary font-label-md text-label-md py-3 px-8 rounded hover:bg-primary-container transition-colors"
        >
          Submit All Answers
        </button>
      </div>

      {/* Confirmation dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirming(false)}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Submit Exam?</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              You have answered {Object.keys(answers).length} of {questions.length} questions. Unanswered questions will be marked as skipped. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="font-label-md text-label-md text-on-surface-variant px-4 py-2 rounded border border-outline-variant hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirming(false); handleSubmit(); }}
                className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded hover:bg-primary-container transition-colors"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
