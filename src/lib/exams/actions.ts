"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireSchoolAdmin, requireSchoolStaff, requireExamReviewer, canReviewExams, canPublishExams, canAccessSubject } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { notifyStudents } from "@/lib/notifications/actions";
import { hookExamScheduled } from "@/lib/notifications/event-hooks";
import type { Prisma } from "@prisma/client";

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Load an exam within the caller's school, scoping staff to exams whose subject
 * they teach (or that they created). Admins always pass.
 */
async function loadScopedExam(
  schoolId: string,
  perms: Awaited<ReturnType<typeof requireSchoolStaff>>["perms"],
  staffId: string | null,
  examId: string,
): Promise<{ id: string; subjectId: string; status: string } | null> {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, subjectId: true, createdBy: true, status: true },
  });
  if (!exam) return null;
  if (canAccessSubject(perms, exam.subjectId) || (staffId && exam.createdBy === staffId)) {
    return { id: exam.id, subjectId: exam.subjectId, status: exam.status };
  }
  return null;
}

export async function createExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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

  if (!canAccessSubject(ctx.perms, subjectId)) {
    return { error: "Not authorised for this subject." };
  }

  // Verify every referenced entity belongs to the caller's school.
  const [subject, term, assessmentType, classCount] = await Promise.all([
    prisma.subject.findFirst({ where: { id: subjectId, schoolId: ctx.schoolId }, select: { id: true } }),
    prisma.term.findFirst({ where: { id: termId, session: { schoolId: ctx.schoolId } }, select: { id: true } }),
    prisma.assessmentType.findFirst({ where: { code: assessmentTypeId, schoolId: ctx.schoolId }, select: { id: true } }),
    prisma.class.count({ where: { id: { in: classIds }, schoolId: ctx.schoolId } }),
  ]);
  if (!subject) return { error: "Subject not found." };
  if (!term) return { error: "Term not found." };
  if (!assessmentType) return { error: "Assessment type not found." };
  if (classCount !== classIds.length) return { error: "One or more classes are invalid." };

  const exam = await prisma.exam.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId: classIds[0],
      termId,
      assessmentTypeId,
      durationMinutes,
      shuffleEnabled: true,
      status: "draft",
      createdBy: ctx.user.staffId ?? undefined,
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
  return { success: "Exam created. Add questions and submit for review when ready." };
}

export async function updateExamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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

  const existing = await loadScopedExam(ctx.schoolId, ctx.perms, ctx.user.staffId ?? null, examId);
  if (!existing) return { error: "Exam not found or not assigned to you." };
  if (!canAccessSubject(ctx.perms, subjectId)) {
    return { error: "Not authorised for this subject." };
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
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  try {
    const exam = await loadScopedExam(ctx.schoolId, ctx.perms, ctx.user.staffId ?? null, examId);
    if (!exam) return { error: "Exam not found or not assigned to you." };
    await prisma.exam.delete({ where: { id: examId } });
  } catch (e: any) {
    return { error: e.message ?? "Failed to delete exam." };
  }
  revalidatePath("/exams");
  return { success: "Exam deleted." };
}

export async function toggleExamStatusAction(examId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const exam = await loadScopedExam(ctx.schoolId, ctx.perms, ctx.user.staffId ?? null, examId);
  if (!exam) return { error: "Exam not found or not assigned to you." };

  // Enforce state machine transitions
  let nextStatus: string | null = null;
  switch (exam.status) {
    case "draft":
      nextStatus = "pending_review";
      break;
    case "pending_review":
      if (canReviewExams(ctx.perms)) {
        nextStatus = "approved";
      } else {
        return { error: "Only an exam officer or admin can approve an exam from review." };
      }
      break;
    case "approved":
      if (canPublishExams(ctx.perms)) {
        nextStatus = "published";
      } else {
        return { error: "Only an admin can publish an exam." };
      }
      break;
    case "rejected":
      nextStatus = "draft";
      break;
    case "published":
      if (canPublishExams(ctx.perms)) {
        nextStatus = "draft";
      } else {
        return { error: "Only an admin can unpublish an exam." };
      }
      break;
    default:
      return { error: `Cannot toggle exam in status: ${exam.status}` };
  }

  if (!nextStatus) return { error: "Invalid transition." };

  await prisma.exam.update({
    where: { id: examId },
    data: {
      status: nextStatus as any,
      ...(nextStatus === "pending_review" ? { submittedForReviewAt: new Date() } : {}),
      ...(nextStatus === "approved" || nextStatus === "rejected" ? { reviewedBy: ctx.user.staffId, reviewedAt: new Date() } : {}),
      updatedAt: new Date(),
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "update", entityType: "exam",
    afterValue: { examId, status: nextStatus } as never,
  });

  revalidatePath("/exams");
  return { success: `Exam ${nextStatus}.` };
}

export async function submitExamForReviewAction(examId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const exam = await loadScopedExam(ctx.schoolId, ctx.perms, ctx.user.staffId ?? null, examId);
  if (!exam) return { error: "Exam not found or not assigned to you." };
  if (exam.status !== "draft" && exam.status !== "rejected") {
    return { error: "Only draft or rejected exams can be submitted for review." };
  }
  if (!canPublishExams(ctx.perms)) {
    const createdBy = await prisma.exam.findFirst({
      where: { id: examId, schoolId: ctx.schoolId },
      select: { createdBy: true },
    });
    if (!createdBy?.createdBy || createdBy.createdBy !== ctx.user.staffId) {
      return { error: "Only the creator or an admin can submit this exam for review." };
    }
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { status: "pending_review", submittedForReviewAt: new Date(), updatedAt: new Date() },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "update", entityType: "exam",
    afterValue: { examId, status: "pending_review" } as never,
  });

  revalidatePath("/exams");
  revalidatePath("/exams/review");
  return { success: "Exam submitted for review." };
}

