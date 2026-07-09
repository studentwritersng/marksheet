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

  const classIds = formData.getAll("classIds") as string[];
  const subjectIds = formData.getAll("subjectIds") as string[];
  const department = (formData.get("department") as string) ?? "general";

  if (classIds.length === 0 || subjectIds.length === 0) {
    return { error: "Select at least one class and one subject." };
  }
  if (!["general", "science", "art", "commercial"].includes(department)) {
    return { error: "Invalid department." };
  }

  let created = 0;
  let skipped = 0;

  for (const classId of classIds) {
    for (const subjectId of subjectIds) {
      const existing = await prisma.classSubject.findUnique({
        where: { classId_subjectId: { classId, subjectId } },
      });
      if (existing) { skipped++; continue; }

      await prisma.classSubject.create({
        data: { schoolId: ctx.schoolId, classId, subjectId, department },
      });
      created++;
    }
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId, action: "create",
    entityType: "class_subject",
    afterValue: { classCount: classIds.length, subjectCount: subjectIds.length, department } as never,
  });

  revalidatePath("/class-subjects");
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} link(s) created`);
  if (skipped > 0) parts.push(`${skipped} already existed`);
  return { success: parts.join(", ") + "." };
}
