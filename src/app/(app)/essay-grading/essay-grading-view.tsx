"use client";

import { useState, useTransition } from "react";
import { gradeEssayAnswersAction, reviewEssayScoreAction } from "@/lib/exams/essay-grading";

interface ExamSummary {
  id: string;
  label: string;
}

// We need to fetch answers per exam on the client or server.
// For simplicity, we pass an empty initial list and load on selection.
// Actually, let's use server-side data: load selected exam's answers.

export function EssayGradingView({
  exams,
  pendingCount,
}: {
  exams: ExamSummary[];
  pendingCount: number;
}) {
  const [selectedExamId, setSelectedExamId] = useState("");
  const [answers, setAnswers] = useState<any[]>([]);
  const [grading, startGrading] = useTransition();
  const [reviewing, startReviewing] = useTransition();
  const [msg, setMsg] = useState("");

  async function loadAnswers(examId: string) {
    setSelectedExamId(examId);
    if (!examId) { setAnswers([]); return; }
    const res = await fetch(`/api/exams/${examId}/essay-answers`);
    const data = await res.json();
    setAnswers(data.answers ?? []);
  }

  async function handleGrade() {
    setMsg("");
    startGrading(async () => {
      const res = await gradeEssayAnswersAction(selectedExamId);
      setMsg(res.success ?? res.error ?? "");
      if (res.success) loadAnswers(selectedExamId);
    });
  }

  async function handleReview(answerId: string, score: number) {
    setMsg("");
    startReviewing(async () => {
      const res = await reviewEssayScoreAction(answerId, score);
      setMsg(res.success ?? res.error ?? "");
      if (res.success) loadAnswers(selectedExamId);
    });
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={selectedExamId}
          onChange={(e) => loadAnswers(e.target.value)}
          className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary min-w-[240px]"
        >
          <option value="">Select exam</option>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <button
          onClick={handleGrade}
          disabled={!selectedExamId || grading}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60"
        >
          {grading ? "Grading…" : `Grade with AI (${pendingCount} pending)`}
        </button>
      </div>

      {msg && (
        <p className={`font-body-sm text-body-sm px-3 py-2 rounded ${
          msg.includes("error") || msg.includes("No pending")
            ? "bg-error-container text-on-error-container"
            : "bg-secondary-container text-on-secondary-container"
        }`}>
          {msg}
        </p>
      )}

      {/* Answer list */}
      {answers.length === 0 && selectedExamId && (
        <p className="font-body-sm text-body-sm text-on-surface-variant py-8 text-center">
          No essay answers found for this exam.
        </p>
      )}

      <div className="space-y-4">
        {answers.map((a: any) => (
          <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="font-label-md text-label-md text-on-surface font-semibold">{a.studentName}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{a.subject}</p>
              </div>
              <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${
                a.gradingStatus === "teacher_reviewed"
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-surface-variant text-on-surface-variant"
              }`}>
                {a.gradingStatus === "teacher_reviewed" ? "Reviewed" : "AI Graded"}
              </span>
            </div>

            <div className="mb-3">
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Question</p>
              <p className="font-body-md text-body-md text-on-surface bg-surface-container-low rounded p-3">{a.questionText}</p>
            </div>

            <div className="mb-3">
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Student Response</p>
              <p className="font-body-md text-body-md text-on-surface bg-surface-container-low rounded p-3 whitespace-pre-wrap">{a.essayResponseText}</p>
            </div>

            {a.aiSuggestedScore != null && (
              <div className="mb-3 flex items-center gap-4">
                <div className="bg-surface-container rounded-lg p-3 flex items-center gap-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">AI Score:</span>
                  <span className="font-headline-md text-headline-md text-primary">{a.aiSuggestedScore}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">/ {a.maxMarks}</span>
                </div>
                {a.aiReasoning && (
                  <div className="flex-1">
                    <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">AI Reasoning</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{a.aiReasoning}</p>
                  </div>
                )}
              </div>
            )}

            {a.gradingStatus === "ai_complete" && (
              <ReviewForm
                answerId={a.id}
                aiScore={a.aiSuggestedScore}
                maxMarks={a.maxMarks}
                onReview={handleReview}
                reviewing={reviewing}
              />
            )}

            {a.gradingStatus === "teacher_reviewed" && (
              <p className="font-label-md text-label-md text-on-surface">
                Final score: <span className="font-bold">{a.finalScore}/{a.maxMarks}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewForm({
  answerId,
  aiScore,
  maxMarks,
  onReview,
  reviewing,
}: {
  answerId: string;
  aiScore: number;
  maxMarks: number;
  onReview: (id: string, score: number) => void;
  reviewing: boolean;
}) {
  const [score, setScore] = useState(aiScore);
  return (
    <div className="flex items-center gap-3 pt-3 border-t border-outline-variant">
      <label className="font-label-sm text-label-sm text-on-surface-variant">Override score:</label>
      <input
        type="number"
        min={0}
        max={maxMarks}
        step={0.5}
        value={score}
        onChange={(e) => setScore(parseFloat(e.target.value))}
        className="w-20 border border-outline-variant rounded p-2 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
      />
      <span className="font-body-sm text-body-sm text-on-surface-variant">/ {maxMarks}</span>
      <button
        onClick={() => onReview(answerId, score)}
        disabled={reviewing}
        className="bg-primary text-on-primary font-label-md text-label-md py-1.5 px-3 rounded hover:bg-primary-container disabled:opacity-60"
      >
        {reviewing ? "Saving…" : "Accept Score"}
      </button>
    </div>
  );
}
