"use client";

import { useState, useTransition } from "react";
import { gradeEssayAnswersAction, reviewEssayScoreAction, bulkAcceptScoresAction } from "@/lib/exams/essay-grading";

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
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [grading, startGrading] = useTransition();
  const [reviewing, startReviewing] = useTransition();
  const [bulking, startBulking] = useTransition();
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

  async function handleBulkAccept() {
    setMsg("");
    startBulking(async () => {
      const res = await bulkAcceptScoresAction(selectedExamId);
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
        <button
          onClick={handleBulkAccept}
          disabled={!selectedExamId || bulking || answers.filter((a) => a.gradingStatus === "ai_complete").length === 0}
          className="bg-secondary-container text-on-secondary-container font-label-md text-label-md py-2 px-4 rounded hover:opacity-90 disabled:opacity-60"
        >
          {bulking ? "Accepting…" : "Accept All AI Scores"}
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

      {/* Answer list — FAQ-style accordion grouped by student */}
      {answers.length === 0 && selectedExamId && (
        <p className="font-body-sm text-body-sm text-on-surface-variant py-8 text-center">
          No essay answers found for this exam.
        </p>
      )}

      {(() => {
        const grouped = answers.reduce((acc: Record<string, any[]>, a: any) => {
          (acc[a.studentName] ??= []).push(a);
          return acc;
        }, {} as Record<string, any[]>);
        return (
          <div className="space-y-2">
            {Object.entries(grouped).map(([studentName, studentAnswers]) => (
              <div key={studentName} className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedStudent(expandedStudent === studentName ? null : studentName)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-container-low transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#002046] flex items-center justify-center text-white font-label-sm text-label-sm shrink-0">
                      {studentName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-label-md text-label-md text-on-surface font-semibold">{studentName}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">{studentAnswers.length} answer{studentAnswers.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${
                      studentAnswers.every((a: any) => a.gradingStatus === "teacher_reviewed")
                        ? "bg-secondary-container text-on-secondary-container"
                        : "bg-surface-variant text-on-surface-variant"
                    }`}>
                      {studentAnswers.every((a: any) => a.gradingStatus === "teacher_reviewed") ? "Reviewed" : "Pending"}
                    </span>
                    <span className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${expandedStudent === studentName ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </button>
                {expandedStudent === studentName && (
                  <div className="border-t border-outline-variant divide-y divide-outline-variant">
                    {studentAnswers.map((a: any) => (
                      <div key={a.id} className="p-5">
                        <div className="mb-3">
                          <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Question</p>
                          <p className="font-body-md text-body-md text-on-surface bg-surface-container-low rounded p-3">{a.questionText}</p>
                        </div>
                        <div className="mb-3">
                          <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Student Response</p>
                          <p className="font-body-md text-body-md text-on-surface bg-surface-container-low rounded p-3 whitespace-pre-wrap">{a.essayResponseText}</p>
                        </div>
                        {a.aiSuggestedScore != null && (
                          <div className="mb-3 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
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
                            {a.rubricPointResults && Array.isArray(a.rubricPointResults) && a.rubricPointResults.length > 0 && (
                              <div className="bg-surface-container-low rounded-lg p-3">
                                <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">Rubric Breakdown</p>
                                <div className="space-y-2">
                                  {a.rubricPointResults.map((rp: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3 text-sm">
                                      <span className={`shrink-0 w-20 text-center rounded px-1 py-0.5 text-xs font-medium ${
                                        rp.status === "met" ? "bg-success-container text-on-success-container" :
                                        rp.status === "partially_met" ? "bg-secondary-container text-on-secondary-container" :
                                        "bg-error-container text-on-error-container"
                                      }`}>
                                        {rp.marks_awarded}/{rp.max_marks_for_point}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-body-sm text-body-sm text-on-surface">{rp.rubric_point}</p>
                                        {rp.evidence && <p className="font-body-xs text-body-xs text-on-surface-variant mt-0.5 italic">"{rp.evidence}"</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
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
                )}
              </div>
            ))}
          </div>
        );
      })()}
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
  const [score, setScore] = useState(aiScore ?? 0);
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
