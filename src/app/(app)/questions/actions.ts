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
    include: { subject: true, class: true },
  });
  if (!note) return { error: "Lesson note not found." };

  const noteContent = [
    note.previousKnowledge ? `Previous Knowledge: ${note.previousKnowledge}` : "",
    note.introduction ? `Introduction: ${note.introduction}` : "",
    note.content ? `Content: ${note.content}` : "",
    note.evaluation ? `Evaluation: ${note.evaluation}` : "",
    note.summary ? `Summary: ${note.summary}` : "",
    note.assignment ? `Assignment: ${note.assignment}` : "",
  ].filter(Boolean).join("\n\n") || note.content || "";

  const result = await createCompletion({
    taskType: "question_generation",
    messages: [
      {
        role: "system",
        content: `You are an experienced Nigerian secondary school examiner setting essay questions for an exam. You will generate essay question(s) based on the lesson note provided below, following a specific balance between lesson-note-grounded content and topic-relevant extension.

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
1. Write a clear essay question testing understanding of the topic.
2. Write a model answer that fully addresses the question.
3. Write a rubric with discrete rubric points, each with mark allocation, tagged "grounded" or "extension".

Do not generate multiple-choice content.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "questions": [
    {
      "question_text": "...",
      "marks": <number>,
      "difficulty": "<difficulty>",
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
Class: ${note.class?.name ?? "N/A"}
Topic: ${note.topic}
Lesson note content: ${noteContent.slice(0, 3000)}

Number of essay questions to generate: 3
Marks per question: 5
Grounding percentage: 75
Target difficulty: application`,
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

/** Fetch published lesson notes for a subject. */
export async function getLessonNotesBySubjectAction(subjectId: string): Promise<{ id: string; topic: string; class: string }[]> {
  const notes = await prisma.lessonNote.findMany({
    where: { subjectId, status: "published" },
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
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const subjectId = String(formData.get("subjectId") ?? "");
  const noteIdsRaw = formData.getAll("lessonNoteIds") as string[];
  if (!subjectId || noteIdsRaw.length === 0) return { error: "Select a subject and at least one lesson note." };

  const notes = await prisma.lessonNote.findMany({
    where: { id: { in: noteIdsRaw }, schoolId: ctx.schoolId, status: "published" },
    include: { subject: true, class: true },
  });
  if (notes.length === 0) return { error: "No published lesson notes found." };

  const combinedContent = notes.map((n) => {
    const sections = [
      n.previousKnowledge ? `Previous Knowledge: ${n.previousKnowledge}` : "",
      n.introduction ? `Introduction: ${n.introduction}` : "",
      n.content ? `Content: ${n.content}` : "",
      n.evaluation ? `Evaluation: ${n.evaluation}` : "",
      n.summary ? `Summary: ${n.summary}` : "",
      n.assignment ? `Assignment: ${n.assignment}` : "",
    ];
    const body = sections.filter(Boolean).join("\n\n") || "";
    return `--- Lesson Note: ${n.topic} (${n.class.name}) ---\n${body.slice(0, 2000)}`;
  }).join("\n\n");

  const subjectNames = [...new Set(notes.map((n) => n.subject?.name).filter(Boolean))].join(", ");

  const result = await createCompletion({
    taskType: "question_generation",
    messages: [
      {
        role: "system",
        content: `You are an experienced Nigerian secondary school examiner setting essay questions for an exam. You will generate essay question(s) based on the lesson notes provided below, following a specific balance between lesson-note-grounded content and topic-relevant extension.

CRITICAL — GROUNDING RATIO
You will be given a grounding_percentage value. This determines the proportion of each question's rubric points that must be:
- "grounded": directly traceable to specific content in the provided lesson note(s).
- "extension": correct, curriculum-appropriate content on the same topic that goes beyond what the lesson note explicitly covers.

Apply this ratio per question. Distribute remainder toward grounded points.

LANGUAGE AND CONTEXT RULES (STRICT)
- British English throughout (colour, organise, favourite, centre).
- Scenarios, names, and examples must be typical of the Nigerian context.

TASK
For each question:
1. Write a clear essay question testing understanding of the topic.
2. Write a model answer that fully addresses the question.
3. Write a rubric with discrete rubric points, each with mark allocation, tagged "grounded" or "extension".

Do not generate multiple-choice content.

Output valid JSON only, with this exact shape and no additional text before or after it:
{
  "questions": [
    {
      "question_text": "...",
      "marks": <number>,
      "difficulty": "<difficulty>",
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
        content: `Subject: ${subjectNames || "the subject"}
Number of lesson notes provided: ${notes.length}
Lesson note content:\n${combinedContent.slice(0, 8000)}

Number of essay questions to generate: 3
Marks per question: 5
Grounding percentage: 75
Target difficulty: application`,
      },
    ],
    temperature: 0.6,
  });

  // Create a placeholder question record
  await prisma.question.create({
    data: {
      schoolId: ctx.schoolId,
      subjectId,
      type: "essay",
      text: `[AI Generated from ${notes.length} lesson notes]\n\n${result.content.slice(0, 500)}`,
      marks: 5,
      source: "ai_generated",
      status: "draft",
      createdBy: ctx.user.userId,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "question",
    afterValue: { subjectId, source: "ai_generated", lessonNoteCount: notes.length } as never,
  });

  revalidatePath("/questions");
  return { success: `AI questions generated from ${notes.length} lesson note(s). Review in drafts.` };
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
