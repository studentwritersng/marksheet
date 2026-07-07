"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function upsertWeightingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const subjectId = String(formData.get("subjectId") ?? "").trim() || null;
  const assessmentTypeId = String(formData.get("assessmentTypeId") ?? "").trim();
  const weightPercentage = Number(formData.get("weightPercentage") ?? 0);

  if (!assessmentTypeId || weightPercentage <= 0 || weightPercentage > 100) {
    return { error: "A valid assessment type and weight (1-100) are required." };
  }

  // Upsert the new/updated weighting
  await prisma.assessmentWeighting.upsert({
    where: {
      schoolId_subjectId_assessmentTypeId: {
        schoolId: ctx.schoolId,
        subjectId: subjectId ?? "",
        assessmentTypeId,
      },
    },
    update: { weightPercentage },
    create: {
      schoolId: ctx.schoolId,
      subjectId,
      assessmentTypeId,
      weightPercentage,
    },
  });

  // Enforce: sum of active weights for this scope must be exactly 100
  const allForScope = await prisma.assessmentWeighting.findMany({
    where: {
      schoolId: ctx.schoolId,
      subjectId: subjectId ?? "",
    },
  });

  const total = allForScope.reduce((s, w) => s + w.weightPercentage, 0);
  if (total !== 100) {
    // Rollback by deleting the just-upserted row
    await prisma.assessmentWeighting.delete({
      where: {
        schoolId_subjectId_assessmentTypeId: {
          schoolId: ctx.schoolId,
          subjectId: subjectId ?? "",
          assessmentTypeId,
        },
      },
    });
    return {
      error: `Weights must sum to exactly 100%. Current total would be ${total}%. Delete or adjust existing weights first.`,
    };
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "upsert",
    entityType: "assessment_weighting",
    afterValue: { subjectId, assessmentTypeId, weightPercentage } as never,
  });

  revalidatePath("/assessment-weightings");
  return { success: `Weight set: ${assessmentTypeId} = ${weightPercentage}% (total: 100%)` };
}

export async function deleteWeightingAction(
  schoolId: string,
  subjectId: string | null,
  assessmentTypeId: string,
): Promise<ActionState> {
  await requireSchoolAdmin();

  await prisma.assessmentWeighting.delete({
    where: {
      schoolId_subjectId_assessmentTypeId: {
        schoolId,
        subjectId: subjectId ?? "",
        assessmentTypeId,
      },
    },
  });

  revalidatePath("/assessment-weightings");
  return { success: "Weighting deleted." };
}
