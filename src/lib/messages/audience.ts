// src/lib/messages/audience.ts
import { prisma } from "@/lib/prisma";

export type AudienceType = "teachers" | "students" | "parents" | "parents_by_fee";
export type FeeStatusValue = "cleared" | "partial" | "not_cleared";

export interface AudienceSpec {
  audienceType: AudienceType;
  classId?: string;
  /** Only meaningful for parents_by_fee. */
  feeStatuses?: FeeStatusValue[];
}

export interface DirectoryQuery {
  type: "teacher" | "student" | "parent";
  classId?: string;
  query?: string;
}

export interface DirectoryEntry {
  id: string;
  label: string;
  sublabel?: string;
  type: "staff" | "student" | "parent";
}

export const BULK_SEND_CAP = 1000;

async function teacherIds(schoolId: string, excludeUserId?: string | null): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { schoolId, role: "staff", ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true },
  });
  return rows.map((r) => r.id).filter((id) => id !== excludeUserId);
}

async function studentIds(schoolId: string, spec: AudienceSpec, excludeUserId?: string | null): Promise<string[]> {
  const rows = await prisma.student.findMany({
    where: {
      schoolId,
      userId: { not: null },
      ...(spec.classId ? { currentClassId: spec.classId } : {}),
    },
    select: { userId: true },
  });
  return rows.map((r) => r.userId).filter((id): id is string => !!id && id !== excludeUserId);
}

async function guardianParentIds(schoolId: string, spec: AudienceSpec, excludeUserId?: string | null): Promise<string[]> {
  const rows = await prisma.guardian.findMany({
    where: {
      parentUserId: { not: null },
      student: { schoolId, ...(spec.classId ? { currentClassId: spec.classId } : {}) },
    },
    select: { parentUserId: true },
  });
  return [...new Set(rows.map((r) => r.parentUserId))].filter(
    (id): id is string => !!id && id !== excludeUserId,
  );
}

async function parentsByFeeIds(schoolId: string, spec: AudienceSpec, excludeUserId?: string | null): Promise<string[]> {
  const statuses = (spec.feeStatuses ?? []).filter((s) =>
    (["cleared", "partial", "not_cleared"] as const).includes(s as FeeStatusValue),
  );
  if (statuses.length === 0) return [];

  const term = await prisma.term.findFirst({
    where: { session: { schoolId }, isCurrent: true },
    select: { id: true },
  });
  if (!term) return [];

  // FeeStatus has no Student relation; scope students first, then match by studentId.
  const students = await prisma.student.findMany({
    where: { schoolId, ...(spec.classId ? { currentClassId: spec.classId } : {}) },
    select: { id: true },
  });
  if (students.length === 0) return [];
  const studentIds = students.map((s) => s.id);

  const matched = await prisma.feeStatus.findMany({
    where: { termId: term.id, status: { in: statuses }, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const studentIdList = matched.map((m) => m.studentId);

  if (studentIdList.length === 0) return [];

  const guardians = await prisma.guardian.findMany({
    where: { studentId: { in: studentIdList }, parentUserId: { not: null } },
    select: { parentUserId: true },
  });
  return [...new Set(guardians.map((g) => g.parentUserId))].filter(
    (id): id is string => !!id && id !== excludeUserId,
  );
}

/**
 * Resolve every recipient user id for an audience spec.
 * Returns [] when nothing matches (e.g. no current term set).
 */
export async function resolveAudienceUserIds(
  schoolId: string,
  spec: AudienceSpec,
  excludeUserId?: string | null,
): Promise<string[]> {
  switch (spec.audienceType) {
    case "teachers": return teacherIds(schoolId, excludeUserId);
    case "students": return studentIds(schoolId, spec, excludeUserId);
    case "parents": return guardianParentIds(schoolId, spec, excludeUserId);
    case "parents_by_fee": return parentsByFeeIds(schoolId, spec, excludeUserId);
  }
}

export async function countAudience(
  schoolId: string,
  spec: AudienceSpec,
  excludeUserId?: string | null,
): Promise<number> {
  return (await resolveAudienceUserIds(schoolId, spec, excludeUserId)).length;
}

export async function searchDirectory(schoolId: string, q: DirectoryQuery): Promise<DirectoryEntry[]> {
  const query = q.query?.trim() ?? "";

  if (q.type === "teacher") {
    const rows = await prisma.user.findMany({
      where: {
        schoolId,
        role: "staff",
        ...(query ? { OR: [{ email: { contains: query, mode: "insensitive" as const } }, { staff: { fullName: { contains: query, mode: "insensitive" as const } } }] } : {}),
      },
      select: { id: true, email: true, staff: { select: { fullName: true } } },
      orderBy: { email: "asc" },
      take: 25,
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.staff?.fullName || r.email,
      ...(r.staff?.fullName ? { sublabel: r.email } : {}),
      type: "staff" as const,
    }));
  }

  if (q.type === "student") {
    const rows = await prisma.student.findMany({
      where: {
        schoolId,
        userId: { not: null },
        ...(q.classId ? { currentClassId: q.classId } : {}),
        ...(query ? { OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
          { admissionNumber: { contains: query, mode: "insensitive" as const } },
        ] } : {}),
      },
      select: {
        userId: true, firstName: true, lastName: true, admissionNumber: true,
        currentClass: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 25,
    });
    return rows
      .filter((r): r is typeof r & { userId: string } => !!r.userId)
      .map((r) => ({
        id: r.userId,
        label: `${r.firstName} ${r.lastName}`,
        sublabel: [r.admissionNumber, r.currentClass?.name].filter(Boolean).join(" · "),
        type: "student" as const,
      }));
  }

  const rows = await prisma.guardian.findMany({
    where: {
      parentUserId: { not: null },
      student: {
        schoolId,
        ...(q.classId ? { currentClassId: q.classId } : {}),
        ...(query ? { OR: [
          { firstName: { contains: query, mode: "insensitive" as const } },
          { lastName: { contains: query, mode: "insensitive" as const } },
        ] } : {}),
      },
      ...(query ? { OR: [
        { fullName: { contains: query, mode: "insensitive" as const } },
      ] } : {}),
    },
    select: {
      parentUserId: true, relationship: true, fullName: true,
      student: { select: { firstName: true, lastName: true, currentClass: { select: { name: true } } } },
    },
    take: 25,
  });
  const seen = new Map<string, DirectoryEntry>();
  for (const r of rows) {
    if (!r.parentUserId || seen.has(r.parentUserId)) continue;
    const cls = r.student.currentClass?.name ?? "";
    seen.set(r.parentUserId, {
      id: r.parentUserId,
      label: r.fullName,
      sublabel: `${r.relationship} of ${r.student.firstName} ${cls}`.trim(),
      type: "parent",
    });
  }
  return [...seen.values()];
}
