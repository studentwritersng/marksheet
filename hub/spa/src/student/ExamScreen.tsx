import { useMemo } from "react";
import { ExamTakingView } from "@exam-rendering/exam-taking-view";
import type { AnswerValue, ExamTakingAdapters } from "@exam-rendering/types";
import {
  autoSaveAttempt,
  startAttempt,
  submitAttempt,
  tickAttempt,
  type AttemptInfo,
  type OpenSession,
  type SignInSuccess,
} from "../api";

function toAttemptData(attempt: AttemptInfo | null) {
  if (!attempt) return null;
  return {
    status: attempt.submittedAt ? ("submitted" as const) : ("started" as const),
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    endsAt: attempt.endsAt,
    shuffledQuestionIds: attempt.shuffledQuestionIds,
    shuffledOptionOrder: attempt.shuffledOptionOrder,
    lastAutosaveAt: attempt.lastAutosaveAt,
  };
}

export default function ExamScreen({
  session,
  signIn,
}: {
  session: OpenSession;
  signIn: SignInSuccess;
}) {
  const adapters = useMemo<ExamTakingAdapters>(() => {
    return {
      async start() {
        const result = await startAttempt(session.bundleId, signIn.student.studentId);
        if (!result.ok) throw new Error(result.error);
        const a = result.attempt;
        return {
          attemptId: a.hubAttemptId,
          endsAt: a.endsAt!,
          shuffledQuestionIds: a.shuffledQuestionIds,
          shuffledOptionOrder: a.shuffledOptionOrder,
        };
      },
      async tick(attemptId) {
        return tickAttempt(attemptId);
      },
      async autoSave(attemptId, answers) {
        const mapped = answers.map((a: AnswerValue) => ({
          questionId: a.questionId,
          mcqSelectedOptionId: a.mcqSelectedOptionId ?? null,
          essayResponseText: a.essayResponseText ?? null,
          clientTimestamp: a.clientTimestamp,
          localChecksum: a.localChecksum ?? null,
        }));
        await autoSaveAttempt(attemptId, mapped);
      },
      async submit(attemptId, answers) {
        const mapped = answers.map((a: AnswerValue) => ({
          questionId: a.questionId,
          mcqSelectedOptionId: a.mcqSelectedOptionId ?? null,
          essayResponseText: a.essayResponseText ?? null,
          clientTimestamp: a.clientTimestamp,
          localChecksum: a.localChecksum ?? null,
        }));
        const result = await submitAttempt(attemptId, mapped);
        if (!result.ok) throw new Error(result.error);
        return result.message;
      },
    };
  }, [session.bundleId, signIn.student.studentId]);

  return (
    <div className="min-h-screen bg-surface">
      <ExamTakingView
        examId={session.bundleId}
        studentId={signIn.student.studentId}
        attemptId={signIn.attempt?.hubAttemptId}
        attemptData={toAttemptData(signIn.attempt)}
        subjectName={signIn.exam.subjectName}
        className={signIn.exam.classNames.join(", ")}
        assessmentTypeId="Offline"
        durationMinutes={session.durationMinutes}
        termName={signIn.exam.termLabel}
        questions={signIn.questions}
        savedAnswers={signIn.savedAnswers}
        studentName={signIn.student.studentName}
        studentPhoto={signIn.student.studentPhoto}
        backHref="/"
        adapters={adapters}
      />
    </div>
  );
}
