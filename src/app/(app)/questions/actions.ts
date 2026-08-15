"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireSchoolStaff, canAccessSubject, canManageSchool } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { createCompletion } from "@/lib/ai/gateway";
import { fixJson } from "@/lib/json-utils";
import { classLevelGuidance } from "@/lib/ai/class-level-guidance";
import type { Prisma } from "@prisma/client";

export interface ActionState {
  error?: string;
  success?: string;
}

/** Manual question creation (MCQ or Essay). */
export async function createQuestionAction(
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
  const type = String(formData.get("type") ?? ""); // mcq | essay
  const text = String(formData.get("text") ?? "").trim();
  const marks = Number(formData.get("marks") ?? 1);
  const difficulty = String(formData.get("difficulty") ?? "").trim() || null;
  const topic = String(formData.get("topic") ?? "").trim() || null;
  const classLevel = String(formData.get("classLevel") ?? "").trim() || null;
  const modelAnswer = String(formData.get("modelAnswer") ?? "").trim();
  const rubricJson = String(formData.get("rubricPoints") ?? "");
  const optionA = String(formData.get("optionA") ?? "").trim();
  const optionB = String(formData.get("optionB") ?? "").trim();
  const optionC = String(formData.get("optionC") ?? "").trim();
  const optionD = String(formData.get("optionD") ?? "").trim();
  const correctAnswer = String(formData.get("correctAnswer") ?? "").trim();
  const questionGroupId = String(formData.get("questionGroupId") ?? "").trim() || null;

  if (!subjectId || !text) return { error: "Subject and question text are required." };
  if (type === "mcq" && !correctAnswer) return { error: "Select the correct answer for MCQ." };
  if (type === "essay" && !modelAnswer) return { error: "Model answer is required for essay questions." };

  if (!canAccessSubject(ctx.perms, subjectId)) {
    return { error: "Not authorised for this subject." };
  }

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!subject) return { error: "Subject not found for this school." };
  if (questionGroupId) {
    const group = await prisma.questionGroup.findFirst({
      where: { id: questionGroupId, subjectId, subject: { schoolId: ctx.schoolId } },
      select: { id: true },
    });
    if (!group) return { error: "Question group not found for this school." };
  }

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
      topic,
      classLevel,
      type: type === "mcq" ? "mcq" : "essay",
      text,
      marks,
      difficulty,
      source: "manual",
      status: "pending_review",
      createdBy: ctx.user.userId,
      ...(questionGroupId ? { questionGroupId } : {}),
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

/** Update an existing question (text, marks, topic, classLevel, options, etc). */
export async function updateQuestionAction(
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

  const questionId = String(formData.get("questionId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const type = String(formData.get("type") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const marks = Number(formData.get("marks") ?? 1);
  const difficulty = String(formData.get("difficulty") ?? "").trim() || null;
  const topic = String(formData.get("topic") ?? "").trim() || null;
  const classLevel = String(formData.get("classLevel") ?? "").trim() || null;
  const modelAnswer = String(formData.get("modelAnswer") ?? "").trim();
  const rubricJson = String(formData.get("rubricPoints") ?? "");
  const optionA = String(formData.get("optionA") ?? "").trim();
  const optionB = String(formData.get("optionB") ?? "").trim();
  const optionC = String(formData.get("optionC") ?? "").trim();
  const optionD = String(formData.get("optionD") ?? "").trim();
  const correctAnswer = String(formData.get("correctAnswer") ?? "").trim();

  if (!questionId) return { error: "Missing question ID." };
  if (!subjectId || !text) return { error: "Subject and question text are required." };
  if (type === "mcq" && !correctAnswer) return { error: "Select the correct answer for MCQ." };
  if (type === "essay" && !modelAnswer) return { error: "Model answer is required for essay questions." };

  if (!canAccessSubject(ctx.perms, subjectId)) {
    return { error: "Not authorised for this subject." };
  }

  const existing = await prisma.question.findUnique({ where: { id: questionId } });
  if (!existing || existing.schoolId !== ctx.schoolId) return { error: "Question not found." };
  if (!canAccessSubject(ctx.perms, existing.subjectId)) {
    return { error: "Not authorised for this question." };
  }

  let rubricPoints = [];
  if (rubricJson) {
    try { rubricPoints = JSON.parse(rubricJson); } catch { return { error: "Invalid rubric JSON." }; }
  }

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: questionId },
      data: {
        subjectId,
        topic,
        classLevel,
        type: type === "mcq" ? "mcq" : "essay",
        text,
        marks,
        difficulty,
        ...(type === "essay"
          ? {
              essaySpec: {
                upsert: {
                  create: { modelAnswer, rubricPoints: rubricPoints.length > 0 ? rubricPoints : [{ description: "General correctness", mark: marks }] },
                  update: { modelAnswer, rubricPoints: rubricPoints.length > 0 ? rubricPoints : [{ description: "General correctness", mark: marks }] },
                },
              },
            }
          : {}),
      },
    });

    if (type === "mcq") {
      await tx.mcqOption.deleteMany({ where: { questionId } });
      const options = [
        { optionText: optionA, isCorrect: correctAnswer === "A" },
        { optionText: optionB, isCorrect: correctAnswer === "B" },
        { optionText: optionC, isCorrect: correctAnswer === "C" },
        { optionText: optionD, isCorrect: correctAnswer === "D" },
      ].filter((o) => o.optionText);
      for (const opt of options) {
        await tx.mcqOption.create({ data: { questionId, optionText: opt.optionText, isCorrect: opt.isCorrect } });
      }
    }
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "update", entityType: "question",
    entityId: questionId,
    afterValue: { subjectId, type, text, marks } as never,
  });

  revalidatePath("/questions");
  return { success: "Question updated." };
}

