"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function resetParentPasswordAction(
  guardianId: string,
  newPassword: string,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const guardian = await prisma.guardian.findFirst({
    where: { id: guardianId, student: { schoolId: ctx.schoolId } },
    include: { student: { select: { schoolId: true } } },
  });
  if (!guardian) return { error: "Parent not found." };
  if (!guardian.parentUserId) return { error: "Parent has no login account." };

  const user = await prisma.user.findFirst({
    where: { id: guardian.parentUserId, schoolId: ctx.schoolId },
  });
  if (!user) return { error: "Parent user account not found." };

  await prisma.user.update({
    where: { id: user.id },
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
    entityId: user.id,
    afterValue: { passwordReset: true } as never,
  });

  return { success: "Password reset. Parent must change password on next login." };
}

export async function toggleSuspendParentAction(
  guardianId: string,
  suspended: boolean,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const guardian = await prisma.guardian.findFirst({
    where: { id: guardianId, student: { schoolId: ctx.schoolId } },
  });
  if (!guardian) return { error: "Parent not found." };

  if (guardian.parentUserId) {
    await prisma.user.update({
      where: { id: guardian.parentUserId },
      data: { isActive: !suspended },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: suspended ? "suspend" : "unsuspend",
    entityType: "guardian",
    entityId: guardianId,
  });

  revalidatePath(`/parents/${guardianId}`);
  return { success: suspended ? "Parent suspended." : "Parent reactivated." };
}

export async function deleteParentAction(guardianId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const guardian = await prisma.guardian.findFirst({
    where: { id: guardianId, student: { schoolId: ctx.schoolId } },
  });
  if (!guardian) return { error: "Parent not found." };

  if (guardian.parentUserId) {
    await prisma.user.delete({ where: { id: guardian.parentUserId } });
  }
  await prisma.guardian.delete({ where: { id: guardianId } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "delete",
    entityType: "guardian",
    entityId: guardianId,
  });

  revalidatePath("/parents");
  return { success: "Parent deleted." };
}
