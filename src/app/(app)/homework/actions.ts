"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { validateQuestionCounts, autoGradeMcq, computeTotals, type McqOption } from "@/lib/homework/grading";
import { recordAudit } from "@/lib/audit";
import { guardActiveLicense } from "@/lib/license";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireHomeworkManager, requireStudentSelf } from "./auth";
import { createNotification } from "@/lib/notifications/actions";

export interface ActionState {
  error?: string;
  success?: string;
}

const QuestionSchema = z.object({
  type: z.enum(["mcq", "essay"]),
  text: z.string().min(1),
  marks: z.coerce.number().min(0),
  order: z.number().int(),
  options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).optional(),
  rubric: z.any().optional(),
  sourceQuestionId: z.string().optional(),
});

export async function createHomeworkAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireHomeworkManager();
  if (!ctx) return { error: "Not authorised." };
  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }
  const classId = String(fd.get("classId") ?? "");
  const subjectId = String(fd.get("subjectId") ?? "");
  const termId = String(fd.get("termId") ?? "");
  const title = String(fd.get("title") ?? "").trim();
  const instructions = String(fd.get("instructions") ?? "").trim() || null;
  const dueDate = String(fd.get("dueDate") ?? "") || null;
  let questions: z.infer<typeof QuestionSchema>[] = [];
  try {
    questions = z.array(QuestionSchema).parse(JSON.parse(String(fd.get("questions") ?? "[]")));
  } catch {
    return { error: "Invalid question data." };
  }
  const mcq = questions.filter((q) => q.type === "mcq").length;
  const essay = questions.filter((q) => q.type === "essay").length;
  try {
    validateQuestionCounts(mcq, essay);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!classId || !subjectId || !termId || !title) return { error: "Class, subject, term and title are required." };
  const homework = await prisma.homework.create({
    data: {
      schoolId: ctx.schoolId,
      classId,
      subjectId,
      termId,
      title,
      instructions,
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: ctx.user.userId,
      questions: {
        create: questions.map((q) => ({
          type: q.type,
          text: q.text,
          marks: q.marks,
          order: q.order,
          options: q.options ?? undefined,
          rubric: q.rubric ?? undefined,
          sourceQuestionId: q.sourceQuestionId ?? null,
        })),
      },
    },
  });
  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "homework",
    entityId: homework.id,
    afterValue: { title, mcq, essay } as never,
  });
  revalidatePath("/homework");
  return { success: "Homework created." };
}

export interface BankQuestionDTO {
  id: string;
  text: string;
  type: "mcq" | "essay";
  marks: number;
  options?: { text: string; isCorrect: boolean }[];
  rubric?: { modelAnswer?: string; rubricPoints?: unknown };
}

export async function searchBankQuestionsAction(
  subjectId: string,
  classLevel: string,
  type: "mcq" | "essay" | "all",
): Promise<{ questions: BankQuestionDTO[]; error?: string }> {
  const ctx = await requireHomeworkManager();
  if (!ctx) return { questions: [], error: "Not authorised." };
  if (!subjectId) return { questions: [], error: "Subject is required." };
  try {
    const rows = await prisma.question.findMany({
      where: {
        schoolId: ctx.schoolId,
        subjectId,
        ...(classLevel ? { classLevel } : {}),
        ...(type !== "all" ? { type } : {}),
      },
      include: { mcqOptions: true, essaySpec: true },
      orderBy: { createdAt: "desc" },
    });
    const questions: BankQuestionDTO[] = rows.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      marks: Number(q.marks),
      options: q.mcqOptions?.map((o) => ({ text: o.optionText, isCorrect: o.isCorrect })),
      rubric: q.essaySpec
        ? { modelAnswer: q.essaySpec.modelAnswer, rubricPoints: q.essaySpec.rubricPoints }
        : undefined,
    }));
    return { questions };
  } catch {
    return { questions: [], error: "Could not load the question bank." };
  }
}

export async function publishHomeworkAction(id: string): Promise<ActionState> {
  const ctx = await requireHomeworkManager();
  if (!ctx) return { error: "Not authorised." };
  const hw = await prisma.homework.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!hw) return { error: "Homework not found." };
  await prisma.homework.update({ where: { id }, data: { status: "published" } });
  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "homework",
    entityId: id,
    afterValue: { status: "published" } as never,
  });
  revalidatePath("/homework");
  return { success: "Homework published." };
}

async function upsertHomeworkAnswer(args: {
  attemptId: string;
  homeworkQuestionId: string;
  type: "mcq" | "essay";
  response: unknown;
  autoCorrect: boolean | null;
  autoScore: number;
}): Promise<void> {
  const existing = await prisma.homeworkAnswer.findFirst({
    where: { attemptId: args.attemptId, homeworkQuestionId: args.homeworkQuestionId },
  });
  const data = {
    type: args.type,
    response: args.response as Prisma.InputJsonValue,
    autoCorrect: args.autoCorrect,
    autoScore: args.autoScore,
  };
  if (existing) {
    await prisma.homeworkAnswer.update({ where: { id: existing.id }, data });
  } else {
    await prisma.homeworkAnswer.create({
      data: {
        attemptId: args.attemptId,
        homeworkQuestionId: args.homeworkQuestionId,
        ...data,
      },
    });
  }
}

