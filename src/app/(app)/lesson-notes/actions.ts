"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireSchoolStaff, canAccessSubject, canAccessClass } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { createCompletion } from "@/lib/ai/gateway";
import { safeJsonParse } from "@/lib/json-utils";
import { classLevelGuidance } from "@/lib/ai/class-level-guidance";

export interface ActionState {
  error?: string;
  success?: string;
}

/** Create a manual lesson note. */
export async function createLessonNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
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
  if (!canAccessSubject(ctx.perms, subjectId) || !canAccessClass(ctx.perms, classId)) {
    return { error: "Not authorised for this subject or class." };
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
      createdBy: ctx.user.staffId ?? "",
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
 * AI-generate a draft lesson note from the gateway.
 * Lands as `draft` — teacher must review and publish.
 */
export async function aiGenerateNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
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
  if (!canAccessSubject(ctx.perms, subjectId) || !canAccessClass(ctx.perms, classId)) {
    return { error: "Not authorised for this subject or class." };
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  const term = await prisma.term.findUnique({ where: { id: termId } });

  // Look up curriculum objectives for this subject/class/term/topic
  let curriculumObjectives: string[] = [];
  let curriculumTopic = "";

  // Subject name variations (school name → NERDC name)
  const altNames: Record<string, string[]> = {
    "English Language": ["English Studies", "English"],
    "Basic Science": ["Basic Science and Technology", "Integrated Science"],
    "Basic Technology": ["Introductory Technology"],
    "Business Studies": ["Business Education"],
    "Civic Education": ["Civics"],
    "Physical and Health Education": ["Physical Education", "PHE"],
    "Social Studies": ["Social Sciences"],
    "Agricultural Science": ["Agriculture"],
    "Computer Science": ["Information Technology", "IT", "Computer Studies"],
    "Home Economics": ["Home Management"],
    "Christian Religious Studies": ["CRS", "Christian Religious Knowledge", "Christian Religious Education"],
    "Islamic Studies": ["IRS", "Islamic Religious Studies"],
  };

  if (cls && term && subject) {
    // term.name is a Prisma enum: "First" | "Second" | "Third"
    // CurriculumTopic.term stores uppercase: "FIRST" | "SECOND" | "THIRD"
    const termName = term.name.toUpperCase(); // normalise to match CurriculumTopic.term
    const topicFilters = [
      { topic: { contains: topic, mode: "insensitive" as const } },          // curriculum contains user topic
      { topic: { contains: topic.replace(/^[^:]+:\s*/, ""), mode: "insensitive" as const } }, // strip prefix like "Grammar: "
    ];

    // Subject name variations (school name → NERDC name)
    const subjectVariations = [subject.name];
    for (const alts of Object.values(altNames)) {
      if (alts.some((a) => a.toLowerCase() === subject.name.toLowerCase())) {
        subjectVariations.push(...alts);
        break;
      }
    }

    let curriculum = null;

    // 1) Prefer school-specific curriculum entries first
    outer1: for (const subjectName of subjectVariations) {
      for (const tf of topicFilters) {
        curriculum = await prisma.curriculumTopic.findFirst({
          where: {
            classLevel: cls.level,
            subject: subjectName,
            term: termName,
            schoolId: ctx.schoolId,
            ...tf,
          },
          orderBy: { week: "asc" },
        });
        if (curriculum) break outer1;
      }
    }

    // 2) Fall back to NERDC system defaults (schoolId null = owner console entries)
    outer2: for (const subjectName of subjectVariations) {
      for (const tf of topicFilters) {
        curriculum = await prisma.curriculumTopic.findFirst({
          where: {
            classLevel: cls.level,
            subject: subjectName,
            term: termName,
            schoolId: null,
            ...tf,
          },
          orderBy: { week: "asc" },
        });
        if (curriculum) break outer2;
      }
    }

    // 3) Last resort: reverse match — user topic contains curriculum topic
    if (!curriculum) {
      // Search both school-specific and NERDC defaults
      const allCurriculum = await prisma.curriculumTopic.findMany({
        where: {
          classLevel: cls.level,
          subject: { in: subjectVariations },
          term: termName,
          OR: [{ schoolId: ctx.schoolId }, { schoolId: null }],
        },
        orderBy: [{ schoolId: "desc" }, { week: "asc" }], // school-specific first
      });
      const lowerTopic = topic.toLowerCase();
      curriculum = allCurriculum.find((c) => lowerTopic.includes(c.topic.toLowerCase())) ?? null;
    }

    if (curriculum) {
      curriculumObjectives = (curriculum.behaviouralObjectives as string[]) ?? [];
      curriculumTopic = curriculum.topic;
    }
  }

  // If no curriculum row was found at all, bail out
  const hasCurriculumEntry = !!( cls && term && subject &&
    (curriculumTopic || curriculumObjectives.length > 0)
  );
  if (!hasCurriculumEntry) {
    const searchedNames = subject ? [subject.name, ...Object.values(altNames).flat()] : [];
    return { error: `No curriculum entry found for "${topic}" in ${subject?.name ?? subjectId} (${cls?.level}) ${term?.name}. Searched subject names: ${searchedNames.join(", ")}. Add it to the curriculum first.` };
  }

  const objectivesPrompt = curriculumObjectives.length > 0
    ? `Behavioural objectives (from NERDC syllabus — AUTHORITATIVE, do not alter):\n${curriculumObjectives.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\nThese are the official NERDC objectives. Use them exactly as given. Do not add, remove, or rephrase any objective. Every section of the lesson note must address these specific objectives.`
    : `No pre-set behavioural objectives are available for this topic. Generate appropriate behavioural objectives yourself (3–5 objectives starting with "By the end of the lesson, students should be able to…"), then use them to structure the lesson note.`;

  let result;
  try {
    const levelGuidance = classLevelGuidance(cls?.level ?? "SSS1");
    result = await createCompletion({
      taskType: "lesson_note_generation",
      userId: ctx.user.userId,
    messages: [
      {
        role: "system",
        content: `You are an experienced Nigerian secondary school teacher preparing a lesson note in the standard Nigerian lesson note format. Generate a complete, ready-to-use lesson note based on the inputs below.

${levelGuidance}

LANGUAGE RULES (STRICT)
- Use British English throughout, never American English. This includes spelling (colour, organise, favourite, centre, analyse, programme — not color, organize, favorite, center, analyze, program), vocabulary (rubber not eraser, timetable not schedule, holiday not vacation), and punctuation conventions (single quotation marks as primary).
- Do not use American date formats, spellings, or idioms anywhere in the output.
- Apply the vocabulary and sentence-length rules from the class-level section above to ALL sections of the lesson note.

EXAMPLES AND CONTEXT RULES (STRICT)
- All examples, names, places, scenarios, and references must be typical of the Nigerian context — Nigerian names, settings, WAEC/JAMB references, Naira currency, Nigerian towns/states, locally familiar situations.
- Only use a non-Nigerian example when the topic itself specifically requires it for accuracy (e.g. a Literature set text by a foreign author, or a scientific phenomenon with no reasonable Nigerian equivalent). If you do this, briefly note why the exception was necessary.
- Avoid generic Western/American cultural references entirely unless the syllabus topic is explicitly about a foreign culture.

CONTENT GROUNDING
- The behavioural objectives are provided in the user message. Derive students_note, presentation_steps, and evaluation directly and specifically from those objectives — not from a generic treatment of the topic.
- Pitch depth, vocabulary, and complexity strictly according to the class-level rules above. Do not exceed the cognitive level or vocabulary ceiling for this class.
- Do not write placeholder sentences that could be reused verbatim for a different topic. The content must be specific to this exact topic.

STRUCTURE REQUIRED (generate every section, in this order)

1. previous_knowledge: 1-2 sentences describing what students should already know that this lesson builds on, consistent with the class level and the given objectives.

2. introduction_set_induction: A short, concrete classroom-opening activity or question that leads naturally into the first objective, using a relatable Nigerian scenario appropriate for this age group.

3. students_note: The detailed board-summary content students copy into their notebooks. Must be organised so every listed objective is clearly and fully covered. Follow the students_note format rules from the class-level section above (bullet points vs prose, sentence length, etc.). This is the most substantial section — be thorough but pitch it exactly at the class level.

4. presentation_steps: An array of 3-5 sequential teaching steps, each tagged with which objective(s) it primarily serves. Each step must have:
   - step_number
   - objective_reference: which objective(s) this step works toward (by index or short text)
   - teacher_activity: phrased at the complexity appropriate for the class level
   - student_activity: activities and responses appropriate for the age group
   Steps should build logically: introduce/explain, demonstrate, guided practice, independent practice/drill.

5. evaluation: 3-5 questions checking whether the objectives were achieved. Apply the question-style rules from the class-level section above (allowed action verbs, question complexity, sentence length). At least one question per objective.

6. summary_conclusion: A short paragraph recapping the lesson against the objectives, written at the vocabulary level appropriate for this class.

7. assignment_homework: A homework task reinforcing the objectives. Apply the homework rules from the class-level section above.

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

Write a complete lesson note following the structure above. Ensure all content is Nigeria-specific and strictly appropriate for a ${cls?.level ?? cls?.name ?? "secondary school"} class — apply every vocabulary, sentence-length, and cognitive-level rule from the class-level section above without exception.`,
      },
    ],
    temperature: 0.5,
    maxTokens: 16384,
    });
  } catch (e: any) {
    const msg = e?.message ?? "AI generation failed.";
    return { error: msg.includes("not configured") ? "The AI lesson note service is currently unavailable. Please try again in a few minutes, or contact support if it keeps failing." : msg };
  }

  // Parse the JSON response (with markdown fence / truncation resilience)
  const parsed = safeJsonParse<Record<string, unknown>>(result.content) ?? {};

  // If JSON parsing failed and we got no structured fields, return an error
  // instead of storing raw AI text as the lesson note content
  const hasStructuredFields = parsed.students_note || parsed.previous_knowledge || parsed.presentation_steps;
  if (!hasStructuredFields && result.content.trim().length > 0) {
    return { error: "The AI model didn't return a usable response. Please try again in a couple of minutes — it may be busy right now. If it keeps failing, contact your school administrator." };
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
      ...(curriculumObjectives.length > 0 ? { behaviouralObjectives: curriculumObjectives } : {}),
      content: (parsed.students_note as string) ?? result.content.slice(0, 5000),
      presentationSteps: (parsed.presentation_steps as unknown as object[]) ?? null,
      evaluation: (parsed.evaluation as string) ?? null,
      summary: (parsed.summary_conclusion as string) ?? null,
      assignment: (parsed.assignment_homework as string) ?? null,
      source: "ai_generated",
      status: "draft",
      createdBy: ctx.user.staffId ?? "",
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

/** Returns subjects for a class that have at least one existing lesson note. */
export async function getSubjectsWithNotesAction(
  classId: string,
  termId: string,
): Promise<{ id: string; name: string }[]> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return []; }
  await guardActiveLicense(ctx.schoolId).catch(() => null);
  if (!canAccessClass(ctx.perms, classId)) return [];

  const distinct = await prisma.lessonNote.findMany({
    where: { classId, termId, schoolId: ctx.schoolId },
    select: { subjectId: true },
    distinct: ["subjectId"],
  });
  if (distinct.length === 0) return [];
  const subjectIds = distinct.map((d) => d.subjectId);
  return prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

const curriculumSubjectAltNames: Record<string, string[]> = {
  "English Language": ["English Studies", "English"],
  "Basic Science": ["Basic Science and Technology", "Integrated Science"],
  "Basic Technology": ["Introductory Technology"],
  "Business Studies": ["Business Education"],
  "Civic Education": ["Civics"],
  "Physical and Health Education": ["Physical Education", "PHE"],
  "Social Studies": ["Social Sciences"],
  "Agricultural Science": ["Agriculture"],
  "Computer Science": ["Information Technology", "IT", "Computer Studies"],
  "Home Economics": ["Home Management"],
  "Christian Religious Studies": ["CRS", "Christian Religious Knowledge", "Christian Religious Education"],
  "Islamic Studies": ["IRS", "Islamic Religious Studies"],
};

function subjectNameVariations(name: string): string[] {
  const variations = [name];
  for (const alts of Object.values(curriculumSubjectAltNames)) {
    if (alts.some((a) => a.toLowerCase() === name.toLowerCase())) {
      variations.push(...alts);
      break;
    }
  }
  return variations;
}

/** Resolve the curriculum week for a lesson note topic, or null when no match is found. */
function resolveCurriculumWeek(
  topic: string,
  weekMap: Map<string, { week: number; weekSuffix: string }>,
): { week: number; weekSuffix: string } | null {
  const normalized = topic.trim().toLowerCase().replace(/^(week\s*\d+\s*[ab]?\s*[:-]\s*)/i, "");

  const exact = weekMap.get(normalized);
  if (exact) return exact;

  let best: { week: number; weekSuffix: string } | null = null;
  let bestLen = 0;
  for (const [key, w] of weekMap) {
    if (key.length > 0 && (normalized.includes(key) || key.includes(normalized))) {
      if (key.length > bestLen) {
        best = w;
        bestLen = key.length;
      }
    }
  }
  if (best) return best;

  const match = topic.match(/(?:week\s*)(\d+)/i);
  if (match) return { week: parseInt(match[1], 10), weekSuffix: "" };

  return null;
}

/** Fetch existing lesson notes for a class + subject + term combination, ordered by curriculum week. */
export async function getExistingNotesAction(
  classId: string,
  subjectId: string,
  termId: string,
): Promise<{ id: string; topic: string; duration: string | null; source: string; status: string; createdAt: string; week: number | null; weekSuffix: string }[]> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return []; }
  await guardActiveLicense(ctx.schoolId).catch(() => null);
  if (!canAccessClass(ctx.perms, classId) || !canAccessSubject(ctx.perms, subjectId)) return [];

  const [notes, cls, term, subject] = await Promise.all([
    prisma.lessonNote.findMany({
      where: { classId, subjectId, termId, schoolId: ctx.schoolId },
      select: { id: true, topic: true, duration: true, source: true, status: true, createdAt: true },
    }),
    prisma.class.findUnique({ where: { id: classId }, select: { level: true } }),
    prisma.term.findUnique({ where: { id: termId }, select: { name: true } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }),
  ]);

  // Build a topic → week map from the curriculum (school-specific entries take precedence).
  const weekMap = new Map<string, { week: number; weekSuffix: string }>();
  if (cls && term && subject) {
    const curriculum = await prisma.curriculumTopic.findMany({
      where: {
        classLevel: cls.level,
        subject: { in: subjectNameVariations(subject.name) },
        term: term.name.toUpperCase(),
        OR: [{ schoolId: ctx.schoolId }, { schoolId: null }],
      },
      orderBy: [{ schoolId: "desc" }, { week: "asc" }, { weekSuffix: "asc" }],
      select: { topic: true, week: true, weekSuffix: true },
    });
    for (const t of curriculum) {
      const key = t.topic.trim().toLowerCase();
      if (key && !weekMap.has(key)) {
        weekMap.set(key, { week: t.week, weekSuffix: t.weekSuffix });
      }
    }
  }

  const result = notes.map((n) => {
    const w = resolveCurriculumWeek(n.topic, weekMap);
    return {
      id: n.id,
      topic: n.topic,
      duration: n.duration,
      source: n.source,
      status: n.status,
      createdAt: n.createdAt.toISOString(),
      week: w ? w.week : null,
      weekSuffix: w ? w.weekSuffix : "",
    };
  });

  // Order by curriculum week (unmatched notes sink to the end), regardless of generation time.
  result.sort((a, b) => {
    const wa = a.week ?? Number.MAX_SAFE_INTEGER;
    const wb = b.week ?? Number.MAX_SAFE_INTEGER;
    if (wa !== wb) return wa - wb;
    if (a.weekSuffix !== b.weekSuffix) return a.weekSuffix.localeCompare(b.weekSuffix);
    return a.createdAt.localeCompare(b.createdAt);
  });

  return result;
}

