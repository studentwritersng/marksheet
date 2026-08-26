"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validateQuestionCounts } from "@/lib/homework/grading";
import { recordAudit } from "@/lib/audit";
import { guardActiveLicense } from "@/lib/license";
import { requireHomeworkManager } from "./auth";

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
