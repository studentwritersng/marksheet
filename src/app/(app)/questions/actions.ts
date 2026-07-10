"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { createCompletion } from "@/lib/ai/gateway";
import { fixJson } from "@/lib/json-utils";

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
      topic,
      classLevel,
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
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const note = await prisma.lessonNote.findFirst({
    where: { id: lessonNoteId, schoolId: ctx.schoolId },
    include: { subject: true, class: true },
  });
  if (!note) return { error: "Lesson note not found." };

  const noteContent = note.content ? `Student's Note:\n${note.content}` : "";

  const result = await createCompletion({
    taskType: "question_generation",
    messages: [
      {
        role: "system",
        content: `You are an experienced Nigerian secondary school examiner setting essay questions for an exam. You will generate essay question(s) based on the lesson note provided below, following a specific balance between lesson-note-grounded content and topic-relevant extension.

DIFFICULTY DISTRIBUTION
Distribute questions 40% Easy, 40% Medium, 20% Hard. Easy = basic recall, Medium = understanding, Hard = application/analysis.

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
Class: ${note.class?.name ?? "N/A"}
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
  const where: Record<string, unknown> = { subjectId, status: "published" };
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
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const noteIdsRaw = formData.getAll("lessonNoteIds") as string[];
  if (!subjectId || noteIdsRaw.length === 0) return { error: "Select a subject and at least one lesson note." };

  const topic = String(formData.get("topic") ?? "").trim() || "Untitled";
  const questionType = String(formData.get("questionType") ?? "essay"); // mcq | essay
  const questionCount = Math.max(1, Math.min(50, Number(formData.get("questionCount") ?? 3)));
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

  const systemContent = isMcq
    ? `You are an experienced Nigerian secondary school examiner setting multiple-choice (MCQ) questions for an exam. You will generate MCQ question(s) based on the lesson notes provided below, following a specific balance between lesson-note-grounded content and topic-relevant extension.

NIGERIAN STANDARD MCQ FORMAT — FOLLOW THIS EXACT STYLE
Each MCQ must follow the standard Nigerian school examination format:
- Read the Student's Note section of each selected lesson note carefully, understand its contents, and create class-level questions directly from it.
- Use diverse question types: best answer, negative option ("Which of the following is NOT..."), sentence completion (fill-in-the-blank with ________), comprehension test, cause-and-effect, classification, application to real-life scenarios, and critical thinking questions. Avoid repeating the same question pattern.
- Question stems must be direct, specific knowledge-testing queries (e.g., "Which of the following is a vowel sound?", "The plural of 'child' is ________.", "Which of these is a common weed found on Nigerian farms?").
- NEVER use vague stems like "Which of the following best describes X" or "What is true about Y" — be specific.
- Questions should test recall of facts (Easy), understanding (Medium), or analytical/application thinking (Hard), matching the assigned difficulty tag.
- Options must be specific, concrete statements (not generic descriptions like "A common misconception").
- Distractors must be plausible and drawn from the same topic — common misconceptions, near-miss terms, incorrect but tempting alternatives. Never use obviously absurd options.
- For fill-in-the-blank style, use a blank (________) in the stem.

DIFFICULTY DISTRIBUTION
You will be given a count of how many questions should be Easy, Medium, and Hard. Assign each question's "difficulty" field accordingly — easy questions test basic recall, medium questions test understanding, hard questions test application/analysis.

CRITICAL — THE GROUNDING RATIO CONTROLS DISTRACTOR COMPOSITION, NOT JUST GENERAL TONE
You will be given a grounding_percentage value (0-100). This determines the proportion of the correct-answer knowledge that must be:
- "grounded": directly traceable to specific content in the provided lesson note(s) — the exact fact, rule, term, or example must appear in the Student's Note section below.
- "extension": correct, curriculum-appropriate content on the same topic that goes beyond what the lesson note explicitly covers but remains within the same subject, topic, and class-level scope.

GROUNDING — STUDENT'S NOTE IS THE SOURCE
The lesson note content provided below contains only the Student's Note section — the board-summary content taught to students. This is the authoritative grounding material. Draw all grounded questions from this section.

EXTENSION CONTENT BOUNDARIES (even at low grounding_percentage, these still apply)
- Extension content must remain within the same topic and theme/aspect as the lesson note — never drift into unrelated topics, even ones from the same subject.
- Extension content must be accurate, standard curriculum knowledge appropriate to the specified class level and consistent with what WAEC/NECO would expect a student at that level to know.
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

TASK
For each MCQ:
1. Write a clear stem (question) testing understanding of the topic, pitched at the given difficulty and class level.
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

DIFFICULTY DISTRIBUTION
You will be given counts for Easy, Medium, and Hard questions. Assign each question's "difficulty" field accordingly: Easy = basic recall, Medium = understanding, Hard = application/analysis. Distribute the counts across the questions as specified.

NIGERIAN STANDARD THEORY EXAM FORMAT — FOLLOW THIS EXACT STYLE
Each question must follow the standard Nigerian secondary school theory paper format with sub-parts (a), (b), (c) and mark allocations:

EXAMPLE OF CORRECT FORMAT (from a real JSS2 PVS Theory paper):
—
Question 1 [6 marks]
(a) Define the term 'rock' and explain how rocks are related to soil formation. [2 marks]
(b) List and describe the three main types of rocks, giving one (1) example of each. [2 marks]
(c) State two (2) differences between igneous and sedimentary rocks. [2 marks]
—

RULES FOR THE QUESTION TEXT:
1. Use the exact format: "Question N [total marks]\n(a) Instruction... [marks]\n(b) Instruction... [marks]\n(c) Instruction... [marks]"
2. Each sub-part must use appropriate action verbs: Define, List, State, Explain, Describe, Differentiate, Identify, Calculate, Give examples of
3. Where applicable, specify quantities in words e.g. "three (3) types", "two (2) differences"
4. Mark allocation per sub-part must be in square brackets [ ]
5. Total marks across all sub-parts must equal marks_per_question
6. Questions must test specific, real content — not generic "discuss the concept of X" but specific questions with concrete requirements

TASK
For each question:
1. Write a clear essay question in the (a)(b)(c) format shown above, pitched at the given difficulty and class level.
2. Write a model answer that fully addresses each sub-part.
3. Write a rubric: a list of discrete, individually markable points, each with its own mark allocation (summing to marks_per_question), each tagged "grounded" or "extension" per the ratio rule below.

CRITICAL — THE GROUNDING RATIO CONTROLS RUBRIC COMPOSITION, NOT JUST GENERAL TONE
You will be given a grounding_percentage value (0-100). This determines the proportion of each question's rubric points that must be:
- "grounded": directly traceable to specific content in the provided Student's Note section below.
- "extension": correct, curriculum-appropriate content on the same topic that goes beyond what the lesson note explicitly covers, but remains within the same subject, topic, and class-level scope.

GROUNDING — STUDENT'S NOTE IS THE SOURCE
The lesson note content provided below contains only the Student's Note section — the board-summary content taught to students. This is the authoritative grounding material. Draw all grounded rubric points from this section.

Apply this ratio per question: if a question's rubric has 4 points and grounding_percentage is 75, 3 points should be grounded and 1 should be extension. Round to the nearest whole point count; if the ratio doesn't divide evenly across a question's point count, distribute the remainder toward "grounded" (grounding takes priority in ties).

EXTENSION CONTENT BOUNDARIES (even at low grounding_percentage, these still apply)
- Extension content must remain within the same topic and theme/aspect as the lesson note — never drift into unrelated topics, even ones from the same subject.
- Extension content must be accurate, standard curriculum knowledge appropriate to the specified class level and consistent with what WAEC/NECO would expect a student at that level to know — not obscure, advanced-beyond-level, or speculative content.
- If you are not confident a piece of extension content is accurate and curriculum-appropriate, do not include it — prefer a grounded point instead, even if this means the actual ratio falls slightly short of the target.

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

IMPORTANT — You must generate the EXACT NUMBER of questions specified in the "Number of essay questions to generate" instruction above. The "questions" array in the output JSON must contain exactly that many items — one per question. Do not generate fewer or more than the specified count.

Output valid JSON only, with this exact shape and no additional text before or after it. The shape below shows a single question object — repeat it N times (N = the specified question count) inside the "questions" array:
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

  const result = await createCompletion({
    taskType: "question_generation",
    messages: [
      { role: "system", content: systemContent },
      {
        role: "user",
        content: `Subject: ${subjectNames || "the subject"}
Class: ${classLevel}
Number of ${isMcq ? "MCQ" : "essay"} questions to generate: ${questionCount}
Marks per question: ${marksPerQuestion}
Grounding percentage: ${groundingPercentage}
Difficulty distribution: ${easyCount} Easy, ${mediumCount} Medium, ${hardCount} Hard (distribute across the questions)

Lesson note content:\n${combinedContent.slice(0, 8000)}`,
      },
    ],
    temperature: 0.6,
    maxTokens: isMcq ? 4096 : 8192,
  });

  // Parse the AI JSON response — strip markdown fences first
  let cleanContent = result.content.trim();
  cleanContent = cleanContent.replace(/^```(?:json)?\s*([\s\S]*?)```$/i, "$1").trim();
  const jsonStart = cleanContent.search(/[{[]/);
  if (jsonStart > 0) cleanContent = cleanContent.slice(jsonStart);

  // Fix common JSON issues: trailing commas, missing brackets, unterminated strings
  cleanContent = fixJson(cleanContent);

  // One more pass: try to locate the outermost { … } block and extract only that
  const outermostObj = (() => {
    const start = cleanContent.indexOf("{");
    if (start < 0) return cleanContent;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < cleanContent.length; i++) {
      const ch = cleanContent[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      if (ch === "}") { depth--; if (depth === 0) { return cleanContent.slice(start, i + 1); } }
    }
    return cleanContent;
  })();

  if (outermostObj && outermostObj !== cleanContent) {
    // Re-run fixJson on the extracted block in case braces inside strings confused it
    cleanContent = outermostObj;
  }

  let parsed: { questions?: unknown[] } = {};
  let parseError = "";
  try {
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    // Try again with more aggressive fixes
    const moreFixed = cleanContent
      .replace(/,\s*([}\]])/g, "$1")       // remove trailing commas
      .replace(/\/\/.*/g, "")               // remove // comments
      .replace(/\/\*[\s\S]*?\*\//g, "");    // remove /* */ comments
    try {
      parsed = JSON.parse(moreFixed);
    } catch (e2) {
      parseError = String(e2);
    }
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  if (questions.length === 0) {
    console.error("===== AI JSON PARSE FAILED =====");
    console.error("Parse error:", parseError);
    console.error("Raw AI response length:", result.content.length);
    console.error("Clean content length:", cleanContent.length);
    console.error("Clean content (first 500):", cleanContent.slice(0, 500));
    console.error("Clean content (last 2000):", cleanContent.slice(-2000));
    console.error("===== END AI OUTPUT =====");
    return { error: `AI returned invalid JSON. The provider may be overloaded or the model may not support structured output. ${parseError ? `Parse error: ${parseError.slice(0, 100)}` : "No questions found in response."}` };
  } else {
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

/** Approve a question (PRD 05 §3.5 — HOD/Admin). */
export async function approveQuestionAction(questionId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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

/** Bulk approve all questions in a topic group. */
export async function bulkApproveQuestionsAction(questionIds: string[]): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  if (!questionIds.length) return { error: "No questions selected." };

  await prisma.question.updateMany({
    where: { id: { in: questionIds }, schoolId: ctx.schoolId, status: { not: "approved" } },
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
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  if (!questionIds.length) return { error: "No questions selected." };

  await prisma.question.deleteMany({
    where: { id: { in: questionIds }, schoolId: ctx.schoolId },
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
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  if (!questionIds.length) return { error: "No questions selected." };
  if (!newTopic.trim()) return { error: "New topic name is required." };

  await prisma.question.updateMany({
    where: { id: { in: questionIds }, schoolId: ctx.schoolId },
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
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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

/**
 * Try to repair malformed JSON from AI output.
 * Handles: truncated mid-string, missing brackets, trailing commas.
 */

