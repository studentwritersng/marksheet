"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { validatePasswordStrength } from "@/lib/auth/password";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function resetStudentPasswordAction(
  studentId: string,
  newPassword: string,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { error: strengthError };

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    include: { user: { select: { id: true } } },
  });
  if (!student) return { error: "Student not found." };
  if (!student.user) return { error: "Student has no login account." };

  await prisma.user.update({
    where: { id: student.user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
      mustChangePassword: true,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "user",
    entityId: student.user.id,
    afterValue: { passwordReset: true } as never,
  });

  return { success: "Password reset. Student must change password on next login." };
}

export async function withdrawStudentAction(studentId: string): Promise<ActionState> {
let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    include: { user: { select: { id: true } } },
  });
  if (!student) return { error: "Student not found." };

  await prisma.student.update({
    where: { id: studentId },
    data: { status: "withdrawn" },
  });

  if (student.user) {
    await prisma.user.update({
      where: { id: student.user.id },
      data: { isActive: false },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "withdraw",
    entityType: "student",
    entityId: studentId,
  });

  revalidatePath(`/students/${studentId}`);
  return { success: "Student withdrawn." };
}

export async function reinstateStudentAction(studentId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    include: { user: { select: { id: true } } },
  });
  if (!student) return { error: "Student not found." };

  await prisma.student.update({
    where: { id: studentId },
    data: { status: "active" },
  });

  if (student.user) {
    await prisma.user.update({
      where: { id: student.user.id },
      data: { isActive: true },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "reinstate",
    entityType: "student",
    entityId: studentId,
  });

  revalidatePath(`/students/${studentId}`);
  return { success: "Student reinstated." };
}

export async function deleteStudentAction(studentId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
    include: { user: { select: { id: true } } },
  });
  if (!student) return { error: "Student not found." };

  // Remove dependent records. Several tables reference `students` via RESTRICT
  // foreign keys (e.g. consent_records, and term_results -> verification_codes),
  // so they must be deleted first or the student delete fails.
  const termResults = await prisma.termResult.findMany({
    where: { studentId },
    select: { id: true },
  });
  await prisma.verificationCode.deleteMany({
    where: { termResultId: { in: termResults.map((t) => t.id) } },
  });
  await prisma.consentRecord.deleteMany({ where: { studentId } });
  await prisma.examAttempt.deleteMany({ where: { studentId } }); // cascades to StudentAnswer
  await prisma.manualScore.deleteMany({ where: { studentId } });
  await prisma.subjectResult.deleteMany({ where: { studentId } });
  await prisma.termResult.deleteMany({ where: { studentId } });
  await prisma.feeStatus.deleteMany({ where: { studentId } });
  await prisma.attendanceRecord.deleteMany({ where: { studentId } });
  await prisma.examPin.deleteMany({ where: { studentId } });
  // TaughtTopic.studentId is only the student who marked it — clear it rather
  // than delete the topic record.
  await prisma.taughtTopic.updateMany({ where: { studentId }, data: { studentId: null } });
  await prisma.guardian.deleteMany({ where: { studentId } });
  await prisma.groupStudentTransferRecord.deleteMany({
    where: { OR: [{ originStudentId: studentId }, { destinationStudentId: studentId }] },
  });

  if (student.user) {
    await prisma.user.delete({ where: { id: student.user.id } });
  }
  await prisma.student.delete({ where: { id: studentId } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "delete",
    entityType: "student",
    entityId: studentId,
  });

  revalidatePath("/students");
  redirect("/students");
}
