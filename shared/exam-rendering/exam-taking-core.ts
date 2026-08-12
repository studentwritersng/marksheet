import type { AnswerValue, ExamMcqOption, ExamQuestion, SavedAnswersMap } from "./types";

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function remainingFromEndsAt(endsAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

export function shouldAutoSubmit(remainingSeconds: number, endsAt: string | null, thresholdMs = 5000): boolean {
  if (remainingSeconds <= 0) return true;
  if (!endsAt) return false;
  return Date.now() >= new Date(endsAt).getTime() - thresholdMs;
}

export interface SubQuestion {
  letter: string;
  text: string;
}

export function parseSubQuestions(text: string): { stem: string; parts: SubQuestion[] } {
  const regex = /^\s*\(?([a-z])\)\s+(.+)/gim;
  const matches = [...text.matchAll(regex)];
  if (matches.length < 2) return { stem: text, parts: [] };
  const firstIdx = matches[0].index!;
  const stem = text.slice(0, firstIdx).trim();
  const parts: SubQuestion[] = matches.map((m) => ({
    letter: m[1].toLowerCase(),
    text: m[2].trim(),
  }));
  return { stem, parts };
}

export function buildAnswerList(
  ans: SavedAnswersMap,
  parts: Record<string, Record<string, string>>,
): AnswerValue[] {
  return Object.entries(ans).map(([questionId, value]) => {
    const p = parts[questionId];
    if (p) {
      const combined = Object.entries(p)
        .filter(([, v]) => v.trim())
        .map(([l, v]) => `(${l}) ${v}`)
        .join("\n\n");
      return { questionId, essayResponseText: combined || value.essayResponseText };
    }
    return { questionId, ...value };
  });
}

export function buildShuffle(
  questions: Pick<ExamQuestion, "id" | "questionGroupId" | "mcqOptions">[],
  shuffleEnabled: boolean,
): { shuffledQuestionIds: string[] | null; shuffledOptionOrder: Record<string, string[]> | null } {
  if (!shuffleEnabled) return { shuffledQuestionIds: null, shuffledOptionOrder: null };

  const groups = new Map<string, string[]>();
  const standalone: string[] = [];

  for (const q of questions) {
    const gid = q.questionGroupId;
    if (gid) {
      const list = groups.get(gid) || [];
      list.push(q.id);
      groups.set(gid, list);
    } else {
      standalone.push(q.id);
    }
  }

  const items: string[][] = standalone.map((id) => [id]);
  for (const [, ids] of groups) items.push(ids);

  const shuffledQuestionIds = shuffleArray(items).flat();

  const shuffledOptionOrder: Record<string, string[]> = {};
  for (const q of questions) {
    if (q.mcqOptions.length > 0) {
      shuffledOptionOrder[q.id] = shuffleArray(q.mcqOptions.map((o) => o.id));
    }
  }
  return { shuffledQuestionIds, shuffledOptionOrder };
}

export function orderQuestions(
  questions: ExamQuestion[],
  shuffledQuestionIds: string[] | null,
): ExamQuestion[] {
  if (!shuffledQuestionIds || !Array.isArray(shuffledQuestionIds)) return questions;
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const ordered = shuffledQuestionIds.map((id) => qMap.get(id)).filter(Boolean) as ExamQuestion[];
  if (ordered.length === questions.length) return ordered;
  return questions;
}

export function orderOptions(
  questionId: string,
  options: ExamMcqOption[],
  shuffledOptionOrder: Record<string, string[]> | null,
): ExamMcqOption[] {
  if (!shuffledOptionOrder || typeof shuffledOptionOrder !== "object") return options;
  const order = shuffledOptionOrder[questionId];
  if (!order) return options;
  const optMap = new Map(options.map((o) => [o.id, o]));
  return order.map((id) => optMap.get(id)).filter(Boolean) as ExamMcqOption[];
}