/** AI-generate questions from lesson notes. */
export async function aiGenerateQuestionsAction(
  lessonNoteId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const note = await prisma.lessonNote.findFirst({
    where: { id: lessonNoteId, schoolId: ctx.schoolId },
    include: { subject: true, class: true },
  });
  if (!note) return { error: "Lesson note not found." };
  if (!canAccessSubject(ctx.perms, note.subjectId)) {
    return { error: "Not authorised for this subject." };
  }

  const noteContent = note.content ? `Student's Note:\n${note.content}` : "";
  const noteClassLevel = note.class?.level ?? note.class?.name ?? "JSS1";
  const levelGuidance = classLevelGuidance(noteClassLevel);

  const result = await createCompletion({
    taskType: "question_generation",
    schoolId: ctx.schoolId,
    userId: ctx.user.userId,
    messages: [
      {
        role: "system",
        content: `You are an experienced Nigerian secondary school examiner setting essay questions for an exam. You will generate essay question(s) based on the lesson note provided below, following a specific balance between lesson-note-grounded content and topic-relevant extension.

${levelGuidance}

DIFFICULTY DISTRIBUTION
Distribute questions 40% Easy, 40% Medium, 20% Hard. Easy = basic recall, Medium = understanding, Hard = application/analysis — all RELATIVE to the class level rules above.

CRITICAL — GROUNDING RATIO
You will be given a grounding_percentage value. This determines the proportion of each question's rubric points that must be:
- "grounded": directly traceable to specific content in the provided lesson note(s).
- "extension": correct, curriculum-appropriate content on the same topic that goes beyond what the lesson note explicitly covers.

Apply this ratio per question. Distribute remainder toward grounded points.

EXTENSION CONTENT BOUNDARIES
- Must remain within the same topic — never drift into unrelated topics.
- Must be accurate, standard curriculum knowledge appropriate to the class level.
- If unsure, prefer a grounded point instead.

LANGUAGE AND CONTEXT RULES (STRICT)
- British English throughout (colour, organise, favourite, centre).
- Scenarios, names, and examples must be typical of the Nigerian context.

TASK
For each question:
1. Write a clear essay question testing understanding of the topic, strictly obeying the class-level rules above.
2. Write a model answer that fully addresses the question, written at the vocabulary and sentence complexity level appropriate for this class.
3. Write a rubric with discrete rubric points, each with mark allocation, tagged "grounded" or "extension".

Do not generate multiple-choice content.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "questions": [
    {
      "question_text": "...",
      "marks": <number>,
      "difficulty": "Easy" | "Medium" | "Hard",
      "model_answer": "...",
      "rubric_points": [
        {
          "description": "...",
          "marks": <number>,
          "source_type": "grounded" | "extension",
          "lesson_note_reference": "<short reference or empty string>"
        }
      ],
      "grounding_summary": {
        "target_grounding_percentage": <number>,
        "actual_grounded_points": <count>,
        "actual_extension_points": <count>
      }
    }
  ]
}`,
      },
      {
        role: "user",
        content: `Subject: ${note.subject?.name ?? "the subject"}
Class: ${noteClassLevel}
Topic: ${note.topic}
Lesson note content: ${noteContent.slice(0, 3000)}

Number of essay questions to generate: 3
Marks per question: 5
Grounding percentage: 75
Difficulty distribution: 1 Easy, 1 Medium, 1 Hard`,
      },
    ],
    temperature: 0.6,
    maxTokens: 8192,
  });

  // Parse the AI JSON response — strip markdown fences first
  let cleanContent = result.content.trim();
  cleanContent = cleanContent.replace(/^```(?:json)?\s*([\s\S]*?)```$/i, "$1").trim();
  const jsonStart = cleanContent.search(/[{[]/);
  if (jsonStart > 0) cleanContent = cleanContent.slice(jsonStart);

  // Fix common JSON issues: trailing commas, missing brackets, unterminated strings
  cleanContent = fixJson(cleanContent);

  let parsed: { questions?: unknown[] } = {};
  let parseError = "";
  try {
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    parseError = String(e);
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  if (questions.length === 0) {
    // Fallback: store raw content
    await prisma.question.create({
      data: {
        schoolId: ctx.schoolId,
        subjectId: note.subjectId,
        topic: note.topic,
        classLevel: note.class?.name ?? null,
        type: "essay",
        text: `[AI Generated from: ${note.topic}]\n\n${result.content.slice(0, 500)}`,
        marks: 5,
        source: "ai_generated",
        status: "draft",
        lessonNoteId: note.id,
        createdBy: ctx.user.userId,
      },
    });
  } else {
    for (const q of questions) {
      const qm = q as Record<string, unknown>;
      const qText = String(qm.question_text ?? "");
      const qMarks = Number(qm.marks ?? 5);
      const qDiff = String(qm.difficulty ?? "Medium");
      await prisma.question.create({
        data: {
          schoolId: ctx.schoolId,
          subjectId: note.subjectId,
          topic: note.topic,
          classLevel: note.class?.name ?? null,
          type: "essay",
          text: qText,
          marks: qMarks,
          difficulty: qDiff,
          source: "ai_generated",
          status: "draft",
          lessonNoteId: note.id,
          createdBy: ctx.user.userId,
        },
      });
    }
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "question",
    afterValue: { subjectId: note.subjectId, source: "ai_generated", lessonNoteId: note.id } as never,
  });

  revalidatePath("/questions");
  return { success: `AI ${questions.length > 0 ? questions.length + " " : ""}questions generated from "${note.topic}". Review in drafts.` };
}

/** Fetch published lesson notes for a subject, optionally filtered by class level. */
export async function getLessonNotesBySubjectAction(subjectId: string, classLevel?: string): Promise<{ id: string; topic: string; class: string }[]> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return [];
  const { resolvePermissions } = await import("@/lib/auth/permissions");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) && !perms.visibleSubjectIds.has(subjectId)) return [];
  const where: Record<string, unknown> = { subjectId, status: "published", schoolId: user.schoolId };
  if (classLevel) {
    where.class = { level: classLevel };
  }
  const notes = await prisma.lessonNote.findMany({
    where: where as never,
    include: { class: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return notes.map((n) => ({ id: n.id, topic: n.topic, class: n.class.name }));
}

/** AI-generate questions from multiple selected lesson notes. */
export async function aiGenerateQuestionsMultiAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx: Awaited<ReturnType<typeof requireSchoolStaff>>;
  try {
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const noteIdsRaw = formData.getAll("lessonNoteIds") as string[];
  if (!subjectId || noteIdsRaw.length === 0) return { error: "Select a subject and at least one lesson note." };
  if (!canAccessSubject(ctx.perms, subjectId)) {
    return { error: "Not authorised for this subject." };
  }

  const topic = String(formData.get("topic") ?? "").trim() || "Untitled";
  const questionType = String(formData.get("questionType") ?? "essay"); // mcq | essay
  const questionCount = Math.max(1, Math.min(100, Number(formData.get("questionCount") ?? 3)));
  const classLevel = String(formData.get("classLevel") ?? "SSS1");
  const marksPerQuestion = Math.max(1, Number(formData.get("marksPerQuestion") ?? 5));
  const groundingPercentage = Math.max(0, Math.min(100, Number(formData.get("groundingPercentage") ?? 75)));

  // 40-40-20 difficulty distribution
  const easyCount = Math.round(questionCount * 0.4);
  const mediumCount = Math.round(questionCount * 0.4);
  const hardCount = questionCount - easyCount - mediumCount;

  const notes = await prisma.lessonNote.findMany({
    where: { id: { in: noteIdsRaw }, schoolId: ctx.schoolId, status: "published" },
    include: { subject: true, class: true },
  });
  if (notes.length === 0) return { error: "No published lesson notes found." };

  const combinedContent = notes.map((n) => {
    const body = n.content ? `Student's Note:\n${n.content}` : "";
    return `--- Lesson Note: ${n.topic} (${n.class.name}) ---\n${body.slice(0, 2000)}`;
  }).join("\n\n");

  const subjectNames = [...new Set(notes.map((n) => n.subject?.name).filter(Boolean))].join(", ");

  const isMcq = questionType === "mcq";
  const levelGuidance = classLevelGuidance(classLevel);

  const systemContent = isMcq
    ? `You are an experienced Nigerian secondary school examiner setting multiple-choice (MCQ) questions for an exam. You will generate MCQ question(s) based on the lesson notes provided below, following a specific balance between lesson-note-grounded content and topic-relevant extension.

${levelGuidance}

NIGERIAN STANDARD MCQ FORMAT — FOLLOW THIS EXACT STYLE
Each MCQ must follow the standard Nigerian school examination format:
- Read the Student's Note section of each selected lesson note carefully, understand its contents, and create class-level questions directly from it.
- Use diverse question types: best answer, negative option ("Which of the following is NOT..."), sentence completion (fill-in-the-blank with ________), comprehension test, cause-and-effect, classification, application to real-life scenarios, and critical thinking questions. Avoid repeating the same question pattern.
- Question stems must be direct, specific knowledge-testing queries (e.g., "Which of the following is a vowel sound?", "The plural of 'child' is ________.", "Which of these is a common weed found on Nigerian farms?").
- NEVER use vague stems like "Which of the following best describes X" or "What is true about Y" — be specific.
- Questions should test recall of facts (Easy), understanding (Medium), or analytical/application thinking (Hard) — all relative to the class-level rules above.
- Options must be specific, concrete statements (not generic descriptions like "A common misconception").
- Distractors must be plausible and drawn from the same topic — common misconceptions, near-miss terms, incorrect but tempting alternatives. Never use obviously absurd options.
- For fill-in-the-blank style, use a blank (________) in the stem.

DIFFICULTY DISTRIBUTION
You will be given a count of how many questions should be Easy, Medium, and Hard. Assign each question's "difficulty" field accordingly — always relative to the class-level rules above.

CRITICAL — THE GROUNDING RATIO CONTROLS DISTRACTOR COMPOSITION, NOT JUST GENERAL TONE
You will be given a grounding_percentage value (0-100). This determines the proportion of the correct-answer knowledge that must be:
- "grounded": directly traceable to specific content in the provided lesson note(s) — the exact fact, rule, term, or example must appear in the Student's Note section below.
- "extension": correct, curriculum-appropriate content on the same topic that goes beyond what the lesson note explicitly covers but remains within the same subject, topic, and class-level scope.

GROUNDING — STUDENT'S NOTE IS THE SOURCE
The lesson note content provided below contains only the Student's Note section — the board-summary content taught to students. This is the authoritative grounding material. Draw all grounded questions from this section.

EXTENSION CONTENT BOUNDARIES (even at low grounding_percentage, these still apply)
- Extension content must remain within the same topic and theme/aspect as the lesson note — never drift into unrelated topics, even ones from the same subject.
- Extension content must be accurate, standard curriculum knowledge appropriate to the specified class level and consistent with what the class-level rules above require.
- If you are not confident a piece of extension content is accurate and curriculum-appropriate, do not include it — prefer a grounded item instead.

DISTRACTOR QUALITY RULES (STRICT)
- Generate exactly 4 options labelled A, B, C, D. Exactly one is correct.
- All names, scenarios, and examples in the question stems and options must be typical of the Nigerian context (Nigerian names, towns, currency, WAEC/NECO references), unless the topic specifically requires otherwise.
- Use British English throughout (colour, organise, favourite, centre — not American spelling).

INPUTS
Subject: {{subject}}
Class: {{class_level}}
Number of MCQ questions to generate: {{question_count}}
Marks per question: {{marks_per_question}}
Grounding percentage: {{grounding_percentage}}
Difficulty distribution (how many of each): {{difficulty_distribution}}
Lesson note(s) — draw grounded questions directly from this content:
{{lesson_note_content}}

IMPORTANT — You must generate the EXACT NUMBER of questions specified in the inputs above ({{question_count}} questions). The "questions" array MUST contain exactly {{question_count}} items — no more, no fewer. Do not stop early. Do not summarise. Generate every single question fully.

TASK
For each of the {{question_count}} MCQ questions:
1. Write a clear stem (question) testing understanding of the topic, strictly obeying the class-level rules above.
2. Provide exactly 4 options (A-D); mark which is correct.
3. For each question, include a short "rationale" explaining why the correct answer is right.

Do not generate essay or long-form content.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "questions": [
    {
      "question_text": "<stem>",
      "marks": <number, equals marks_per_question>,
      "difficulty": "Easy" | "Medium" | "Hard",
      "options": [
        { "label": "A", "text": "...", "is_correct": false },
        { "label": "B", "text": "...", "is_correct": true },
        { "label": "C", "text": "...", "is_correct": false },
        { "label": "D", "text": "...", "is_correct": false }
      ],
      "rationale": "<why B (or whichever) is correct>",
      "grounding_summary": {
        "target_grounding_percentage": {{grounding_percentage}},
        "grounded_count": <count of questions whose correct answer is grounded>,
        "extension_count": <count of questions whose correct answer is extension>
      }
    }
  ]
}`
    : `You are an experienced Nigerian secondary school examiner setting essay (theory) questions for an exam. You will generate essay question(s) based on the lesson notes provided below, following the standard Nigerian examination format.

${levelGuidance}

DIFFICULTY DISTRIBUTION
You will be given counts for Easy, Medium, and Hard questions. Assign each question's "difficulty" field accordingly — always relative to the class-level rules above. Distribute the counts across the questions as specified.

NIGERIAN STANDARD THEORY EXAM FORMAT — FOLLOW THIS EXACT STYLE
Each question must follow the standard Nigerian secondary school theory paper format with sub-parts (a), (b), (c) and mark allocations — adapted to the complexity level specified in the class-level rules above:

EXAMPLE OF CORRECT FORMAT (from a real JSS2 PVS Theory paper):
—
Question 1 [6 marks]
(a) Define the term 'rock' and explain how rocks are related to soil formation. [2 marks]
(b) List and describe the three main types of rocks, giving one (1) example of each. [2 marks]
(c) State two (2) differences between igneous and sedimentary rocks. [2 marks]
—

RULES FOR THE QUESTION TEXT:
1. Use the exact format: "Question N [total marks]\n(a) Instruction... [marks]\n(b) Instruction... [marks]\n(c) Instruction... [marks]"
2. Each sub-part must use appropriate action verbs per the class-level rules above
3. Where applicable, specify quantities in words e.g. "three (3) types", "two (2) differences"
4. Mark allocation per sub-part must be in square brackets [ ]
5. Total marks across all sub-parts must equal marks_per_question
6. Questions must test specific, real content — not generic "discuss the concept of X" but specific questions with concrete requirements

TASK
For each question:
1. Write a clear essay question in the (a)(b)(c) format shown above, strictly obeying the class-level rules above.
2. Write a model answer that fully addresses each sub-part, using vocabulary and sentence complexity appropriate for this class level.
3. Write a rubric: a list of discrete, individually markable points, each with its own mark allocation (summing to marks_per_question), each tagged "grounded" or "extension" per the ratio rule below.

CRITICAL — THE GROUNDING RATIO CONTROLS RUBRIC COMPOSITION, NOT JUST GENERAL TONE
You will be given a grounding_percentage value (0-100). This determines the proportion of each question's rubric points that must be:
- "grounded": directly traceable to specific content in the provided Student's Note section below.
- "extension": correct, curriculum-appropriate content on the same topic that goes beyond what the lesson note explicitly covers, but remains within the same subject, topic, and class-level scope.

GROUNDING — STUDENT'S NOTE IS THE SOURCE
The lesson note content provided below contains only the Student's Note section — the board-summary content taught to students. This is the authoritative grounding material. Draw all grounded rubric points from this section.

Apply this ratio per question: if a question's rubric has 4 points and grounding_percentage is 75, 3 points should be grounded and 1 should be extension. Round to the nearest whole point count; if the ratio doesn't divide evenly, distribute the remainder toward "grounded".

EXTENSION CONTENT BOUNDARIES (even at low grounding_percentage, these still apply)
- Extension content must remain within the same topic and theme/aspect as the lesson note — never drift into unrelated topics.
- Extension content must be accurate, standard curriculum knowledge appropriate to the class level per the class-level rules above.
- If you are not confident, prefer a grounded point instead.

LANGUAGE AND CONTEXT RULES (STRICT)
- British English throughout (colour, organise, favourite, centre — not American spelling).
- Scenarios, names, and examples used in question wording must be typical of the Nigerian context, unless the topic specifically requires otherwise.

INPUTS
Subject: {{subject}}
Class: {{class_level}}
Topic: {{topic}}
Theme / Aspect: {{theme_or_aspect}}
Lesson note(s) selected (source content — question and grounded rubric points must draw from this):
{{lesson_note_content}}
Number of essay questions to generate: {{question_count}}
Marks per question: {{marks_per_question}}
Grounding percentage (see rule above): {{grounding_percentage}}
Difficulty distribution (how many of each): {{difficulty_distribution}}

Do not generate multiple-choice content. Do not generate a shared passage/stimulus unless explicitly instructed to.

IMPORTANT — You must generate the EXACT NUMBER of questions specified above. The "questions" array must contain exactly that many items.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "questions": [
    {
      "question_text": "<text with (a)(b)(c) sub-parts and mark allocations>",
      "marks": <number, equals marks_per_question>,
      "difficulty": "Easy" | "Medium" | "Hard",
      "model_answer": "<full model answer text covering all sub-parts>",
      "rubric_points": [
        {
          "description": "<the specific point being assessed>",
          "marks": <number>,
          "source_type": "grounded" | "extension",
          "lesson_note_reference": "<short quote or paraphrase of the lesson note section this draws from, or empty string if source_type is extension>"
        }
      ],
      "grounding_summary": {
        "target_grounding_percentage": {{grounding_percentage}},
        "actual_grounded_points": <count>,
        "actual_extension_points": <count>
      }
    }
  ]
}`;

  // Replace {{placeholders}} in system prompt with actual values
  const buildSystemContent = (count: number, eC: number, mC: number, hC: number): string =>
    systemContent
      .replace(/\{\{subject\}\}/g, subjectNames || "the subject")
      .replace(/\{\{class_level\}\}/g, classLevel)
      .replace(/\{\{question_count\}\}/g, String(count))
      .replace(/\{\{marks_per_question\}\}/g, String(marksPerQuestion))
      .replace(/\{\{grounding_percentage\}\}/g, String(groundingPercentage))
      .replace(/\{\{difficulty_distribution\}\}/g, `${eC} Easy, ${mC} Medium, ${hC} Hard`)
      .replace(/\{\{lesson_note_content\}\}/g, combinedContent.slice(0, 4000))
      .replace(/\{\{topic\}\}/g, topic)
      .replace(/\{\{theme_or_aspect\}\}/g, notes[0]?.class?.name ?? classLevel);

  /** Call the AI for a single chunk and return parsed questions. */
  async function generateChunk(chunkCount: number, eC: number, mC: number, hC: number) {
    const systemContent = buildSystemContent(chunkCount, eC, mC, hC);
    const result = await createCompletion({
      taskType: "question_generation",
      schoolId: ctx.schoolId,
      userId: ctx.user.userId,
      messages: [
        { role: "system", content: systemContent },
        {
          role: "user",
          content: `Generate exactly ${chunkCount} ${isMcq ? "MCQ" : "essay"} question${chunkCount !== 1 ? "s" : ""} now.

Subject: ${subjectNames || "the subject"}
Class: ${classLevel}
Number of questions: ${chunkCount}
Marks per question: ${marksPerQuestion}
Grounding percentage: ${groundingPercentage}
Difficulty distribution: ${eC} Easy, ${mC} Medium, ${hC} Hard

${isMcq ? "" : `Lesson note content:\n${combinedContent.slice(0, 6000)}`}

Remember: the "questions" array must have exactly ${chunkCount} item${chunkCount !== 1 ? "s" : ""}. Output JSON only.`,
        },
      ],
      temperature: 0.6,
      maxTokens: isMcq
        ? Math.min(Math.max(4096, chunkCount * 800 + 1000), 32768)
        : Math.min(Math.max(8192, chunkCount * 1200 + 1000), 32768),
    });
    return result;
  }

  /** Parse AI response into question objects, with truncation salvage. */
  function parseAIResponse(rawContent: string): { questions: unknown[]; parseError: string } {
    let clean = rawContent.trim();
    clean = clean.replace(/^```(?:json)?\s*([\s\S]*?)```$/i, "$1").trim();
    const jsonStart = clean.search(/[{[]/);
    if (jsonStart > 0) clean = clean.slice(jsonStart);
    clean = fixJson(clean);

    // locate outermost { … } block
    const outermostObj = (() => {
      const start = clean.indexOf("{");
      if (start < 0) return clean;
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < clean.length; i++) {
        const ch = clean[i];
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depth++;
        if (ch === "}") { depth--; if (depth === 0) return clean.slice(start, i + 1); }
      }
      return clean;
    })();
    if (outermostObj && outermostObj !== clean) clean = outermostObj;

    // Salvage: extract complete question objects from truncated array
    function salvage(raw: string): { questions?: unknown[] } {
      const items: unknown[] = [];
      let i = 0, inStr = false, esc = false, depth = 0, objStart = -1;
      while (i < raw.length) {
        const ch = raw[i];
        if (esc) { esc = false; i++; continue; }
        if (ch === "\\") { esc = true; i++; continue; }
        if (ch === '"') { inStr = !inStr; i++; continue; }
        if (inStr) { i++; continue; }
        if (ch === "{") {
          if (depth === 0) objStart = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && objStart >= 0) {
            try {
              const obj = JSON.parse(raw.slice(objStart, i + 1)) as Record<string, unknown>;
              if (typeof obj.question_text === "string" && Array.isArray(obj.options)) items.push(obj);
            } catch { /* skip */ }
            objStart = -1;
          }
        }
      }
      return items.length > 0 ? { questions: items } : {};
    }

    try {
      const parsed = JSON.parse(clean);
      return { questions: Array.isArray(parsed.questions) ? parsed.questions : [], parseError: "" };
    } catch (e) {
      const salvaged = salvage(clean);
      if ((salvaged.questions?.length ?? 0) > 0) {
        return { questions: salvaged.questions ?? [], parseError: "" };
      }
      // aggressive cleanup fallback
      const moreFixed = clean
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/\/\/.*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      try {
        const parsed = JSON.parse(moreFixed);
        return { questions: Array.isArray(parsed.questions) ? parsed.questions : [], parseError: "" };
      } catch (e2) {
        return { questions: [], parseError: String(e2) };
      }
    }
  }

  // ── Chunked generation: for large batches (>15), generate 10 at a time ──
  const CHUNK_THRESHOLD = 15;
  const CHUNK_SIZE = 10;
  const allQuestions: unknown[] = [];

  if (questionCount <= CHUNK_THRESHOLD) {
    const result = await generateChunk(questionCount, easyCount, mediumCount, hardCount);
    const parsed = parseAIResponse(result.content);
    if (parsed.questions.length > 0) allQuestions.push(...parsed.questions);
    if (parsed.questions.length === 0 && parsed.parseError) {
      console.error("===== AI JSON PARSE FAILED =====");
      console.error("Parse error:", parsed.parseError);
      console.error("Raw length:", result.content.length);
      console.error("Clean (first 500):", result.content.slice(0, 500));
      console.error("Clean (last 2000):", result.content.slice(-2000));
      return { error: `AI returned invalid JSON. The provider may be overloaded or the model may not support structured output. ${parsed.parseError ? `Parse error: ${parsed.parseError.slice(0, 100)}` : "No questions found."}` };
    }
  } else {
    let remaining = questionCount;
    let attempts = 0;
    const maxAttempts = Math.ceil(questionCount / CHUNK_SIZE) * 2;

    while (remaining > 0 && attempts < maxAttempts) {
      const chunkCount = Math.min(CHUNK_SIZE, remaining);
      const eC = Math.round(chunkCount * 0.4);
      const mC = Math.round(chunkCount * 0.4);
      const hC = chunkCount - eC - mC;
      attempts++;

      const result = await generateChunk(chunkCount, eC, mC, hC);
      const parsed = parseAIResponse(result.content);
      const newQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      allQuestions.push(...newQuestions);
      remaining -= newQuestions.length;

      if (newQuestions.length === 0) {
        console.error(`Chunk ${attempts} produced 0 questions (${remaining} remaining)`);
      }
    }
  }

  const questions = allQuestions;
    for (const q of questions) {
      const qm = q as Record<string, unknown>;
      const qText = String(qm.question_text ?? "");
      const qMarks = Number(qm.marks ?? marksPerQuestion);
      const qDiff = String(qm.difficulty ?? "Medium");

      if (isMcq) {
        const opts = (qm.options as { label: string; text: string; is_correct: boolean }[]) ?? [];
        await prisma.question.create({
          data: {
            schoolId: ctx.schoolId,
            subjectId,
            topic,
            classLevel,
            type: "mcq",
            text: qText,
            marks: qMarks,
            difficulty: qDiff,
            source: "ai_generated",
            status: "draft",
            createdBy: ctx.user.userId,
            mcqOptions: {
              create: opts.slice(0, 4).map((o) => ({
                optionText: o.text,
                isCorrect: Boolean(o.is_correct),
              })),
            },
          },
        });
      } else {
        const rubric = (qm.rubric_points as { description: string; marks: number; source_type?: string }[]) ?? [];
        const modelAnswer = String(qm.model_answer ?? "");
        await prisma.question.create({
          data: {
            schoolId: ctx.schoolId,
            subjectId,
            topic,
            classLevel,
            type: "essay",
            text: qText,
            marks: qMarks,
            difficulty: qDiff,
            source: "ai_generated",
            status: "draft",
            createdBy: ctx.user.userId,
            essaySpec: {
              create: {
                modelAnswer,
                rubricPoints: rubric.length > 0 ? rubric.map((r) => ({ description: r.description, mark: r.marks })) : [{ description: "General correctness", mark: qMarks }],
              },
            },
          },
        });
      }
    }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "question",
    afterValue: { subjectId, source: "ai_generated", lessonNoteCount: notes.length, questionType, questionCount } as never,
  });

  revalidatePath("/questions");
  return { success: `AI ${isMcq ? "MCQ" : "essay"} question(s) generated from ${notes.length} lesson note(s). Review in drafts.` };
}

