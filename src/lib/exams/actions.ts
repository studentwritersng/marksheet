"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const subjectId = formData.get("subjectId") as string;
  const classId = formData.get("classId") as string;
  const termId = formData.get("termId") as string;
  const assessmentTypeId = formData.get("assessmentTypeId") as string;
  const durationMinutes = parseInt(formData.get("durationMinutes") as string);
  const questionIds = formData.getAll("questionIds[]") as string[];

  if (!subjectId || !classId || !termId || !assessmentTypeId || !durationMinutes) {
    return { error: "Missing required fields." };
  }

  const exam = await prisma.exam.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId,
      termId,
      assessmentTypeId,
      durationMinutes,
      shuffleEnabled: true,
    },
  });

  if (questionIds.length > 0) {
    await prisma.examQuestion.createMany({
      data: questionIds.map((qId) => ({ examId: exam.id, questionId: qId })),
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "exam",
    afterValue: { examId: exam.id, subjectId, classId, termId, questionCount: questionIds.length } as never,
  });

  revalidatePath("/exams");
  return { success: "Exam created." };
}

export async function submitExamAction(attemptId: string, answers: { questionId: string; mcqSelectedOptionId?: string; essayResponseText?: string }[]): Promise<ActionState> {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: { include: { examQuestions: { include: { question: { include: { mcqOptions: true } } } } } } },
  });
  if (!attempt || attempt.status !== "in_progress") return { error: "Invalid attempt." };

  let totalScore = 0;
  let maxScore = 0;

  for (const answer of answers) {
    const eq = attempt.exam.examQuestions.find((eq) => eq.questionId === answer.questionId);
    if (!eq) continue;

    const question = eq.question;
    maxScore += question.marks;

    let gradedScore: number | null = null;
    let gradingStatus = "ai_pending";

    if (question.type === "mcq" && answer.mcqSelectedOptionId) {
      const correct = question.mcqOptions.find((o) => o.id === answer.mcqSelectedOptionId)?.isCorrect ?? false;
      gradedScore = correct ? question.marks : 0;
      gradingStatus = "teacher_reviewed";
      if (correct) totalScore += question.marks;
    }

    await prisma.studentAnswer.create({
      data: {
        attemptId,
        questionId: answer.questionId,
        mcqSelectedOptionId: answer.mcqSelectedOptionId ?? null,
        essayResponseText: answer.essayResponseText ?? null,
        gradedScore,
        gradingStatus,
      },
    });
  }

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { status: "submitted", submittedAt: new Date() },
  });

  revalidatePath(`/exams/take/${attempt.examId}`);
  return { success: `Exam submitted. MCQ score: ${totalScore}/${maxScore}` };
}

export async function startExamAction(examId: string, studentId: string): Promise<ActionState & { attemptId?: string }> {
  const existing = await prisma.examAttempt.findFirst({
    where: { examId, studentId, status: "in_progress" },
  });
  if (existing) return { attemptId: existing.id };

  const attempt = await prisma.examAttempt.create({
    data: { examId, studentId },
  });
  return { attemptId: attempt.id };
}

export async function assignResitAction(examId: string, studentIds: string[]): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  await prisma.examAttempt.updateMany({
    where: { examId, studentId: { in: studentIds } },
    data: { status: "pending_resit" },
  });

  revalidatePath("/exams");
  return { success: `${studentIds.length} student(s) marked for resit.` };
}