export async function approveExamAction(examId: string): Promise<ActionState> {
  const ctx = await requireExamReviewer();
  await guardActiveLicense(ctx.schoolId);

  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: ctx.schoolId } });
  if (!exam) return { error: "Exam not found." };
  if (exam.status !== "pending_review") return { error: "Only exams pending review can be approved." };

  await prisma.exam.update({
    where: { id: examId },
    data: { status: "approved", reviewedBy: ctx.user.staffId, reviewedAt: new Date(), updatedAt: new Date() },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "approve", entityType: "exam",
    afterValue: { examId } as never,
  });

  revalidatePath("/exams");
  revalidatePath("/exams/review");
  return { success: "Exam approved. An admin can now publish it." };
}

export async function rejectExamAction(examId: string, comment: string): Promise<ActionState> {
  const ctx = await requireExamReviewer();
  await guardActiveLicense(ctx.schoolId);

  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: ctx.schoolId } });
  if (!exam) return { error: "Exam not found." };
  if (exam.status !== "pending_review") return { error: "Only exams pending review can be rejected." };

  if (!comment || !comment.trim()) {
    return { error: "Please provide a reason for rejection." };
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { status: "rejected", reviewComment: comment.trim(), reviewedBy: ctx.user.staffId, reviewedAt: new Date(), updatedAt: new Date() },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "reject", entityType: "exam",
    afterValue: { examId, comment: comment.trim() } as never,
  });

  revalidatePath("/exams");
  revalidatePath("/exams/review");
  return { success: "Exam rejected. The creator can edit and resubmit." };
}

export async function isExamPublishedAction(examId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId: user.schoolId ?? undefined },
    select: { status: true },
  });
  return exam?.status === "published";
}

export async function addQuestionsToExamAction(examId: string, questionIds: string[]): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const exam = await loadScopedExam(ctx.schoolId, ctx.perms, ctx.user.staffId ?? null, examId);
  if (!exam) return { error: "Exam not found or not assigned to you." };

  await prisma.examQuestion.createMany({
    data: questionIds.map((qId) => ({ examId, questionId: qId })),
    skipDuplicates: true,
  });

  revalidatePath("/exams");
  return { success: `${questionIds.length} question(s) added.` };
}