export async function submitHomeworkAction(
  homeworkId: string,
  answers: { homeworkQuestionId: string; response: unknown }[],
): Promise<ActionState> {
  const ctx = await requireStudentSelf();
  if (!ctx) return { error: "Not authorised" };
  const { studentId, schoolId } = ctx;

  const hw = await prisma.homework.findFirst({
    where: { id: homeworkId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!hw) return { error: "Not available" };
  if (hw.status !== "published") return { error: "Not available" };
  if (hw.dueDate && hw.dueDate < new Date()) return { error: "Past due" };

  const existing = await prisma.homeworkAttempt.findUnique({
    where: { homeworkId_studentId: { homeworkId, studentId } },
  });
  if (existing && (existing.status === "submitted" || existing.status === "graded")) {
    return { error: "Already submitted" };
  }

  const attempt = await prisma.homeworkAttempt.upsert({
    where: { homeworkId_studentId: { homeworkId, studentId } },
    create: {
      homeworkId,
      studentId,
      schoolId,
      classId: hw.classId,
      termId: hw.termId,
      status: "submitted",
      submittedAt: new Date(),
    },
    update: {
      status: "submitted",
      submittedAt: new Date(),
    },
  });

  let mcqScore = 0;
  for (const ans of answers) {
    const q = hw.questions.find((x) => x.id === ans.homeworkQuestionId);
    if (!q) continue;
    if (q.type === "mcq") {
      const options = (q.options as unknown as McqOption[] | null) ?? [];
      const selected =
        typeof ans.response === "number"
          ? ans.response
          : ans.response === null
            ? null
            : Number(ans.response);
      const { correct, scoreFactor } = autoGradeMcq(selected, options);
      const autoScore = Math.round(scoreFactor * Number(q.marks));
      mcqScore += autoScore;
      await upsertHomeworkAnswer({
        attemptId: attempt.id,
        homeworkQuestionId: q.id,
        type: "mcq",
        response: ans.response,
        autoCorrect: correct,
        autoScore,
      });
    } else {
      await upsertHomeworkAnswer({
        attemptId: attempt.id,
        homeworkQuestionId: q.id,
        type: "essay",
        response: ans.response,
        autoCorrect: null,
        autoScore: 0,
      });
    }
  }

  const totalMarks = hw.questions.reduce((sum, q) => sum + Number(q.marks), 0);
  const { totalScore, percentage } = computeTotals(mcqScore, 0, totalMarks);
  await prisma.homeworkAttempt.update({
    where: { id: attempt.id },
    data: { mcqScore, totalScore, percentage, status: "submitted" },
  });

  revalidatePath(`/student/homework/${homeworkId}`);
  return { success: "Homework submitted." };
}

export async function markHomeworkAction(
  attemptId: string,
  scores: { homeworkQuestionId: string; teacherScore: number; teacherComment?: string }[],
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const ctx = await requireHomeworkManager();
  if (!ctx) return { error: "Not authorised" };
  const { schoolId } = ctx;

  const attempt = await prisma.homeworkAttempt.findUnique({
    where: { id: attemptId },
    include: {
      homework: { include: { questions: true } },
      student: true,
    },
  });
  if (!attempt) return { error: "Attempt not found" };

  const validIds = new Set(attempt.homework.questions.map((q) => q.id));
  let essayScore = 0;
  for (const entry of scores) {
    if (!validIds.has(entry.homeworkQuestionId)) continue;
    essayScore += entry.teacherScore;
    await prisma.homeworkAnswer.updateMany({
      where: { attemptId, homeworkQuestionId: entry.homeworkQuestionId },
      data: {
        teacherScore: entry.teacherScore,
        teacherComment: entry.teacherComment ?? null,
      },
    });
  }

  const mcqScore = attempt.mcqScore ?? 0;
  const totalMarks = attempt.homework.questions.reduce(
    (sum, q) => sum + Number(q.marks),
    0,
  );
  const { totalScore, percentage } = computeTotals(mcqScore, essayScore, totalMarks);

  await prisma.homeworkAttempt.update({
    where: { id: attemptId },
    data: {
      essayScore,
      totalScore,
      percentage,
      status: "graded",
      published: true,
    },
  });

  const content = `${attempt.homework.title}: ${totalScore}/${totalMarks} (${Math.round(percentage)}%)`;
  const guardians = await prisma.guardian.findMany({
    where: { studentId: attempt.studentId },
  });
  for (const g of guardians) {
    try {
      if (g.parentUserId) {
        await createNotification({
          schoolId,
          recipientType: "parent",
          recipientId: g.parentUserId,
          eventType: "homework_result",
          title: "Homework result",
          content,
          channel: "in_app",
        });
      }
      if (g.email) {
        await createNotification({
          schoolId,
          recipientType: "parent",
          recipientId: g.parentUserId ?? "",
          recipientEmail: g.email,
          eventType: "homework_result",
          title: "Homework result",
          content,
          channel: "email",
        });
      }
    } catch {
      // best-effort: one failing guardian must not abort the whole action
    }
  }

  revalidatePath("/homework");
  return { success: "Homework marked." };
}
