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

  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const parentId = (formData.get("parentId") as string)?.trim() || null;

  if (!name) return { error: "Assessment type name is required." };
  if (!code) return { error: "Assessment type code is required." };

  if (parentId) {
    const parent = await prisma.assessmentType.findUnique({ where: { id: parentId, schoolId: ctx.schoolId } });
    if (!parent) return { error: "Parent assessment type not found." };
  }

  const existingName = await prisma.assessmentType.findUnique({
    where: { schoolId_name: { schoolId: ctx.schoolId, name } },
  });
  if (existingName) return { error: `Type "${name}" already exists.` };

  const existingCode = await prisma.assessmentType.findUnique({
    where: { schoolId_code: { schoolId: ctx.schoolId, code } },
  });
  if (existingCode) return { error: `Code "${code}" already in use.` };

  const maxOrder = await prisma.assessmentType.findFirst({
    where: { schoolId: ctx.schoolId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.assessmentType.create({
    data: { schoolId: ctx.schoolId, name, code, parentId, sortOrder: (maxOrder?.sortOrder ?? 0) + 1 },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "create", entityType: "assessment_type",
    afterValue: { name, code, parentId } as never,
  });

  revalidatePath("/assessment-weightings");
  return { success: `Assessment type "${name}" (${code}) created.` };
}

export async function updateAssessmentTypeAction(
  id: string,
  name: string,
  code: string,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const newName = name.trim();
  const newCode = code.trim().toUpperCase();
  if (!newName) return { error: "Name is required." };
  if (!newCode) return { error: "Code is required." };

  const existingName = await prisma.assessmentType.findFirst({
    where: { schoolId: ctx.schoolId, name: newName, id: { not: id } },
  });
  if (existingName) return { error: `Type "${newName}" already exists.` };

  const existingCode = await prisma.assessmentType.findFirst({
    where: { schoolId: ctx.schoolId, code: newCode, id: { not: id } },
  });
  if (existingCode) return { error: `Code "${newCode}" already in use.` };

  await prisma.assessmentType.update({
    where: { id, schoolId: ctx.schoolId },
    data: { name: newName, code: newCode },
  });

  revalidatePath("/assessment-weightings");
  return { success: `Updated to "${newName}" (${newCode}).` };
}

export async function deleteAssessmentTypeAction(
  id: string,
): Promise<ActionState> {
  try { await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.assessmentType.delete({ where: { id } });
  revalidatePath("/assessment-weightings");
  return { success: "Assessment type deleted." };
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

  const existing = await prisma.assessmentWeighting.findFirst({
    where: { schoolId: ctx.schoolId, subjectId, assessmentTypeId },
  });

  if (existing) {
    await prisma.assessmentWeighting.update({
      where: { id: existing.id },
      data: { weightPercentage },
    });
  } else {
    await prisma.assessmentWeighting.create({
      data: { schoolId: ctx.schoolId, subjectId, assessmentTypeId, weightPercentage },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "upsert", entityType: "assessment_weighting",
    afterValue: { subjectId, assessmentTypeId, weightPercentage } as never,
  });

  revalidatePath("/assessment-weightings");
  return { success: `Weight set: ${assessmentTypeId} = ${weightPercentage}%` };
}

export async function deleteWeightingAction(
  schoolId: string,
  subjectId: string | null,
  assessmentTypeId: string,
): Promise<ActionState> {
  await requireSchoolAdmin();

  const existing = await prisma.assessmentWeighting.findFirst({
    where: { schoolId, subjectId, assessmentTypeId },
  });
  if (!existing) return { error: "Weighting not found." };

  await prisma.assessmentWeighting.delete({ where: { id: existing.id } });

  revalidatePath("/assessment-weightings");
  return { success: "Weighting deleted." };
}