export async function removeQuestionFromExamAction(examId: string, questionId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const exam = await loadScopedExam(ctx.schoolId, ctx.perms, ctx.user.staffId ?? null, examId);
  if (!exam) return { error: "Exam not found or not assigned to you." };

  await prisma.examQuestion.deleteMany({
    where: { examId, questionId },
  });

  revalidatePath("/exams");
  return { success: "Question removed." };
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function startExamAction(examId: string, studentId: string): Promise<ActionState & { attemptId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authorised." };

  // The caller must own the student record — a student may only start an
  // exam for themselves; staff may only start for students in their school.
  const student = await prisma.student.findFirst({
    where: { id: studentId },
    select: { id: true, schoolId: true, userId: true },
  });
  if (!student) return { error: "Student not found." };
  if (student.schoolId !== user.schoolId) return { error: "Not authorised." };
  if (user.role === "student" && student.userId !== user.userId) return { error: "Not authorised." };

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { status: true, shuffleEnabled: true, durationMinutes: true, schoolId: true, termId: true },
  });
  if (!exam || exam.schoolId !== user.schoolId || exam.status !== "published") {
    return { error: "This exam is not available yet." };
  }

  // Fee gate check
  const { checkExamFeeGate } = await import("@/lib/fees/gate");
  const feeBlock = await checkExamFeeGate(exam.schoolId, studentId, exam.termId);
  if (feeBlock) return { error: feeBlock };

  const existing = await prisma.examAttempt.findFirst({
    where: { examId, studentId, status: "in_progress" },
  });
  if (existing) return { attemptId: existing.id };

  let shuffledQuestionIds: string[] | null = null;
  let shuffledOptionOrder: Record<string, string[]> | null = null;

  if (exam.shuffleEnabled) {
    const examQuestions = await prisma.examQuestion.findMany({
      where: { examId },
      include: {
        question: {
          include: {
            mcqOptions: { select: { id: true } },
            group: { select: { id: true, internallyShufflable: true } },
          },
        },
      },
      orderBy: { questionId: "asc" },
    });

    // Group questions by questionGroupId for group-aware shuffling
    const groups = new Map<string, string[]>();
    const standalone: string[] = [];

    for (const eq of examQuestions) {
      const gid = eq.question.questionGroupId;
      if (gid) {
        const list = groups.get(gid) || [];
        list.push(eq.questionId);
        groups.set(gid, list);
      } else {
        standalone.push(eq.questionId);
      }
    }

    // Each group or standalone question is one shuffle item
    const items: string[][] = standalone.map((id) => [id]);
    for (const [, ids] of groups) items.push(ids);

    // Shuffle items
    const shuffledItems = shuffleArray(items);
    shuffledQuestionIds = shuffledItems.flat();

    // Shuffle MCQ options per question
    const optOrder: Record<string, string[]> = {};
    for (const eq of examQuestions) {
      if (eq.question.mcqOptions.length > 0) {
        optOrder[eq.questionId] = shuffleArray(eq.question.mcqOptions.map((o) => o.id));
      }
    }
    shuffledOptionOrder = optOrder;
  }

  const endsAt = new Date(Date.now() + exam.durationMinutes * 60_000);

  const attempt = await prisma.examAttempt.create({
    data: {
      examId,
      studentId,
      endsAt,
      shuffledQuestionIds: shuffledQuestionIds ?? undefined,
      shuffledOptionOrder: shuffledOptionOrder ?? undefined,
    },
  });
  return { attemptId: attempt.id };
}

export async function submitExamAction(attemptId: string, answers: { questionId: string; mcqSelectedOptionId?: string; essayResponseText?: string }[]): Promise<ActionState & { mcqScore?: number; maxMcqScore?: number }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authorised." };

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      student: { select: { schoolId: true, userId: true } },
      exam: {
        include: {
          examQuestions: {
            include: {
              question: {
                include: { mcqOptions: { select: { id: true, isCorrect: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!attempt || attempt.status !== "in_progress") return { error: "Invalid attempt." };

  // The caller must own this attempt — a student may only submit their own
  // attempt; staff may only submit for students in their school.
  if (!attempt.student || attempt.student.schoolId !== user.schoolId) {
    return { error: "Not authorised." };
  }
  if (user.role === "student" && attempt.student.userId !== user.userId) {
    return { error: "Not authorised." };
  }

  // Check server-side timer
  const now = new Date();
  const isOverdue = attempt.endsAt && now > attempt.endsAt;

  // Delete any existing saved answers for this attempt (from auto-saves)
  await prisma.studentAnswer.deleteMany({ where: { attemptId } });

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
    data: { status: "submitted", submittedAt: now },
  });

  revalidatePath(`/exams/take/${attempt.examId}`);
  return {
    success: isOverdue
      ? `Auto-submitted. MCQ score: ${totalScore}/${maxScore}`
      : `Exam submitted. MCQ score: ${totalScore}/${maxScore}`,
    mcqScore: totalScore,
    maxMcqScore: maxScore,
  };
}

export async function autoSaveExamAction(
  attemptId: string,
  answers: { questionId: string; mcqSelectedOptionId?: string; essayResponseText?: string }[],
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authorised." };

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, status: true, endsAt: true, studentId: true },
  });
  if (!attempt || attempt.status !== "in_progress") return { error: "Invalid attempt." };

  // The caller must own this attempt (same rules as submit).
  const owner = await prisma.student.findUnique({
    where: { id: attempt.studentId },
    select: { schoolId: true, userId: true },
  });
  if (!owner || owner.schoolId !== user.schoolId) return { error: "Not authorised." };
  if (user.role === "student" && owner.userId !== user.userId) return { error: "Not authorised." };

  // Check if timer expired
  if (attempt.endsAt && new Date() > attempt.endsAt) {
    return { error: "Time is up. Please submit your exam." };
  }

  // Delete existing saved answers and re-insert (simpler than upsert per row)
  await prisma.studentAnswer.deleteMany({ where: { attemptId } });

  for (const answer of answers) {
    const question = await prisma.question.findUnique({
      where: { id: answer.questionId },
      select: { id: true, type: true },
    });
    if (!question) continue;

    let gradedScore: number | null = null;
    let gradingStatus = "ai_pending";

    if (question.type === "mcq" && answer.mcqSelectedOptionId) {
      const opt = await prisma.mcqOption.findUnique({
        where: { id: answer.mcqSelectedOptionId },
        select: { isCorrect: true, questionId: true },
      });
      if (opt && opt.questionId === answer.questionId) {
        gradedScore = opt.isCorrect ? 1 : 0;
        gradingStatus = "teacher_reviewed";
      }
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

  return { success: "Saved." };
}

export async function assignResitAction(examId: string, studentIds: string[]): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: ctx.schoolId }, select: { id: true } });
  if (!exam) return { error: "Exam not found." };

  await prisma.examAttempt.updateMany({
    where: { examId, studentId: { in: studentIds } },
    data: { status: "pending_resit" },
  });

  revalidatePath("/exams");
  return { success: `${studentIds.length} student(s) marked for resit.` };
}

