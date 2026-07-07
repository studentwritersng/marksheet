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

  if (!subjectId || !classId || !termId || !topic) {
    return { error: "Subject, class, term, and topic are required." };
  }

  const previousKnowledge = String(formData.get("previousKnowledge") ?? "").trim() || null;
  const introduction = String(formData.get("introduction") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim() || null;
  const evaluation = String(formData.get("evaluation") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const assignment = String(formData.get("assignment") ?? "").trim() || null;

  await prisma.lessonNote.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId,
      termId,
      topic,
      previousKnowledge,
      introduction,
      content,
      evaluation,
      summary,
      assignment,
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
        content: `You are an experienced Nigerian secondary school teacher preparing a lesson note in the standard Nigerian lesson note format. Generate a complete, ready-to-use lesson note based on the inputs below.

CRITICAL — BEHAVIOURAL OBJECTIVES
Where specific behavioural objectives are not provided, derive 3-5 appropriate objectives from the topic and class level that follow the Nigerian syllabus standard.

LANGUAGE RULES (STRICT)
- Use British English throughout, never American English. This includes spelling (colour, organise, favourite, centre, analyse, programme — not color, organize, favorite, center, analyze, program).
- All examples, names, places, scenarios, and references must be typical of the Nigerian context — Nigerian names, settings, WAEC/JAMB references, Naira currency, Nigerian towns/states, locally familiar situations.

STRUCTURE REQUIRED — each section described below must be present.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "previous_knowledge": "1-2 sentences describing what students should already know",
  "introduction": "set induction activity using a relatable Nigerian scenario",
  "behavioural_objectives": ["objective 1", "objective 2", "objective 3"],
  "content": "detailed students' note / board summary organised by objectives — this is the most substantial section",
  "presentation_steps": [
    { "step_number": 1, "objective_reference": "which objective(s)", "teacher_activity": "...", "student_activity": "..." }
  ],
  "evaluation": "3-5 evaluation questions",
  "summary": "short recap paragraph",
  "assignment": "homework task"
}`,
      },
      {
        role: "user",
        content: `Subject: ${subject?.name ?? "the subject"}
Class: ${cls?.name ?? "the class"}
Topic: ${topic}

Write a complete lesson note following the structure above. Ensure all content is Nigeria-specific and appropriate for a ${cls?.name ?? "secondary school"} class.`,
      },
    ],
    temperature: 0.5,
  });

  // Parse the JSON response
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(result.content);
  } catch {
    // Store as raw content if JSON parse fails
  }

  await prisma.lessonNote.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId,
      termId,
      topic,
      previousKnowledge: (parsed.previous_knowledge as string) ?? null,
      introduction: (parsed.introduction as string) ?? null,
      behaviouralObjectives: (parsed.behavioural_objectives as unknown as string[]) ?? null,
      content: (parsed.content as string) ?? result.content.slice(0, 5000),
      presentationSteps: (parsed.presentation_steps as unknown as object[]) ?? null,
      evaluation: (parsed.evaluation as string) ?? null,
      summary: (parsed.summary as string) ?? null,
      assignment: (parsed.assignment as string) ?? null,
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

/** Fetch curriculum topics (syllabus items) for a subject and class level. */
export async function getCurriculumTopicsAction(
  subjectName: string,
  classLevel: string,
  term: string,
): Promise<{ id: string; topic: string; week: number }[]> {
  const topics = await prisma.curriculumTopic.findMany({
    where: {
      subject: { equals: subjectName, mode: "insensitive" },
      classLevel,
      term,
    },
    orderBy: { week: "asc" },
    select: { id: true, topic: true, week: true },
  });
  return topics;
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
