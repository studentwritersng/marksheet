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

  const studentFilter = {
    schoolId,
    ...(spec.classId ? { currentClassId: spec.classId } : {}),
  };

  const matched = await prisma.feeStatus.findMany({
    where: { termId: term.id, status: { in: statuses }, student: studentFilter },
    select: { studentId: true },
  });
  let studentIdList = matched.map((m) => m.studentId);

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
