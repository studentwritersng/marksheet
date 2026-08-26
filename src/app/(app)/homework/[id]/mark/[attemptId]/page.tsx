import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireHomeworkManager } from "../../../auth";
import { prisma } from "@/lib/prisma";
import { McqOption } from "@/lib/homework/grading";
import { MarkingClient } from "./marking-client";

function studentName(firstName: string, middleName: string | null, lastName: string): string {
  return [firstName, middleName, lastName].filter(Boolean).join(" ");
}

export default async function MarkAttemptPage({
  params,
}: {
  params: { id: string; attemptId: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const manager = await requireHomeworkManager();
  if (!manager) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Not authorised.
      </p>
    );
  }

  const attempt = await prisma.homeworkAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      homework: { include: { questions: true } },
      student: true,
      answers: true,
    },
  });

  if (!attempt) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Attempt not found.
      </p>
    );
  }
  if (attempt.homeworkId !== params.id) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Attempt does not belong to this homework.
      </p>
    );
  }
  if (attempt.homework.schoolId !== manager.schoolId) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Not authorised.
      </p>
    );
  }

  const homework = {
    id: attempt.homework.id,
    title: attempt.homework.title,
    questions: attempt.homework.questions
      .map((q) => ({
        id: q.id,
        type: q.type as "mcq" | "essay",
        order: q.order,
        marks: Number(q.marks),
        text: q.text,
        options: (q.options as unknown as McqOption[] | null) ?? undefined,
        rubric: q.rubric ?? undefined,
      }))
      .sort((a, b) => a.order - b.order),
  };

  const answerByQuestion = new Map(
    attempt.answers.map((a) => [a.homeworkQuestionId, a]),
  );

  const answers = homework.questions.map((q) => {
    const a = answerByQuestion.get(q.id);
    return {
      homeworkQuestionId: q.id,
      type: q.type,
      response: a ? (a.response as number | string) : q.type === "mcq" ? -1 : "",
      autoCorrect: a?.autoCorrect ?? null,
      autoScore: a ? Number(a.autoScore) : 0,
      teacherScore: a?.teacherScore != null ? Number(a.teacherScore) : null,
      teacherComment: a?.teacherComment ?? null,
    };
  });

  const attemptDto = {
    id: attempt.id,
    studentName: studentName(
      attempt.student.firstName,
      attempt.student.middleName,
      attempt.student.lastName,
    ),
    status: attempt.status,
    mcqScore: Number(attempt.mcqScore),
    essayScore: attempt.essayScore != null ? Number(attempt.essayScore) : null,
    totalScore: attempt.totalScore != null ? Number(attempt.totalScore) : null,
    percentage: attempt.percentage != null ? Number(attempt.percentage) : null,
    answers,
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Mark submission
          </h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {homework.title} — {attemptDto.studentName}
          </p>
        </div>
        <Link
          href={`/homework/${params.id}/mark`}
          className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
        >
          Back to submissions
        </Link>
      </div>

      <div className="mt-6">
        <MarkingClient homework={homework} attempt={attemptDto} />
      </div>
    </div>
  );
}
