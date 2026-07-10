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

CRITICAL — BEHAVIOURAL OBJECTIVES ARE FIXED INPUTS, NOT SOMETHING TO INVENT
The behavioural objectives listed below come directly from the school's syllabus and are authoritative. Do not invent additional objectives, do not omit any of them, and do not alter their intended meaning. Every single objective must be fully and specifically addressed within students_note and presentation_steps — content that does not serve at least one listed objective should not be included, and no listed objective should be left uncovered. You may lightly reformat an objective's wording for consistency of tense/style, but its meaning and scope must remain exactly as given.

CRITICAL — NO GENERIC TEMPLATES IN OBJECTIVES
Do not produce objectives shaped like "Define and explain the concept of {{topic}}" or "Identify the key characteristics of {{topic}}." These are empty templates that could apply to any topic by find-and-replace. Every objective must name specific, real content that only makes sense for this exact topic.

BAD (generic template): "Students should be able to identify the key characteristics of Organs of Speech."
GOOD (specific, real content): "Students should be able to name and locate at least five organs involved in speech production, including the lungs, larynx, tongue, and lips, and state the function of each."

This rule applies to ALL sections of the lesson note, not just objectives. The students_note, evaluation questions, presentation steps, and assignment must all contain specific, real content that would only make sense if you knew what the topic actually covers. Do not write placeholder sentences that could be reused verbatim for a different topic.

LANGUAGE RULES (STRICT)
- Use British English throughout, never American English. This includes spelling (colour, organise, favourite, centre, analyse, programme — not color, organize, favorite, center, analyze, program), vocabulary (rubber not eraser, timetable not schedule, holiday not vacation), and punctuation conventions (single quotation marks as primary).
- Do not use American date formats, spellings, or idioms anywhere in the output.

EXAMPLES AND CONTEXT RULES (STRICT)
- All examples, names, places, scenarios, and references must be typical of the Nigerian context — Nigerian names, settings, WAEC/JAMB references, Naira currency, Nigerian towns/states, locally familiar situations.
- Only use a non-Nigerian example when the topic itself specifically requires it for accuracy (e.g. a Literature set text by a foreign author, or a scientific phenomenon with no reasonable Nigerian equivalent). If you do this, briefly note why the exception was necessary.
- Avoid generic Western/American cultural references entirely unless the syllabus topic is explicitly about a foreign culture.

CONTENT GROUNDING
- Derive students_note, presentation_steps, and evaluation directly and specifically from the behavioural objectives, in relation to the given topic, theme, and class level — not from a generic treatment of the topic. Ask yourself, for each piece of content you write: "which objective(s) does this serve?" If a fact or explanation doesn't serve any listed objective, leave it out, even if it's commonly taught alongside this topic elsewhere.
- Pitch depth, vocabulary, and complexity appropriately for the specified class level — do not write SS3-level depth for a JSS1 class or oversimplify content meant for senior classes.

STRUCTURE REQUIRED (generate every section, in this order)

1. previous_knowledge: 1-2 sentences describing what students should already know that this lesson builds on, consistent with the class level and the given objectives.

2. introduction_set_induction: A short, concrete classroom-opening activity or question that leads naturally into the first objective, using a relatable Nigerian scenario.

3. students_note: The detailed board-summary content students copy into their notebooks. This must be organised so that every listed objective is clearly and fully covered — write it as a numbered/structured set of definitions, explanations, rules, and worked examples (using Nigerian context per the rules above). This is the most substantial section — be thorough, not a brief outline.

4. objective_coverage_map: For each behavioural objective (by its exact text), list which part(s)/point number(s) of students_note address it. This is a traceability check, not narrative content — keep entries short (e.g. "Objective 2 → covered by points 2 and 3 of students_note").

5. presentation_steps: An array of 3-5 sequential teaching steps, each tagged with which objective(s) it primarily serves. Each step must have:
   - step_number
   - objective_reference: which objective(s) this step works toward (by index or short text)
   - teacher_activity
   - student_activity
   Steps should build logically: introduce/explain, demonstrate, guided practice, independent practice/drill — progressing through the objectives in a sensible teaching order (not necessarily the order objectives were listed, if a different sequence teaches better).

6. evaluation: 3-5 questions checking whether the objectives were achieved. Each question must be tagged with the specific objective it assesses, and there should be at least one question per objective (a question may cover more than one objective if natural, but no objective should go unassessed).

7. summary_conclusion: A short paragraph recapping the lesson against the objectives.

8. assignment_homework: A homework task reinforcing the objectives, scoped for independent student work at the given class level.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "subject": "the subject name",
  "class": "the class level",
  "theme_or_aspect": "the theme or aspect",
  "topic": "the topic",
  "duration": "duration in minutes",
  "reference_books": "comma-separated list of recommended textbooks",
  "instructional_materials": "comma-separated list of teaching aids",
  "behavioural_objectives": ["objective 1", "objective 2", ...],
  "previous_knowledge": "text",
  "introduction_set_induction": "text",
  "students_note": "text — the most substantial section",
  "objective_coverage_map": "text",
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
Theme / Aspect: ${topic}
Topic: ${topic}
Behavioural objectives (from syllabus — authoritative): (derive 3-5 appropriate objectives from the topic and class level that follow the Nigerian syllabus standard)
Duration: 40 minutes
Reference books: (suggest standard Nigerian curriculum-aligned texts for this subject and class)
Instructional materials: chalkboard/whiteboard, charts, textbooks, flashcards

Write a complete lesson note following the structure above. Ensure all content is Nigeria-specific and appropriate for a ${cls?.level ?? cls?.name ?? "secondary school"} class.`,
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
      themeOrAspect: (parsed.theme_or_aspect as string) ?? null,
      duration: (parsed.duration as string) ?? null,
      referenceBooks: (parsed.reference_books as string) ?? null,
      instructionalMaterials: (parsed.instructional_materials as string) ?? null,
      previousKnowledge: (parsed.previous_knowledge as string) ?? null,
      introduction: (parsed.introduction_set_induction as string) ?? null,
      behaviouralObjectives: (parsed.behavioural_objectives as unknown as string[]) ?? null,
      content: (parsed.students_note as string) ?? result.content.slice(0, 5000),
      objectiveCoverageMap: (parsed.objective_coverage_map as string) ?? null,
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