/** Approve a question (HOD/Admin). */
export async function approveQuestionAction(questionId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const q = await prisma.question.findFirst({
    where: { id: questionId, schoolId: ctx.schoolId },
  });
  if (!q) return { error: "Question not found." };
  if (!canAccessSubject(ctx.perms, q.subjectId)) {
    return { error: "Not authorised for this question." };
  }

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
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const q = await prisma.question.findFirst({
    where: { id: questionId, schoolId: ctx.schoolId },
  });
  if (!q) return { error: "Question not found." };
  if (!canAccessSubject(ctx.perms, q.subjectId)) {
    return { error: "Not authorised for this question." };
  }

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

/** Bulk approve all questions in a topic group. */
export async function bulkApproveQuestionsAction(questionIds: string[]): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  if (!questionIds.length) return { error: "No questions selected." };

  const where: Prisma.QuestionWhereInput = {
    id: { in: questionIds },
    schoolId: ctx.schoolId,
    status: { not: "approved" },
    ...(canManageSchool(ctx.perms) ? {} : { subjectId: { in: [...ctx.perms.visibleSubjectIds] } }),
  };

  await prisma.question.updateMany({
    where,
    data: { status: "approved" },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "approve",
    entityType: "question",
    afterValue: { count: questionIds.length, ids: questionIds } as never,
  });

  revalidatePath("/questions");
  return { success: `${questionIds.length} question(s) approved.` };
}

