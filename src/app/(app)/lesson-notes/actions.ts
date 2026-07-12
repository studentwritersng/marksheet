"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { createCompletion } from "@/lib/ai/gateway";
import { safeJsonParse } from "@/lib/json-utils";

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
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const topic = String(formData.get("topic") ?? "").trim();

  if (!subjectId || !classId || !termId || !topic) {
    return { error: "Subject, class, term, and topic are required." };
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  const term = await prisma.term.findUnique({ where: { id: termId } });

  // Look up curriculum objectives for this subject/class/term/topic
  let curriculumObjectives: string[] = [];
  let curriculumTopic = "";
  if (cls && term && subject) {
    const termName = term.name; // "FIRST" | "SECOND" | "THIRD"
    const curriculum = await prisma.curriculumTopic.findFirst({
      where: {
        classLevel: cls.level,
        subject: subject.name,
        term: termName,
        topic: { contains: topic, mode: "insensitive" },
        schoolId: null,
        isSystem: true,
      },
      orderBy: { week: "asc" },
    });
    if (curriculum) {
      curriculumObjectives = (curriculum.behaviouralObjectives as string[]) ?? [];
      curriculumTopic = curriculum.topic;
    }
  }

  const hasCurriculumObjectives = curriculumObjectives.length > 0;
  if (!hasCurriculumObjectives) {
    return { error: `No curriculum entry found for "${topic}" in ${subject?.name} (${cls?.level}) ${term?.name}. Add it to the curriculum first in Console > Curriculum > Manual Entry.` };
  }
  const objectivesPrompt = `Behavioural objectives (from NERDC syllabus — AUTHORITATIVE, do not alter):\n${curriculumObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nThese are the official NERDC objectives. Use them exactly as given. Do not add, remove, or rephrase any objective. Every section of the lesson note must address these specific objectives.`;

  const result = await createCompletion({
    taskType: "lesson_note_generation",
    messages: [
      {
        role: "system",
        content: `You are an experienced Nigerian secondary school teacher preparing a lesson note in the standard Nigerian lesson note format. Generate a complete, ready-to-use lesson note based on the inputs below.

LANGUAGE RULES (STRICT)
- Use British English throughout, never American English. This includes spelling (colour, organise, favourite, centre, analyse, programme — not color, organize, favorite, center, analyze, program), vocabulary (rubber not eraser, timetable not schedule, holiday not vacation), and punctuation conventions (single quotation marks as primary).
- Do not use American date formats, spellings, or idioms anywhere in the output.

EXAMPLES AND CONTEXT RULES (STRICT)
- All examples, names, places, scenarios, and references must be typical of the Nigerian context — Nigerian names, settings, WAEC/JAMB references, Naira currency, Nigerian towns/states, locally familiar situations.
- Only use a non-Nigerian example when the topic itself specifically requires it for accuracy (e.g. a Literature set text by a foreign author, or a scientific phenomenon with no reasonable Nigerian equivalent). If you do this, briefly note why the exception was necessary.
- Avoid generic Western/American cultural references entirely unless the syllabus topic is explicitly about a foreign culture.

CONTENT GROUNDING
- The behavioural objectives are provided in the user message. Derive students_note, presentation_steps, and evaluation directly and specifically from those objectives — not from a generic treatment of the topic. Ask yourself, for each piece of content you write: "which objective(s) does this serve?" If a fact or explanation doesn't serve any listed objective, leave it out, even if it's commonly taught alongside this topic elsewhere.
- Pitch depth, vocabulary, and complexity appropriately for the specified class level — do not write SS3-level depth for a JSS1 class or oversimplify content meant for senior classes.
- Do not write placeholder sentences that could be reused verbatim for a different topic. The content must be specific to this exact topic.

STRUCTURE REQUIRED (generate every section, in this order)

1. previous_knowledge: 1-2 sentences describing what students should already know that this lesson builds on, consistent with the class level and the given objectives.

2. introduction_set_induction: A short, concrete classroom-opening activity or question that leads naturally into the first objective, using a relatable Nigerian scenario.

3. students_note: The detailed board-summary content students copy into their notebooks. This must be organised so that every listed objective is clearly and fully covered — write it as a numbered/structured set of definitions, explanations, rules, and worked examples (using Nigerian context per the rules above). This is the most substantial section — be thorough, not a brief outline.

4. presentation_steps: An array of 3-5 sequential teaching steps, each tagged with which objective(s) it primarily serves. Each step must have:
   - step_number
   - objective_reference: which objective(s) this step works toward (by index or short text)
   - teacher_activity
   - student_activity
   Steps should build logically: introduce/explain, demonstrate, guided practice, independent practice/drill — progressing through the objectives in a sensible teaching order (not necessarily the order objectives were listed, if a different sequence teaches better).

5. evaluation: 3-5 questions checking whether the objectives were achieved. Each question must be tagged with the specific objective it assesses, and there should be at least one question per objective (a question may cover more than one objective if natural, but no objective should go unassessed).

6. summary_conclusion: A short paragraph recapping the lesson against the objectives.

7. assignment_homework: A homework task reinforcing the objectives, scoped for independent student work at the given class level.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "subject": "the subject name",
  "class": "the class level",
  "theme_or_aspect": "the theme or aspect",
  "topic": "the topic",
  "duration": "duration in minutes",
  "reference_books": "comma-separated list of recommended textbooks",
  "instructional_materials": "comma-separated list of teaching aids",
  "previous_knowledge": "text",
  "introduction_set_induction": "text",
  "students_note": "text — the most substantial section",
  "presentation_steps": [
    { "step_number": 1, "objective_reference": "...", "teacher_activity": "...", "student_activity": "..." }
  ],
  "evaluation": "text",
  "summary_conclusion": "text",
  "assignment_homework": "text"
}`,
      },
      {
        role: "user",
        content: `Subject: ${subject?.name ?? "the subject"}
Class: ${cls?.level ?? cls?.name ?? "the class"}
Theme / Aspect: ${curriculumTopic || topic}
Topic: ${topic}
${objectivesPrompt}
Duration: 40 minutes
Reference books: (suggest standard Nigerian curriculum-aligned texts for this subject and class)
Instructional materials: chalkboard/whiteboard, charts, textbooks, flashcards

Write a complete lesson note following the structure above. Ensure all content is Nigeria-specific and appropriate for a ${cls?.level ?? cls?.name ?? "secondary school"} class.`,
      },
    ],
    temperature: 0.5,
  });

  // Parse the JSON response (with markdown fence / truncation resilience)
  const parsed = safeJsonParse<Record<string, unknown>>(result.content) ?? {};

  await prisma.lessonNote.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      classId,
      termId,
      topic,
      themeOrAspect: (parsed.theme_or_aspect as string) ?? null,
      duration: (parsed.duration as string) ?? null,
      referenceBooks: (parsed.reference_books as string) ?? null,
      instructionalMaterials: (parsed.instructional_materials as string) ?? null,
      previousKnowledge: (parsed.previous_knowledge as string) ?? null,
      introduction: (parsed.introduction_set_induction as string) ?? null,
      ...(curriculumObjectives.length > 0 ? { behaviouralObjectives: curriculumObjectives } : {}),
      content: (parsed.students_note as string) ?? result.content.slice(0, 5000),
      presentationSteps: (parsed.presentation_steps as unknown as object[]) ?? null,
      evaluation: (parsed.evaluation as string) ?? null,
      summary: (parsed.summary_conclusion as string) ?? null,
      assignment: (parsed.assignment_homework as string) ?? null,
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
  async function query(cl: string) {
    return prisma.curriculumTopic.findMany({
      where: {
        subject: { equals: subjectName, mode: "insensitive" },
        classLevel: cl,
        term,
      },
      orderBy: { week: "asc" },
      select: { id: true, topic: true, week: true },
    });
  }

  const topics = await query(classLevel);
  if (topics.length > 0) return topics;

  // Try alternate naming: SSS1 ↔ SS1, SSS2 ↔ SS2, SSS3 ↔ SS3
  const alt = classLevel.replace(/^SSS(\d)$/, "SS$1").replace(/^SS(\d)$/, "SSS$1");
  if (alt !== classLevel) {
    const altTopics = await query(alt);
    if (altTopics.length > 0) return altTopics;
  }

  return [];
}

