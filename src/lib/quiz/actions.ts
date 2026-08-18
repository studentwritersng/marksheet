"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isAddonActive } from "@/lib/addons/check";
import type { SessionPayload } from "@/lib/auth/session";
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

export interface AvailableQuiz {
  key: string;
  title: string;
  subject: string | null;
  mode: "daily" | "practice";
  available: boolean;
  questionCount: number;
}

async function getStudentQuizScope(user: SessionPayload) {
  const student = await prisma.student.findFirst({
    where: { userId: user.userId, schoolId: user.schoolId ?? "" },
    include: {
      currentClass: {
        select: {
          level: true,
          id: true,
          classSubjects: { select: { subject: { select: { name: true } } } },
        },
      },
    },
  });
  if (!student?.currentClass) return null;

  const level = student.currentClass.level;
  const termRec = await prisma.term.findFirst({
    where: { session: { schoolId: user.schoolId ?? "", isCurrent: true }, isCurrent: true },
    select: { name: true },
  });
  const term = (termRec?.name ?? "FIRST").toString().toUpperCase();
  const subjects = student.currentClass.classSubjects.map((c) => c.subject.name);

  return { studentId: student.id, level, term, subjects };
}

export async function getAvailableQuizzesAction(): Promise<AvailableQuiz[]> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return [];
  if (!(await isAddonActive(user.schoolId, "Assessment"))) return [];

  const scope = await getStudentQuizScope(user);
  if (!scope) return [];

  const { level, term, subjects } = scope;

  // Daily eligibility: no daily attempt today.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dailyTaken = await prisma.quizAttempt.count({
    where: { studentId: scope.studentId, mode: "daily", completedAt: { gte: startOfDay } },
  });

  const dailyCount = await prisma.quizQuestion.count({
    where: { status: "live", classLevel: level, term, subject: { in: subjects } },
  });

  const quizzes: AvailableQuiz[] = [
    {
      key: "daily",
      title: "Daily Quiz",
      subject: null,
      mode: "daily",
      available: !dailyTaken && dailyCount > 0,
      questionCount: Math.min(dailyCount, 10),
    },
  ];

  for (const subj of subjects) {
    const c = await prisma.quizQuestion.count({
      where: { status: "live", classLevel: level, term, subject: subj },
    });
    if (c === 0) continue;
    quizzes.push({
      key: `practice:${subj}`,
      title: `${subj} — Practice`,
      subject: subj,
      mode: "practice",
      available: true,
      questionCount: Math.min(c, 10),
    });
  }
  return quizzes;
}

export interface QuizQuestionView {
  id: string;
  questionText: string;
  options: string[];
  subject: string;
  topic: string;
}

export async function startQuizAction(quizKey: string): Promise<QuizQuestionView[] | { error: string }> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authorised." };
  if (!(await isAddonActive(user.schoolId, "Assessment"))) return { error: "Assessment addon not active." };

  const scope = await getStudentQuizScope(user);
  if (!scope) return { error: "Student not found." };

  const { level, term, subjects } = scope;

  let where: { status: string; classLevel: string; term: string; subject: string | { in: string[] } };
  if (quizKey === "daily") {
    where = { status: "live", classLevel: level, term, subject: { in: subjects } };
  } else if (quizKey.startsWith("practice:")) {
    const subj = quizKey.slice("practice:".length);
    where = { status: "live", classLevel: level, term, subject: subj };
  } else {
    return { error: "Unknown quiz." };
  }

  const questions = await prisma.quizQuestion.findMany({ where });
  if (questions.length === 0) return { error: "No questions available." };

  // Sample up to 10 (Fisher-Yates shuffle).
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  const sampled = questions.slice(0, 10);

  return sampled.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    subject: q.subject,
    topic: q.topic,
  }));
}

export async function submitQuizAction(
  formData: FormData,
): Promise<{ error?: string; success?: string; earnedPoints?: number; correctCount?: number; totalQuestions?: number }> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authorised." };
  if (!(await isAddonActive(user.schoolId, "Assessment"))) return { error: "Assessment addon not active." };

  const student = await prisma.student.findFirst({
    where: { userId: user.userId, schoolId: user.schoolId },
    select: { id: true, currentClassId: true, currentClass: { select: { level: true } } },
  });
  if (!student) return { error: "Student not found." };

  const mode = String(formData.get("mode") ?? "practice");
  const questionIds = formData.getAll("questionIds[]") as string[];
  const answers = JSON.parse(String(formData.get("answers") ?? "{}")) as Record<string, number>;

  if (questionIds.length === 0) return { error: "No questions submitted." };

  const questions = await prisma.quizQuestion.findMany({ where: { id: { in: questionIds }, status: "live" } });
  if (questions.length === 0) return { error: "No questions." };

  const termRec = await prisma.term.findFirst({
    where: { session: { schoolId: user.schoolId, isCurrent: true }, isCurrent: true },
    select: { name: true },
  });
  const term = (termRec?.name ?? "FIRST").toString().toUpperCase();

  let correctCount = 0;
  let earnedPoints = 0;
  const answerRows = questions.map((q) => {
    const sel = answers[q.id];
    const correct = sel === q.correctIndex;
    if (correct) {
      correctCount++;
      earnedPoints += q.points;
    }
    return {
      quizQuestionId: q.id,
      selectedIndex: sel ?? null,
      correct,
      pointsEarned: correct ? q.points : 0,
    };
  });

  const attempt = await prisma.quizAttempt.create({
    data: {
      studentId: student.id,
      schoolId: user.schoolId,
      classId: student.currentClassId!,
      classLevel: student.currentClass?.level ?? "",
      term,
      mode,
      totalQuestions: questions.length,
      correctCount,
      earnedPoints,
      accuracyPct: Math.round((correctCount / questions.length) * 100),
      countsForLeaderboard: mode === "daily",
      answers: { create: answerRows },
    },
  });

  return {
    success: "Quiz submitted.",
    earnedPoints,
    correctCount,
    totalQuestions: questions.length,
  };
}
