"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { generateQuestionsForTopic } from "./generate";

const MIN_PER_TOPIC = 5;
const BATCH_SIZE = 20;

export interface QuizBankStats {
  totalQuestions: number;
  standardTopicCount: number;
  coveredTopicCount: number;
  topicCoveragePct: number;
}

export async function getQuizBankStats(): Promise<QuizBankStats> {
  const [totalQuestions, standardTopics, covered] = await Promise.all([
    prisma.quizQuestion.count({ where: { status: "live" } }),
    prisma.curriculumTopic.count({ where: { isSystem: true, schoolId: null } }),
    prisma.quizQuestion.groupBy({
      by: ["classLevel", "term", "subject", "topic"],
      where: { status: "live" },
      _count: { _all: true },
    }).then((g) => g.filter((x) => (x._count?._all ?? 0) >= 1).length),
  ]);
  const topicCoveragePct = standardTopics > 0 ? Math.round((covered / standardTopics) * 100) : 0;
  return { totalQuestions, standardTopicCount: standardTopics, coveredTopicCount: covered, topicCoveragePct };
}

export async function generateQuizBankAction(_prev: { error?: string; success?: string; processed?: number }, formData: FormData): Promise<{ error?: string; success?: string; processed?: number }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") return { error: "Not authorised." };

  // Topics lacking enough live questions, capped to one batch.
  const topics = await prisma.curriculumTopic.findMany({
    where: { isSystem: true, schoolId: null },
    select: { id: true, classLevel: true, term: true, subject: true, topic: true },
    take: BATCH_SIZE,
  });

  // Determine which already meet the minimum.
  const existing = await prisma.quizQuestion.groupBy({
    by: ["classLevel", "term", "subject", "topic"],
    where: { status: "live" },
    _count: { _all: true },
  });
  const have = new Map(existing.map((e) => [`${e.classLevel}|${e.term}|${e.subject}|${e.topic}`, e._count._all ?? 0]));

  let processed = 0;
  for (const t of topics) {
    const key = `${t.classLevel}|${t.term}|${t.subject}|${t.topic}`;
    const haveCount = have.get(key) ?? 0;
    if (haveCount >= MIN_PER_TOPIC) continue;
    const needed = MIN_PER_TOPIC - haveCount;
    const qs = await generateQuestionsForTopic({
      classLevel: t.classLevel, term: t.term, subject: t.subject, topic: t.topic, count: needed,
    });
    if (qs.length === 0) continue;
    await prisma.quizQuestion.createMany({
      data: qs.map((q) => ({
        classLevel: t.classLevel, term: t.term, subject: t.subject, topic: t.topic,
        curriculumTopicId: t.id, questionText: q.questionText, options: q.options,
        correctIndex: q.correctIndex, explanation: q.explanation, difficulty: q.difficulty, points: q.points,
        status: "live",
      })),
    });
    processed++;
  }
  return { success: `Processed ${processed} topic(s) this batch.`, processed };
}
