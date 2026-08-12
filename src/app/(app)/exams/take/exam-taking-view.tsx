"use client";

import { useMemo } from "react";
import { ExamTakingView as SharedExamTakingView, type ExamTakingViewProps } from "@exam-rendering/exam-taking-view";
import type { AnswerValue, ExamTakingAdapters } from "@exam-rendering/types";
import { startExamAction, submitExamAction, autoSaveExamAction } from "@/lib/exams/actions";

function toServerAnswers(answers: AnswerValue[]) {
  return answers.map((a) => ({
    questionId: a.questionId,
    mcqSelectedOptionId: a.mcqSelectedOptionId ?? undefined,
    essayResponseText: a.essayResponseText ?? undefined,
  }));
}

export function ExamTakingView(props: Omit<ExamTakingViewProps, "adapters">) {
  const adapters = useMemo<ExamTakingAdapters>(() => {
    return {
      start: async () => {
        const res = await startExamAction(props.examId, props.studentId);
        if (!res.attemptId) throw new Error(res.error ?? "Failed to start exam.");
        return {
          attemptId: res.attemptId,
          endsAt: new Date(Date.now() + props.durationMinutes * 60_000).toISOString(),
        };
      },
      autoSave: async (attemptId, answers) => {
        await autoSaveExamAction(attemptId, toServerAnswers(answers));
      },
      submit: async (attemptId, answers) => {
        const res = await submitExamAction(attemptId, toServerAnswers(answers));
        return res.success ?? res.error ?? "Submitted.";
      },
    };
  }, [props.examId, props.studentId, props.durationMinutes]);

  return <SharedExamTakingView {...props} adapters={adapters} />;
}

export default ExamTakingView;
