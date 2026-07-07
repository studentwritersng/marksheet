"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import { createCompletion } from "@/lib/ai/gateway";

export interface ActionState {
  error?: string;
  success?: string;
}

/** Manual question creation (MCQ or Essay — PRD 05 §3.2). */
export async function createQuestionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const subjectId = String(formData.get("subjectId") ?? "");
  const type = String(formData.get("type") ?? ""); // mcq | essay
  const text = String(formData.get("text") ?? "").trim();
  const marks = Number(formData.get("marks") ?? 1);
  const difficulty = String(formData.get("difficulty") ?? "").trim() || null;
  const modelAnswer = String(formData.get("modelAnswer") ?? "").trim();
  const rubricJson = String(formData.get("rubricPoints") ?? "");
  const optionA = String(formData.get("optionA") ?? "").trim();
  const optionB = String(formData.get("optionB") ?? "").trim();
  const optionC = String(formData.get("optionC") ?? "").trim();
  const optionD = String(formData.get("optionD") ?? "").trim();
  const correctAnswer = String(formData.get("correctAnswer") ?? "").trim();

  if (!subjectId || !text) return { error: "Subject and question text are required." };
  if (type === "mcq" && !correctAnswer) return { error: "Select the correct answer for MCQ." };
  if (type === "essay" && !modelAnswer) return { error: "Model answer is required for essay questions." };

  let rubricPoints = [];
  if (rubricJson) {
    try {
      rubricPoints = JSON.parse(rubricJson);
    } catch {
      return { error: "Invalid rubric JSON." };
    }
  }

  const question = await prisma.question.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      type: type === "mcq" ? "mcq" : "essay",
      text,
      marks,
      difficulty,
      source: "manual",
      status: "pending_review",
      createdBy: ctx.user.userId,
      ...(type === "essay"
        ? {
            essaySpec: {
              create: {
                modelAnswer,
                rubricPoints: rubricPoints.length > 0 ? rubricPoints : [{ description: "General correctness", mark: marks }],
              },
            },
          }
        : {}),
      mcqOptions:
        type === "mcq"
          ? {
              create: [
                { optionText: optionA, isCorrect: correctAnswer === "A" },
                { optionText: optionB, isCorrect: correctAnswer === "B" },
                { optionText: optionC, isCorrect: correctAnswer === "C" },
                { optionText: optionD, isCorrect: correctAnswer === "D" },
              ]
                .filter((o) => o.optionText)
                .map((o) => o), // inline creates
            }
          : undefined,
    },
  });

  // Manually create MCQ options since inline self-referencing is limited
  if (type === "mcq") {
    const options = [
      { optionText: optionA, isCorrect: correctAnswer === "A" },
      { optionText: optionB, isCorrect: correctAnswer === "B" },
      { optionText: optionC, isCorrect: correctAnswer === "C" },
      { optionText: optionD, isCorrect: correctAnswer === "D" },
    ].filter((o) => o.optionText);

    for (const opt of options) {
      await prisma.mcqOption.create({
        data: {
          questionId: question.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
        },
      });
    }
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "question",
    entityId: question.id,
    afterValue: { subjectId, type, text } as never,
  });

  revalidatePath("/questions");
  return { success: `Question created (${type}). Needs review before approval.` };
}

/** AI-generate questions from lesson notes (PRD 05 §3.4). */
export async function aiGenerateQuestionsAction(
  lessonNoteId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const note = await prisma.lessonNote.findFirst({
    where: { id: lessonNoteId, schoolId: ctx.schoolId },
    include: { subject: true },
  });
  if (!note) return { error: "Lesson note not found." };

  const result = await createCompletion({
    taskType: "question_generation",
    messages: [
      {
        role: "system",
        content:
          "You are a Nigerian secondary school examiner. Generate 5 questions (mix of MCQ and essay) based on the lesson note content. For MCQs, mark the correct answer with [ANSWER: X]. For essay questions, provide a model answer and marking rubric.",
      },
      {
        role: "user",
        content: `Lesson note topic: "${note.topic}"\n\nContent: ${note.content.slice(0, 2000)}`,
      },
    ],
    temperature: 0.6,
  });

  // Create a placeholder question record representing the bundle.
  await prisma.question.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId: note.subjectId,
      type: "essay",
      text: `[AI Generated from: ${note.topic}]\n\n${result.content.slice(0, 500)}`,
      marks: 5,
      source: "ai_generated",
      status: "draft",
      lessonNoteId: note.id,
      createdBy: ctx.user.userId,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "question",
    afterValue: { subjectId: note.subjectId, source: "ai_generated", lessonNoteId: note.id } as never,
  });

  revalidatePath("/questions");
  return { success: `AI questions generated from "${note.topic}". Review in drafts.` };
}

/** Approve a question (PRD 05 §3.5 — HOD/Admin). */
export async function approveQuestionAction(questionId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const q = await prisma.question.findFirst({
    where: { id: questionId, schoolId: ctx.schoolId },
  });
  if (!q) return { error: "Question not found." };

  await prisma.question.update({ where: { id: questionId }, data: { status: "approved" } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "approve",
    entityType: "question",
    entityId: questionId,
  });

  revalidatePath("/questions");
  return { success: "Question approved." };
}

/** Reject a question (returns to draft with comment). */
export async function rejectQuestionAction(questionId: string, comment?: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const q = await prisma.question.findFirst({
    where: { id: questionId, schoolId: ctx.schoolId },
  });
  if (!q) return { error: "Question not found." };

  await prisma.question.update({ where: { id: questionId }, data: { status: "draft" } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "reject",
    entityType: "question",
    entityId: questionId,
    afterValue: { comment } as never,
  });

  revalidatePath("/questions");
  return { success: "Question returned to draft." };
}

/** Delete a question. */
export async function deleteQuestionAction(questionId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const q = await prisma.question.findFirst({
    where: { id: questionId, schoolId: ctx.schoolId },
  });
  if (!q) return { error: "Question not found." };

  await prisma.question.delete({ where: { id: questionId } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "delete",
    entityType: "question",
    entityId: questionId,
  });

  revalidatePath("/questions");
  return { success: "Question deleted." };
}