/** Bulk delete all questions in a topic group. */
export async function bulkDeleteQuestionsAction(questionIds: string[]): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  if (!questionIds.length) return { error: "No questions selected." };

  await prisma.question.deleteMany({
    where: {
      id: { in: questionIds },
      schoolId: ctx.schoolId,
      ...(canManageSchool(ctx.perms) ? {} : { subjectId: { in: [...ctx.perms.visibleSubjectIds] } }),
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "delete",
    entityType: "question",
    afterValue: { count: questionIds.length } as never,
  });

  revalidatePath("/questions");
  return { success: `${questionIds.length} question(s) deleted.` };
}

/** Bulk edit topic name for a group of questions. */
export async function bulkEditTopicAction(questionIds: string[], newTopic: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  if (!questionIds.length) return { error: "No questions selected." };
  if (!newTopic.trim()) return { error: "New topic name is required." };

  await prisma.question.updateMany({
    where: {
      id: { in: questionIds },
      schoolId: ctx.schoolId,
      ...(canManageSchool(ctx.perms) ? {} : { subjectId: { in: [...ctx.perms.visibleSubjectIds] } }),
    },
    data: { topic: newTopic.trim() },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "question",
    afterValue: { count: questionIds.length, newTopic: newTopic.trim() } as never,
  });

  revalidatePath("/questions");
  return { success: `Topic renamed to "${newTopic.trim()}" for ${questionIds.length} question(s).` };
}

