"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

// ─── Assessment Type CRUD ──────────────────────────────────────

export async function createAssessmentTypeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const name = (formData.get("name") as string)?.trim().toUpperCase();
  if (!name) return { error: "Assessment type name is required." };

  const existing = await prisma.assessmentType.findUnique({
    where: { schoolId_name: { schoolId: ctx.schoolId, name } },
  });
  if (existing) return { error: `Type "${name}" already exists.` };

  const maxOrder = await prisma.assessmentType.findFirst({
    where: { schoolId: ctx.schoolId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.assessmentType.create({
    data: { schoolId: ctx.schoolId, name, sortOrder: (maxOrder?.sortOrder ?? 0) + 1 },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "create", entityType: "assessment_type",
    afterValue: { name } as never,
  });

  revalidatePath("/assessment-weightings");
  return { success: `Assessment type "${name}" created.` };
}

export async function deleteAssessmentTypeAction(
  id: string,
): Promise<ActionState> {
  try { await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.assessmentType.delete({ where: { id } });
  revalidatePath("/assessment-weightings");
  return { success: "Assessment type deleted." };
}

export async function renameAssessmentTypeAction(
  id: string,
  name: string,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const newName = name.trim().toUpperCase();
  if (!newName) return { error: "Name is required." };

  await prisma.assessmentType.update({ where: { id, schoolId: ctx.schoolId }, data: { name: newName } });
  revalidatePath("/assessment-weightings");
  return { success: `Renamed to "${newName}".` };
}

// ─── Weightings ────────────────────────────────────────────────

export async function upsertWeightingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const subjectId = String(formData.get("subjectId") ?? "").trim() || null;
  const assessmentTypeId = String(formData.get("assessmentTypeId") ?? "").trim();
  const weightPercentage = Number(formData.get("weightPercentage") ?? 0);

  if (!assessmentTypeId || weightPercentage <= 0 || weightPercentage > 100) {
    return { error: "A valid assessment type and weight (1-100) are required." };
  }

  await prisma.assessmentWeighting.upsert({
    where: {
      schoolId_subjectId_assessmentTypeId: {
        schoolId: ctx.schoolId,
        subjectId: subjectId ?? "",
        assessmentTypeId,
      },
    },
    update: { weightPercentage },
    create: { schoolId: ctx.schoolId, subjectId, assessmentTypeId, weightPercentage },
  });

  const allForScope = await prisma.assessmentWeighting.findMany({
    where: { schoolId: ctx.schoolId, subjectId: subjectId ?? "" },
  });

  const total = allForScope.reduce((s, w) => s + w.weightPercentage, 0);
  if (total !== 100) {
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
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "upsert", entityType: "assessment_weighting",
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