/** Fetch curriculum topics (syllabus items) for a subject and class level. */
export async function getCurriculumTopicsAction(
  subjectName: string,
  classLevel: string,
  term: string,
  schoolId?: string,
): Promise<{ id: string; topic: string; week: number; weekSuffix: string }[]> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return [];
  if (schoolId && schoolId !== user.schoolId) return [];

  async function query(cl: string, sid?: string) {
    return prisma.curriculumTopic.findMany({
      where: {
        subject: { equals: subjectName, mode: "insensitive" },
        classLevel: cl,
        term,
        ...(sid
          ? { schoolId: sid }
          : { schoolId: null }),
      },
      orderBy: [{ week: "asc" }, { weekSuffix: "asc" }],
      select: { id: true, topic: true, week: true, weekSuffix: true },
    });
  }

  // 1) School-specific entries first
  if (schoolId) {
    let topics = await query(classLevel, schoolId);
    if (topics.length > 0) return topics;

    const alt = classLevel.replace(/^SSS(\d)$/, "SS$1").replace(/^SS(\d)$/, "SSS$1");
    if (alt !== classLevel) {
      topics = await query(alt, schoolId);
      if (topics.length > 0) return topics;
    }
  }

  // 2) Fall back to NERDC system defaults
  let topics = await query(classLevel);
  if (topics.length > 0) return topics;

  const alt = classLevel.replace(/^SSS(\d)$/, "SS$1").replace(/^SS(\d)$/, "SSS$1");
  if (alt !== classLevel) {
    topics = await query(alt);
    if (topics.length > 0) return topics;
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
    ctx = await requireSchoolStaff();
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
  if (!canAccessSubject(ctx.perms, existing.subjectId) && !canAccessClass(ctx.perms, existing.classId)) {
    return { error: "Not authorised for this note." };
  }

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
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const note = await prisma.lessonNote.findFirst({
    where: { id: noteId, schoolId: ctx.schoolId },
  });
  if (!note) return { error: "Note not found." };
  if (!canAccessSubject(ctx.perms, note.subjectId) && !canAccessClass(ctx.perms, note.classId)) {
    return { error: "Not authorised for this note." };
  }

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
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const note = await prisma.lessonNote.findFirst({
    where: { id: noteId, schoolId: ctx.schoolId },
  });
  if (!note) return { error: "Note not found." };
  if (!canAccessSubject(ctx.perms, note.subjectId) && !canAccessClass(ctx.perms, note.classId)) {
    return { error: "Not authorised for this note." };
  }

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
