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

  // Determine which class IDs to create assignments for.
  // For subject_teacher with a general subject, or class_teacher, auto-expand
  // to all department variants of the same level.
  let targetClassIds: string[] = classId ? [classId] : [];

  if (classId) {
    const selectedClass = await prisma.class.findUnique({ where: { id: classId } });
    if (selectedClass) {
      let shouldExpand = false;

      if (assignmentType === "class_teacher") {
        // Class teacher: always expand to all department variants
        shouldExpand = true;
      } else if (subjectId && !selectedClass.department) {
        // Subject teacher: expand only if the subject is "general"
        const classSubject = await prisma.classSubject.findUnique({
          where: { classId_subjectId: { classId, subjectId } },
        });
        shouldExpand = classSubject?.department === "general";
      }

      if (shouldExpand) {
        const siblingClasses = await prisma.class.findMany({
          where: {
            schoolId: ctx.schoolId,
            sessionId: selectedClass.sessionId,
            level: selectedClass.level,
            id: { not: classId },
          },
        });

        if (subjectId) {
          // For subject assignments: only include siblings linked to this subject as "general"
          const siblingIds = siblingClasses.map((c) => c.id);
          const siblingLinks = await prisma.classSubject.findMany({
            where: { classId: { in: siblingIds }, subjectId, department: "general" },
          });
          const validSiblingIds = siblingLinks.map((l) => l.classId);
          targetClassIds = [classId, ...validSiblingIds];
        } else {
          // For class_teacher: include all sibling classes
          targetClassIds = [classId, ...siblingClasses.map((c) => c.id)];
        }
      }
    }
  }

  let created = 0;
  let skipped = 0;

  for (const cid of targetClassIds) {
    // Skip if assignment already exists for this class+subject
    const existing = await prisma.assignment.findFirst({
      where: {
        staffId,
        classId: cid,
        subjectId: subjectId ?? undefined,
        assignmentType,
      },
    });
    if (existing) { skipped++; continue; }

    await prisma.assignment.create({
      data: {
        schoolId: ctx.schoolId,
        staffId,
        assignmentType,
        subjectId,
        classId: cid,
        sessionId,
        termId,
      },
    });
    created++;
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "assignment",
    afterValue: { staffId, assignmentType, subjectId, classId, sessionId, expandedTo: targetClassIds } as never,
  });

  revalidatePath(`/staff/${staffId}`);

  if (created > 1) {
    return { success: `Assignment added for ${created} class(es).` + (skipped > 0 ? ` (${skipped} already existed)` : "") };
  }
  return { success: "Assignment added." + (skipped > 0 ? " (already existed)" : "") };
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
