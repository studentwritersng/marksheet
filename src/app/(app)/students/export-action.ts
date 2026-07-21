"use server";

import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface DataExportState {
  error?: string;
  data?: string;
  filename?: string;
}

/**
 * Generate a full data export for a student.
 */
export async function exportStudentDataAction(
  studentId: string,
): Promise<DataExportState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
  });

  if (!student) return { error: "Student not found." };

  const [classInfo, guardians, consentRecs, termResults, subjectResults, feeStatuses, examAttempts] =
    await Promise.all([
      student.currentClassId
        ? prisma.class.findUnique({ where: { id: student.currentClassId }, select: { name: true, level: true } })
        : null,
      prisma.guardian.findMany({ where: { studentId }, select: { fullName: true, phone: true, email: true, relationship: true } }),
      prisma.consentRecord.findMany({ where: { studentId }, select: { consentType: true, consentedAt: true, consentMethod: true } }),
      prisma.termResult.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.subjectResult.findMany({
        where: { studentId },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.feeStatus.findMany({ where: { studentId } }),
      prisma.examAttempt.findMany({
        where: { studentId, status: "submitted" },
        orderBy: { startedAt: "desc" },
        take: 20,
      }),
    ]);

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "access",
    entityType: "student_data_export",
    entityId: student.id,
    afterValue: { reason: "NDPR data access request" } as never,
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: ctx.user.userId,
    student: {
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
      ethnicity: student.ethnicity,
      religion: student.religion,
      status: student.status,
      currentClass: classInfo?.name ?? null,
    },
    guardians: guardians.map((g) => ({
      fullName: g.fullName,
      phone: g.phone,
      email: g.email,
      relationship: g.relationship,
    })),
    consentRecords: consentRecs.map((c) => ({
      type: c.consentType,
      consentedAt: c.consentedAt.toISOString(),
      method: c.consentMethod,
    })),
    termResults: termResults.map((tr) => ({
      status: tr.status,
      overallAverage: tr.overallAverage,
      overallPosition: tr.overallPosition,
      cumulativeAverage: tr.cumulativeAverage,
    })),
    subjectResultCount: subjectResults.length,
    feeStatuses: feeStatuses.map((fs) => ({
      status: fs.status,
      notes: fs.notes,
    })),
    examAttemptCount: examAttempts.length,
  };

  return {
    data: JSON.stringify(exportData, null, 2),
    filename: `${student.admissionNumber}-data-export.json`,
  };
}
