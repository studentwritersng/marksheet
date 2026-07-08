"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const subjectId = formData.get("subjectId") as string;
  const termId = formData.get("termId") as string;
  const assessmentTypeId = formData.get("assessmentTypeId") as string;
  const durationMinutes = parseInt(formData.get("durationMinutes") as string);
  const classIds = formData.getAll("classIds[]") as string[];
  const questionIds = formData.getAll("questionIds[]") as string[];
  const subAssessmentWeightsRaw = formData.get("subAssessmentWeights") as string;
  let subAssessmentWeights: Prisma.InputJsonValue | undefined;
  if (subAssessmentWeightsRaw) {
    try { subAssessmentWeights = JSON.parse(subAssessmentWeightsRaw) as Prisma.InputJsonValue; } catch { /* ignore */ }
  }

  if (!subjectId || !termId || !assessmentTypeId || !durationMinutes || classIds.length === 0) {
    return { error: "Missing required fields. Select at least one class." };
  }

  // Create exam linked to the first class for backward compat
  const exam = await prisma.exam.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId: classIds[0],
      termId,
      assessmentTypeId,
      durationMinutes,
      shuffleEnabled: true,
      subAssessmentWeights,
      classes: {
        create: classIds.map((cId) => ({ classId: cId })),
      },
    },
  });

  if (questionIds.length > 0) {
    await prisma.examQuestion.createMany({
      data: questionIds.map((qId) => ({ examId: exam.id, questionId: qId })),
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "create", entityType: "exam",
    afterValue: { examId: exam.id, subjectId, classIds, termId, questionCount: questionIds.length } as never,
  });

  revalidatePath("/exams");
  return { success: "Exam created." };
}

export async function updateExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const examId = formData.get("examId") as string;
  const subjectId = formData.get("subjectId") as string;
  const termId = formData.get("termId") as string;
  const assessmentTypeId = formData.get("assessmentTypeId") as string;
  const durationMinutes = parseInt(formData.get("durationMinutes") as string);
  const classIds = formData.getAll("classIds[]") as string[];
  const subAssessmentWeightsRaw = formData.get("subAssessmentWeights") as string;
  let subAssessmentWeights: Prisma.InputJsonValue | undefined;
  if (subAssessmentWeightsRaw) {
    try { subAssessmentWeights = JSON.parse(subAssessmentWeightsRaw) as Prisma.InputJsonValue; } catch { /* ignore */ }
  }

  if (!examId || !subjectId || !termId || !assessmentTypeId || !durationMinutes || classIds.length === 0) {
    return { error: "Missing required fields." };
  }

  await prisma.exam.update({
    where: { id: examId },
    data: {
      subjectId,
      classId: classIds[0],
      termId,
      assessmentTypeId,
      durationMinutes,
      subAssessmentWeights,
      classes: {
        deleteMany: {},
        create: classIds.map((cId) => ({ classId: cId })),
      },
    },
  });

  revalidatePath("/exams");
  return { success: "Exam updated." };
}

export async function deleteExamAction(examId: string): Promise<ActionState> {
  try { await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.exam.delete({ where: { id: examId } });
  revalidatePath("/exams");
  return { success: "Exam deleted." };
}

export async function addQuestionsToExamAction(examId: string, questionIds: string[]): Promise<ActionState> {
  try { await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.examQuestion.createMany({
    data: questionIds.map((qId) => ({ examId, questionId: qId })),
    skipDuplicates: true,
  });

  revalidatePath("/exams");
  return { success: `${questionIds.length} question(s) added.` };
}

export async function removeQuestionFromExamAction(examId: string, questionId: string): Promise<ActionState> {
  try { await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.examQuestion.deleteMany({
    where: { examId, questionId },
  });

  revalidatePath("/exams");
  return { success: "Question removed." };
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
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.examAttempt.updateMany({
    where: { examId, studentId: { in: studentIds } },
    data: { status: "pending_resit" },
  });

  revalidatePath("/exams");
  return { success: `${studentIds.length} student(s) marked for resit.` };
}