/** Delete a question. */
export async function deleteQuestionAction(questionId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolStaff();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const q = await prisma.question.findFirst({
    where: { id: questionId, schoolId: ctx.schoolId },
  });
  if (!q) return { error: "Question not found." };
  if (!canAccessSubject(ctx.perms, q.subjectId)) {
    return { error: "Not authorised for this question." };
  }

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

export async function csvImportQuestionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { imported?: number; errors?: string[] }> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised.", imported: 0 }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message, imported: 0 }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const csvContent = String(formData.get("csvContent") ?? "");
  if (!subjectId || !csvContent) return { error: "Subject and CSV content are required.", imported: 0 };
  if (!canAccessSubject(ctx.perms, subjectId)) {
    return { error: "Not authorised for this subject.", imported: 0 };
  }

  const { parseQuestionCsv } = await import("@/lib/csv/question-import");
  const { rows, summary } = parseQuestionCsv(csvContent);

  if (summary.invalid > 0) {
    const errList = rows.filter((r) => !r.valid).flatMap((r) => r.errors.map((e) => `Row ${r.row}: ${e}`));
    return { error: `${summary.invalid} row(s) have errors.`, errors: errList, imported: 0 };
  }

  if (rows.length === 0) return { error: "No valid question rows found.", imported: 0 };

  // Track group titles → group id mappings
  const groupMap = new Map<string, string>();

  let imported = 0;
  for (const row of rows) {
    let questionGroupId: string | undefined;

    if (row.groupTitle) {
      if (!groupMap.has(row.groupTitle)) {
        let stimulusId: string | undefined;
        if (row.stimulusContent) {
          const stimulus = await prisma.stimulus.create({
            data: {
              type: row.stimulusType || "passage",
              content: row.stimulusContent,
              subjectId,
            },
          });
          stimulusId = stimulus.id;
        }
        const group = await prisma.questionGroup.create({
          data: {
            subjectId,
            stimulusId,
            internallyShufflable: false,
          },
        });
        groupMap.set(row.groupTitle, group.id);
      }
      questionGroupId = groupMap.get(row.groupTitle);
    }

    const commonData = {
      schoolId: ctx.schoolId,
      subjectId,
      classLevel: row.classLevel,
      topic: row.topic,
      difficulty: row.difficulty,
      source: "csv_import" as const,
      status: "pending_review" as const,
      createdBy: ctx.user.userId,
      questionGroupId,
    };

    if (row.type === "mcq") {
      const options = [
        { optionText: row.optionA || "", isCorrect: row.correctAnswer === "A" },
        { optionText: row.optionB || "", isCorrect: row.correctAnswer === "B" },
        { optionText: row.optionC || "", isCorrect: row.correctAnswer === "C" },
        { optionText: row.optionD || "", isCorrect: row.correctAnswer === "D" },
      ].filter((o) => o.optionText);

      await prisma.question.create({
        data: {
          ...commonData,
          type: "mcq",
          text: row.text,
          marks: row.marks,
          mcqOptions: { create: options },
        },
      });
    } else {
      let rubricPoints: { description: string; mark: number }[] = [];
      if (row.rubricPoints) {
        try { rubricPoints = JSON.parse(row.rubricPoints); } catch { rubricPoints = [{ description: "General correctness", mark: row.marks }]; }
      } else {
        rubricPoints = [{ description: "General correctness", mark: row.marks }];
      }

      await prisma.question.create({
        data: {
          ...commonData,
          type: "essay",
          text: row.text,
          marks: row.marks,
          essaySpec: { create: { modelAnswer: row.modelAnswer || "", rubricPoints } },
        },
      });
    }
    imported++;
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "create", entityType: "question",
    afterValue: { source: "csv_import", count: imported } as never,
  });

  revalidatePath("/questions");
  return { success: `${imported} question(s) imported from CSV.`, imported };
}

export async function createQuestionGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { groupId?: string }> {
  let ctx;
  try { ctx = await requireSchoolStaff(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const stimulusContent = String(formData.get("stimulusContent") ?? "").trim();
  const stimulusType = String(formData.get("stimulusType") ?? "passage");
  const internallyShufflable = formData.get("internallyShufflable") === "true";

  if (!subjectId) return { error: "Subject is required." };
  if (!stimulusContent) return { error: "Stimulus content is required." };
  if (!canAccessSubject(ctx.perms, subjectId)) {
    return { error: "Not authorised for this subject." };
  }

  const stimulus = await prisma.stimulus.create({
    data: { type: stimulusType, content: stimulusContent, subjectId },
  });

  const group = await prisma.questionGroup.create({
    data: {
      subjectId,
      stimulusId: stimulus.id,
      internallyShufflable,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "create", entityType: "questionGroup",
    afterValue: { groupId: group.id, subjectId } as never,
  });

  return { success: "Question group created. Add questions to it.", groupId: group.id };
}

/**
 * Try to repair malformed JSON from AI output.
 * Handles: truncated mid-string, missing brackets, trailing commas.
 */

