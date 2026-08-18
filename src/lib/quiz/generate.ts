import { createCompletion } from "@/lib/ai/gateway";
import { prisma } from "@/lib/prisma";
import type { GeneratedQuizQuestion, QuizTopicSpec } from "./types";

export function classLevelGuidance(level: string): string {
  const map: Record<string, string> = {
    JSS1: "Lower junior secondary. Use simple vocabulary, concrete everyday Nigerian examples, basic recall.",
    JSS2: "Mid junior secondary. Short sentences, familiar contexts, recall + simple understanding.",
    JSS3: "Upper junior secondary. Clear prose, applied examples, understanding + basic application.",
    SS1: "Lower senior secondary. More formal vocabulary, analytical prompts, application of concepts.",
    SS2: "Mid senior secondary. Formal academic English, analysis and evaluation expected.",
    SS3: "Upper senior secondary (exam-bound). Exam-style phrasing, depth, synthesis and evaluation.",
  };
  return map[level] ?? "Use age-appropriate vocabulary and Nigerian context.";
}

const DIFF_MAP: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

function stripFences(s: string): string {
  let t = s.trim().replace(/^```(?:json)?\s*([\s\S]*?)```$/i, "$1").trim();
  const start = t.search(/[{[]/);
  if (start > 0) t = t.slice(start);
  return t;
}

function fixJson(s: string): string {
  // Remove trailing commas before } or ]
  return s.replace(/,(\s*[}\]])/g, "$1");
}

export function validateQuizQuestion(raw: any): GeneratedQuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const questionText = typeof raw.questionText === "string" ? raw.questionText.trim() : "";
  const options: string[] = Array.isArray(raw.options) ? raw.options.map((o: unknown) => String(o).trim()) : [];
  const correctIndex = Number(raw.correctIndex);
  const difficultyRaw = Number(raw.difficulty);
  if (!questionText) return null;
  if (options.length !== 4 || options.some((o) => !o)) return null;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return null;
  const difficulty = DIFF_MAP[raw.difficulty] ?? (difficultyRaw >= 1 && difficultyRaw <= 3 ? difficultyRaw : 1);
  return {
    questionText,
    options,
    correctIndex,
    explanation: typeof raw.explanation === "string" ? raw.explanation.trim() : undefined,
    difficulty,
    points: difficulty * 10,
  };
}

export async function generateQuestionsForTopic(spec: QuizTopicSpec): Promise<GeneratedQuizQuestion[]> {
  const count = Math.min(Math.max(spec.count ?? 5, 1), 10);
  const prompt = `You are a Nigerian secondary school examiner. Generate ${count} multiple-choice questions for the topic below.
${classLevelGuidance(spec.classLevel)}
Rules:
- Exactly 4 options each, one correct answer.
- Difficulty spread: mix of Easy (1), Medium (2), Hard (3).
- Nigerian context, British English.
- Include a one-sentence explanation for the correct answer.
Output valid JSON only, no markdown:
{ "questions": [ { "questionText": "...", "options": ["","","",""], "correctIndex": 0, "difficulty": "Easy"|"Medium"|"Hard", "explanation": "..." } ] }`;

  const result = await createCompletion({
    taskType: "quiz_generation",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    maxTokens: 4000,
  });

  let parsed: any = {};
  try {
    parsed = JSON.parse(fixJson(stripFences(result.content)));
  } catch {
    return [];
  }
  const list = Array.isArray(parsed.questions) ? parsed.questions : [];
  const valid = list.map(validateQuizQuestion).filter((q: GeneratedQuizQuestion | null): q is GeneratedQuizQuestion => q !== null);
  return valid;
}