/** Edit/update a lesson note (works for both draft and published). */
export async function updateLessonNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const noteId = String(formData.get("noteId") ?? "");
  const topic = String(formData.get("topic") ?? "").trim();
  const previousKnowledge = String(formData.get("previousKnowledge") ?? "").trim() || null;
  const introduction = String(formData.get("introduction") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim() || null;
  const evaluation = String(formData.get("evaluation") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const assignment = String(formData.get("assignment") ?? "").trim() || null;

  if (!noteId || !topic) return { error: "Note ID and topic are required." };

  const existing = await prisma.lessonNote.findFirst({
    where: { id: noteId, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Note not found." };

  await prisma.lessonNote.update({
    where: { id: noteId },
    data: {
      topic,
      previousKnowledge,
      introduction,
      content,
      evaluation,
      summary,
      assignment,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "lesson_note",
    entityId: noteId,
    afterValue: { topic } as never,
  });

  revalidatePath("/lesson-notes");
  return { success: `"${topic}" updated.` };
}

/** Delete a lesson note. */
export async function deleteLessonNoteAction(noteId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const note = await prisma.lessonNote.findFirst({
    where: { id: noteId, schoolId: ctx.schoolId },
  });
  if (!note) return { error: "Note not found." };

  await prisma.lessonNote.delete({ where: { id: noteId } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "delete",
    entityType: "lesson_note",
    entityId: noteId,
    beforeValue: { topic: note.topic } as never,
  });

  revalidatePath("/lesson-notes");
  return { success: "Lesson note deleted." };
}

/** Publish a draft lesson note (status draft → published). */
export async function publishNoteAction(noteId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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
