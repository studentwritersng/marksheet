"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface ActionState { error?: string; success?: string }

export async function linkSubjectToClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const classId = formData.get("classId") as string;
  const subjectId = formData.get("subjectId") as string;
  const department = (formData.get("department") as string) ?? "general";

  if (!classId || !subjectId) return { error: "Class and subject are required." };
  if (!["general", "science", "art", "commercial"].includes(department)) {
    return { error: "Invalid department." };
  }

  const existing = await prisma.classSubject.findUnique({
    where: { classId_subjectId: { classId, subjectId } },
  });
  if (existing) return { error: "This subject is already linked to this class." };

  await prisma.classSubject.create({
    data: { schoolId: ctx.schoolId, classId, subjectId, department },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId, action: "create",
    entityType: "class_subject",
    afterValue: { classId, subjectId, department } as never,
  });

  revalidatePath("/class-subjects");
  return { success: "Subject linked to class." };
}

export async function unlinkSubjectAction(
  classId: string,
  subjectId: string,
): Promise<ActionState> {
  try { await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.classSubject.delete({
    where: { classId_subjectId: { classId, subjectId } },
  });

  revalidatePath("/class-subjects");
  return { success: "Subject unlinked." };
}
