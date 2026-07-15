"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { isAddonActive } from "@/lib/addons/check";

export interface ActionState { error?: string; success?: string }

async function guardAddon(schoolId: string) {
  try { await guardActiveLicense(schoolId); } catch (e: any) { throw new Error(e.message); }
  if (!(await isAddonActive(schoolId, "Period Tracker"))) throw new Error("Period Tracker addon not active.");
}

// ── Teacher marks a topic as taught ──────────────────────────────────────

export async function markTeacherTaughtAction(
  schoolId: string, classId: string, subjectId: string,
  curriculumTopicId: string, termId: string,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.staffId) return { error: "Not authorised." };
    const perms = await resolvePermissions(user);
    if (!perms.subjectTeacherSubjectIds.has(subjectId)) return { error: "Not assigned to this subject." };
    await guardAddon(schoolId);

    const existing = await prisma.taughtTopic.findFirst({
      where: { classId, subjectId, curriculumTopicId, teacherId: user.staffId },
    });

    if (existing) {
      await prisma.taughtTopic.update({ where: { id: existing.id }, data: { teacherMarked: true, teacherMarkedAt: new Date() } });
    } else {
      await prisma.taughtTopic.create({
        data: { schoolId, classId, subjectId, curriculumTopicId, termId, teacherId: user.staffId, teacherMarked: true, teacherMarkedAt: new Date() },
      });
    }

    await recordAudit({ schoolId, actorId: user.userId, action: "mark_taught", entityType: "taught_topic" });
    revalidatePath("/period-tracker");
    return { success: "Marked as taught." };
  } catch (e: any) { return { error: e.message }; }
}

// ── Captain marks or verifies a topic ────────────────────────────────────

export async function markCaptainTaughtAction(
  schoolId: string, classId: string, subjectId: string,
  curriculumTopicId: string, teacherId: string,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "student" || !user.userId) return { error: "Not authorised." };

    const student = await prisma.student.findFirst({
      where: { userId: user.userId, schoolId, currentClassId: classId, OR: [{ isClassCaptain: true }, { isViceClassCaptain: true }] },
    });
    if (!student) return { error: "Only class captains can verify." };
    await guardAddon(schoolId);

    const existing = await prisma.taughtTopic.findFirst({
      where: { classId, subjectId, curriculumTopicId, teacherId },
    });

    if (existing) {
      await prisma.taughtTopic.update({ where: { id: existing.id }, data: { captainMarked: true, captainMarkedAt: new Date(), studentId: student.id } });
    } else {
      await prisma.taughtTopic.create({
        data: { schoolId, classId, subjectId, curriculumTopicId, teacherId, studentId: student.id, captainMarked: true, captainMarkedAt: new Date() },
      });
    }

    revalidatePath("/period-tracker");
    return { success: "Verified." };
  } catch (e: any) { return { error: e.message }; }
}

// ── Teacher page data ────────────────────────────────────────────────────

export interface TeacherEntryVM {
  curriculumTopicId: string;
  week: number;
  weekSuffix: string;
  topic: string;
  teacherMarked: boolean;
  captainMarked: boolean;
}

export async function getTeacherPeriodData(
  schoolId: string, staffId: string, classId: string, subjectId: string, termId: string,
): Promise<{ entries: TeacherEntryVM[] }> {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { level: true } });
  const subj = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
  const term = await prisma.term.findUnique({ where: { id: termId }, select: { name: true } });
  if (!cls || !subj || !term) return { entries: [] };

  const curriculum = await prisma.curriculumTopic.findMany({
    where: { classLevel: cls.level, subject: subj.name, term: term.name },
    orderBy: [{ week: "asc" }, { weekSuffix: "asc" }],
  });

  const taughtRecords = await prisma.taughtTopic.findMany({
    where: { classId, subjectId, teacherId: staffId },
  });
  const taughtMap = new Map(taughtRecords.map((t) => [t.curriculumTopicId, t]));

  const entries: TeacherEntryVM[] = curriculum.map((c) => {
    const t = taughtMap.get(c.id);
    return {
      curriculumTopicId: c.id,
      week: c.week,
      weekSuffix: c.weekSuffix ?? "",
      topic: c.topic,
      teacherMarked: t?.teacherMarked ?? false,
      captainMarked: t?.captainMarked ?? false,
    };
  });

  return { entries };
}

// ── Captain page data ────────────────────────────────────────────────────

export interface CaptainEntryVM {
  curriculumTopicId: string;
  topic: string;
  week: number;
  weekSuffix: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  teacherMarked: boolean;
  captainMarked: boolean;
}

export async function getCaptainPeriodData(
  schoolId: string, studentId: string,
): Promise<{ entries: CaptainEntryVM[] }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { currentClassId: true },
  });
  if (!student?.currentClassId) return { entries: [] };

  const classId = student.currentClassId;
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { level: true } });
  if (!cls) return { entries: [] };

  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { name: true },
  });
  const termName = currentTerm?.name ?? "";

  const classSubjects = await prisma.classSubject.findMany({
    where: { classId },
    include: { subject: { select: { id: true, name: true } } },
  });

  const entries: CaptainEntryVM[] = [];
  for (const cs of classSubjects) {
    const curriculum = await prisma.curriculumTopic.findMany({
      where: { classLevel: cls.level, subject: cs.subject.name, term: termName },
      orderBy: [{ week: "asc" }, { weekSuffix: "asc" }],
    });
    for (const c of curriculum) {
      const taught = await prisma.taughtTopic.findFirst({
        where: { classId, subjectId: cs.subjectId, curriculumTopicId: c.id },
        include: { teacher: { select: { id: true, fullName: true } } },
      });
      entries.push({
        curriculumTopicId: c.id,
        topic: c.topic,
        week: c.week,
        weekSuffix: c.weekSuffix ?? "",
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        teacherId: taught?.teacherId ?? "",
        teacherName: taught?.teacher?.fullName ?? "—",
        teacherMarked: taught?.teacherMarked ?? false,
        captainMarked: taught?.captainMarked ?? false,
      });
    }
  }
  return { entries };
}

// ── Dashboard stats ──────────────────────────────────────────────────────

export interface SubjectCoverage {
  subjectId: string;
  subjectName: string;
  total: number;
  taught: number;
  percentage: number;
}

export async function getCoverageStats(
  schoolId: string, classId?: string,
): Promise<SubjectCoverage[]> {
  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { name: true, id: true },
  });
  if (!currentTerm) return [];

  const termName = currentTerm.name as string;

  const classFilter: any = { schoolId };
  if (classId) classFilter.id = classId;

  const classes = await prisma.class.findMany({ where: classFilter, select: { id: true, level: true } });

  const results: SubjectCoverage[] = [];
  for (const cls of classes) {
    const classSubjects = await prisma.classSubject.findMany({
      where: { classId: cls.id },
      include: { subject: { select: { id: true, name: true } } },
    });
    for (const cs of classSubjects) {
      const total = await prisma.curriculumTopic.count({
        where: { classLevel: cls.level, term: termName }, // subject filter not needed since we group by classSubject
      });
      if (total === 0) continue;

      const taught = await prisma.taughtTopic.count({
        where: { classId: cls.id, subjectId: cs.subjectId, teacherMarked: true, captainMarked: true },
      });

      results.push({
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        total,
        taught,
        percentage: total > 0 ? Math.round((taught / total) * 100) : 0,
      });
    }
  }
  return results;
}
