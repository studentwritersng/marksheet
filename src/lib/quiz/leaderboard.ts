import { prisma } from "@/lib/prisma";

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  classId: string;
  className: string;
  points: number;
  accuracyPct: number;
  attempts: number;
}

export async function getLeaderboard(
  schoolId: string,
  opts: { classId?: string } = {},
): Promise<LeaderboardEntry[]> {
  const where: {
    schoolId: string;
    countsForLeaderboard: boolean;
    classId?: string;
  } = { schoolId, countsForLeaderboard: true };
  if (opts.classId) where.classId = opts.classId;

  const attempts = await prisma.quizAttempt.findMany({
    where,
    select: {
      studentId: true,
      classId: true,
      earnedPoints: true,
      correctCount: true,
      totalQuestions: true,
    },
  });

  if (attempts.length === 0) return [];

  const studentIds = Array.from(new Set(attempts.map((a) => a.studentId)));
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currentClass: { select: { id: true, name: true } },
    },
  });
  const studentMap = new Map(
    students.map((s) => [s.id, s]),
  );

  const classIds = Array.from(new Set(attempts.map((a) => a.classId)));
  const classes = await prisma.class.findMany({
    where: { id: { in: classIds } },
    select: { id: true, name: true },
  });
  const classMap = new Map(classes.map((c) => [c.id, c.name]));

  const byStudent = new Map<
    string,
    {
      points: number;
      correct: number;
      total: number;
      attempts: number;
      name: string;
      classId: string;
      className: string;
    }
  >();

  for (const a of attempts) {
    const id = a.studentId;
    const cur =
      byStudent.get(id) ??
      (() => {
        const s = studentMap.get(id);
        const name = s ? `${s.firstName} ${s.lastName}` : "Unknown";
        const className =
          s?.currentClass?.name ?? classMap.get(a.classId) ?? "";
        return {
          points: 0,
          correct: 0,
          total: 0,
          attempts: 0,
          name,
          classId: a.classId,
          className,
        };
      })();
    cur.points += a.earnedPoints;
    cur.correct += a.correctCount;
    cur.total += a.totalQuestions;
    cur.attempts += 1;
    byStudent.set(id, cur);
  }

  return Array.from(byStudent.entries())
    .map(([studentId, v]) => ({
      studentId,
      name: v.name,
      classId: v.classId,
      className: v.className,
      points: v.points,
      accuracyPct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      attempts: v.attempts,
    }))
    .sort((a, b) => b.points - a.points);
}
