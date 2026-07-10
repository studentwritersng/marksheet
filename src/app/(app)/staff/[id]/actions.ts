"use server";

import { revalidatePath } from "next/cache";
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