// ---------------------------------------------------------------------------
// Manual score entry — teacher enters raw scores for a sub-assessment component
// (Practical, offline Theory/Objective paper) or overrides a platform score.
// ---------------------------------------------------------------------------

export interface ManualScoreInput {
  studentId: string;
  subAssessmentTypeCode: string; // "OBJ" | "THEORY" | "PRC"
  rawScore: number;
  maxRawScore: number;
  note?: string;
}

export async function upsertManualScoresAction(
  examId: string,
  scores: ManualScoreInput[],
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: ctx.schoolId } });
  if (!exam) return { error: "Exam not found." };

  if (scores.length === 0) return { error: "No scores provided." };

  for (const s of scores) {
    if (s.rawScore < 0) return { error: `Raw score cannot be negative (student ${s.studentId}).` };
    if (s.maxRawScore <= 0) return { error: `Max raw score must be greater than zero.` };
    if (s.rawScore > s.maxRawScore) return { error: `Score ${s.rawScore} exceeds max ${s.maxRawScore}.` };
  }

  await prisma.$transaction(
    scores.map((s) =>
      prisma.manualScore.upsert({
        where: {
          examId_studentId_subAssessmentTypeCode: {
            examId,
            studentId: s.studentId,
            subAssessmentTypeCode: s.subAssessmentTypeCode,
          },
        },
        update: {
          rawScore: s.rawScore,
          maxRawScore: s.maxRawScore,
          note: s.note ?? null,
          enteredBy: ctx.user.userId,
        },
        create: {
          examId,
          studentId: s.studentId,
          subAssessmentTypeCode: s.subAssessmentTypeCode,
          rawScore: s.rawScore,
          maxRawScore: s.maxRawScore,
          note: s.note ?? null,
          enteredBy: ctx.user.userId,
        },
      }),
    ),
  );

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "manual_score",
    afterValue: { examId, count: scores.length } as never,
  });

  revalidatePath(`/exams/${examId}`);
  revalidatePath("/results");
  return { success: `${scores.length} score(s) saved.` };
}

export async function getExamManualScoresAction(
  examId: string,
): Promise<{ studentId: string; subAssessmentTypeCode: string; rawScore: number; maxRawScore: number; note: string | null }[]> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return []; }

  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: ctx.schoolId } });
  if (!exam) return [];

  const scores = await prisma.manualScore.findMany({
    where: { examId },
    select: { studentId: true, subAssessmentTypeCode: true, rawScore: true, maxRawScore: true, note: true },
  });
  return scores;
}

export async function getExamStudentsAction(
  examId: string,
): Promise<{ id: string; admissionNumber: string; fullName: string }[]> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return []; }

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId: ctx.schoolId },
    include: { classes: { include: { class: true } } },
  });
  if (!exam) return [];

  const classIds = exam.classes.map((ec) => ec.classId);
  if (classIds.length === 0) return [];

  const students = await prisma.student.findMany({
    where: { schoolId: ctx.schoolId, currentClassId: { in: classIds }, status: "active" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, admissionNumber: true, firstName: true, lastName: true },
  });

  return students.map((s) => ({
    id: s.id,
    admissionNumber: s.admissionNumber,
    fullName: `${s.lastName}, ${s.firstName}`,
  }));
}
