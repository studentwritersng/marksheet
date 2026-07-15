"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { AssignmentType } from "@prisma/client";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const staffId = String(formData.get("staffId") ?? "");
  const assignmentType = String(formData.get("assignmentType") ?? "") as AssignmentType;
  const subjectId = String(formData.get("subjectId") ?? "").trim() || null;
  const classId = String(formData.get("classId") ?? "").trim() || null;
  const sessionId = String(formData.get("sessionId") ?? "").trim() || null;
  const termId = String(formData.get("termId") ?? "").trim() || null;

  // Verify staff belongs to this school
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: ctx.schoolId },
  });
  if (!staff) return { error: "Staff not found." };

  await prisma.assignment.create({
    data: {
      schoolId: ctx.schoolId,
      staffId,
      assignmentType,
      subjectId,
      classId,
      sessionId,
      termId,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "assignment",
    afterValue: { staffId, assignmentType, subjectId, classId, sessionId } as never,
  });

  revalidatePath(`/staff/${staffId}`);
  return { success: "Assignment added." };
}

export async function removeAssignmentAction(
  assignmentId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, schoolId: ctx.schoolId },
    include: { staff: { select: { id: true } } },
  });
  if (!assignment) return { error: "Assignment not found." };

  await prisma.assignment.delete({ where: { id: assignmentId } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "delete",
    entityType: "assignment",
    entityId: assignmentId,
  });

  revalidatePath(`/staff/${assignment.staff.id}`);
  return { success: "Assignment removed." };
}

export async function resetStaffPasswordAction(
  staffId: string,
  newPassword: string,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: ctx.schoolId },
    include: { user: { select: { id: true } } },
  });
  if (!staff) return { error: "Staff not found." };
  if (!staff.user) return { error: "Staff has no login account." };

  await prisma.user.update({
    where: { id: staff.user.id },
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
    entityId: staff.user.id,
    afterValue: { passwordReset: true } as never,
  });

  return { success: "Password reset. Staff must change password on next login." };
}

export async function toggleSuspendStaffAction(
  staffId: string,
  suspended: boolean,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: ctx.schoolId },
    include: { user: { select: { id: true, isActive: true } } },
  });
  if (!staff) return { error: "Staff not found." };

  await prisma.staff.update({
    where: { id: staffId },
    data: { accountStatus: suspended ? "suspended" : "active" },
  });

  if (staff.user) {
    await prisma.user.update({
      where: { id: staff.user.id },
      data: { isActive: !suspended },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: suspended ? "suspend" : "unsuspend",
    entityType: "staff",
    entityId: staffId,
  });

  revalidatePath(`/staff/${staffId}`);
  return { success: suspended ? "Staff suspended." : "Staff reactivated." };
}

export async function deleteStaffAction(staffId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: ctx.schoolId },
    include: { user: { select: { id: true } } },
  });
  if (!staff) return { error: "Staff not found." };

  if (staff.user) {
    await prisma.user.delete({ where: { id: staff.user.id } });
  }
  await prisma.staff.delete({ where: { id: staffId } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "delete",
    entityType: "staff",
    entityId: staffId,
  });

  revalidatePath("/staff");
  return { success: "Staff deleted." };
}
