"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Perform bulk promotion.
 * sourceClassId -> destinationClassId (or null for withdrawal)
 * studentIds: which students to move
 * all others remain in source class (repeat)
 */
export async function promoteStudentsAction(
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const sourceClassId = String(formData.get("sourceClassId") ?? "");
  const destClassId = String(formData.get("destClassId") ?? "").trim() || null;
  const rawIds = String(formData.get("studentIds") ?? "");
  const studentIds = rawIds ? rawIds.split(",").filter(Boolean) : [];

  if (!sourceClassId || studentIds.length === 0) {
    return { error: "Select a source class and at least one student to promote." };
  }

  const sourceClass = await prisma.class.findFirst({
    where: { id: sourceClassId, schoolId: ctx.schoolId },
    include: { session: true },
  });
  if (!sourceClass) return { error: "Source class not found." };

  let destClass = null;
  if (destClassId) {
    destClass = await prisma.class.findFirst({
      where: { id: destClassId, schoolId: ctx.schoolId },
    });
    if (!destClass) return { error: "Destination class not found." };
  }

  // Find destination session — default to same session; if dest class is in a
  // different session, use that.
  const toSessionId = destClass?.sessionId ?? sourceClass.sessionId;
  const toSession = await prisma.session.findUnique({ where: { id: toSessionId } });
  if (!toSession) return { error: "Destination session not found." };

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Update student class assignment and optionally status
    for (const sid of studentIds) {
      if (destClassId) {
        // Promote to new class
        await tx.student.update({
          where: { id: sid },
          data: { currentClassId: destClassId },
        });
      } else {
        // Withdraw
        await tx.student.update({
          where: { id: sid },
          data: { currentClassId: null, status: "withdrawn" },
        });
      }
    }

    // Record promotion
    await tx.promotionRecord.create({
      data: {
        schoolId: ctx.schoolId,
        fromClassId: sourceClassId,
        toClassId: destClassId,
        sessionFromId: sourceClass.sessionId,
        sessionToId: toSession.id,
        studentIds,
        performedBy: ctx.user.userId ?? "",
        performedAt: now,
        notes: destClassId
          ? `Promoted to ${destClass?.name ?? ""}`
          : "Withdrawn",
      },
    });
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "promote",
    entityType: "promotion_record",
    afterValue: {
      fromClassId: sourceClassId,
      toClassId: destClassId,
      studentIds,
    } as never,
  });

  revalidatePath("/promotion");
  revalidatePath("/classes");
  return {
    success: `${studentIds.length} student(s) promoted${
      destClass ? ` to ${destClass.name}` : " (withdrawn)"
    }.`,
  };
}
