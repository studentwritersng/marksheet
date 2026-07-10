"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

async function requireFeeManager() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const perms = await resolvePermissions(user);
  const authorized = perms.isSuperAdmin || perms.isSchoolAdmin || perms.isFeeStatusManager;
  if (!authorized || !user.schoolId) throw new Error("FORBIDDEN");
  return { user, schoolId: user.schoolId };
}

/**
 * Set individual student fee status for a term (PRD 12 §3.1).
 */
export async function updateFeeStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireFeeManager();
  } catch {
    return { error: "Not authorised." };
  }
  await guardActiveLicense(ctx.schoolId);

  const studentId = String(formData.get("studentId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!studentId || !termId || !status) {
    return { error: "Student, term, and status are required." };
  }

  const existing = await prisma.feeStatus.findUnique({
    where: { studentId_termId: { studentId, termId } },
  });

  const before = existing ? { status: existing.status, notes: existing.notes } : null;

  await prisma.feeStatus.upsert({
    where: { studentId_termId: { studentId, termId } },
    update: { status, notes, setBy: ctx.user.userId },
    create: { studentId, termId, status, notes, setBy: ctx.user.userId },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "fee_status",
    entityId: studentId,
    beforeValue: before as never,
    afterValue: { status, notes } as never,
  });

  revalidatePath("/fee-status");
  return { success: "Fee status updated." };
}

/**
 * Bulk update fee status for a list of students (PRD 12 §3.1).
 */
export async function bulkUpdateFeeStatusAction(
  studentIds: string[],
  termId: string,
  status: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireFeeManager();
  } catch {
    return { error: "Not authorised." };
  }
  await guardActiveLicense(ctx.schoolId);

  if (studentIds.length === 0 || !termId || !status) {
    return { error: "Selected students, term, and status are required." };
  }

  await prisma.$transaction(
    studentIds.map((sid) =>
      prisma.feeStatus.upsert({
        where: { studentId_termId: { studentId: sid, termId } },
        update: { status, setBy: ctx.user.userId },
        create: { studentId: sid, termId, status, setBy: ctx.user.userId },
      })
    )
  );

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "fee_status_bulk",
    afterValue: { studentIdsCount: studentIds.length, status, termId } as never,
  });

  revalidatePath("/fee-status");
  return { success: `Bulk updated fee status for ${studentIds.length} student(s).` };
}
