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

/** Create a manual lesson note (PRD 04 §3.2). */
export async function createLessonNoteAction(
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
  const classId = String(formData.get("classId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const topic = String(formData.get("topic") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!subjectId || !classId || !termId || !topic) {
    return { error: "Subject, class, term, and topic are required." };
  }

  await prisma.lessonNote.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId,
      termId,
      topic,
      content,
      source: "manual",
      status: "published",
      createdBy: ctx.user.userId,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "lesson_note",
    afterValue: { subjectId, classId, termId, topic } as never,
  });

  revalidatePath("/lesson-notes");
  return { success: `"${topic}" saved.` };
}

/**
 * AI-generate a draft lesson note from the gateway (PRD 04 §3.3).
 * Lands as `draft` — teacher must review and publish.
 */
export async function aiGenerateNoteAction(
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
  const classId = String(formData.get("classId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const topic = String(formData.get("topic") ?? "").trim();

  if (!subjectId || !classId || !termId || !topic) {
    return { error: "Subject, class, term, and topic are required." };
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  const cls = await prisma.class.findUnique({ where: { id: classId } });

  const result = await createCompletion({
    taskType: "lesson_note_generation",
    messages: [
      {
        role: "system",
        content:
          "You are a Nigerian secondary school teacher. Write a detailed lesson note covering objectives, content (introduction, development, conclusion), evaluation, and assignment. Use clear section headings.",
      },
      {
        role: "user",
        content: `Write a lesson note for ${cls?.name ?? "the class"} on the topic: "${topic}" in ${subject?.name ?? "the subject"}.`,
      },
    ],
    temperature: 0.5,
  });

  await prisma.lessonNote.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId,
      termId,
      topic,
      content: result.content,
      source: "ai_generated",
      status: "draft",
      createdBy: ctx.user.userId,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "lesson_note",
    afterValue: { subjectId, classId, termId, topic, source: "ai_generated" } as never,
  });

  revalidatePath("/lesson-notes");
  return { success: `AI draft for "${topic}" created. Review and publish it.` };
}

/** Publish a draft lesson note (status draft → published). */
export async function publishNoteAction(noteId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const note = await prisma.lessonNote.findFirst({
    where: { id: noteId, schoolId: ctx.schoolId },
  });
  if (!note) return { error: "Note not found." };

  await prisma.lessonNote.update({
    where: { id: noteId },
    data: { status: "published" },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "lesson_note",
    entityId: noteId,
    afterValue: { status: "published" } as never,
  });

  revalidatePath("/lesson-notes");
  return { success: `"${note.topic}" published.` };
}
