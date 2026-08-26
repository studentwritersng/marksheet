import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireStudentSelf } from "../../../homework/auth";
import { prisma } from "@/lib/prisma";
import { TakeHomeworkClient, type TakeHomeworkDTO, type ExistingAttempt } from "./take-client";

export default async function TakeHomeworkPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await requireStudentSelf();
  if (!ctx) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Not authorised.
      </p>
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: ctx.studentId },
    select: { currentClassId: true },
  });
  if (!student?.currentClassId) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        You are not assigned to a class.
      </p>
    );
  }

  const hw = await prisma.homework.findFirst({
    where: { id: params.id, classId: student.currentClassId },
    include: {
      questions: { orderBy: { order: "asc" } },
      class: { select: { name: true } },
      subject: { select: { name: true } },
      term: { select: { name: true } },
    },
  });
  if (!hw || hw.status !== "published") {
    return (
      <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
        <p className="font-body-md text-body-md text-on-surface">
          This homework is not available.
        </p>
        <Link
          href="/student/homework"
          className="mt-4 inline-block bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container"
        >
          Back to homework
        </Link>
      </div>
    );
  }

  const attempt = await prisma.homeworkAttempt.findUnique({
    where: { homeworkId_studentId: { homeworkId: hw.id, studentId: ctx.studentId } },
    include: { answers: true },
  });

  const homeworkDTO: TakeHomeworkDTO = {
    id: hw.id,
    title: hw.title,
    dueDate: hw.dueDate ? hw.dueDate.toISOString() : null,
    questions: hw.questions.map((q) => ({
      id: q.id,
      type: q.type,
      order: q.order,
      marks: Number(q.marks),
      text: q.text,
      options:
        (q.options as unknown as { text: string; isCorrect: boolean }[] | null) ?? undefined,
      rubric: q.rubric ?? undefined,
    })),
  };

  const existingAttempt: ExistingAttempt | null = attempt
    ? {
        id: attempt.id,
        status: attempt.status,
        answers: attempt.answers.map((a) => ({
          homeworkQuestionId: a.homeworkQuestionId,
          response: a.response,
          autoCorrect: a.autoCorrect,
          autoScore: Number(a.autoScore),
        })),
      }
    : null;

  return (
    <div>
      <Link
        href="/student/homework"
        className="font-label-sm text-label-sm text-primary hover:text-primary-container"
      >
        ← Back to homework
      </Link>
      <TakeHomeworkClient homework={homeworkDTO} existingAttempt={existingAttempt} />
    </div>
  );
}
