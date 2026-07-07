"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface CurriculumState { error?: string; success?: string }

export async function upsertCurriculumTopicAction(
  _prev: CurriculumState,
  formData: FormData,
): Promise<CurriculumState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const classLevel = formData.get("classLevel") as string;
  const term = formData.get("term") as string;
  const subject = formData.get("subject") as string;
  const week = parseInt(formData.get("week") as string);
  const topic = (formData.get("topic") as string).trim();
  const subTopicsStr = (formData.get("subTopics") as string)?.trim() || "";

  if (!classLevel || !term || !subject || !week || !topic) {
    return { error: "Class level, term, subject, week, and topic are required." };
  }

  // Check if a system default exists for this key
  const existing = await prisma.curriculumTopic.findFirst({
    where: {
      classLevel, term, subject, week, schoolId: null,
    },
  });

  const subTopics = subTopicsStr ? subTopicsStr.split("\n").map((s) => s.trim()).filter(Boolean) : [];

  if (existing) {
    // Create a school override (keep system default untouched)
    await prisma.curriculumTopic.upsert({
      where: {
        classLevel_term_subject_week_schoolId: {
          classLevel, term, subject, week, schoolId: ctx.schoolId,
        },
      },
      update: { topic, subTopics, isSystem: false },
      create: {
        classLevel, term, subject, week,
        topic, subTopics, isSystem: false,
        schoolId: ctx.schoolId,
      },
    });
  } else {
    // No system default — just upsert for this school
    await prisma.curriculumTopic.upsert({
      where: {
        classLevel_term_subject_week_schoolId: {
          classLevel, term, subject, week, schoolId: ctx.schoolId,
        },
      },
      update: { topic, subTopics, isSystem: false },
      create: {
        classLevel, term, subject, week,
        topic, subTopics, isSystem: false,
        schoolId: ctx.schoolId,
      },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "upsert", entityType: "curriculum_topic",
    afterValue: { classLevel, term, subject, week, topic } as never,
  });

  revalidatePath("/curriculum");
  return { success: `Week ${week}: "${topic}" saved.` };
}

export async function deleteCurriculumOverrideAction(id: string): Promise<CurriculumState> {
  try { await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.curriculumTopic.delete({ where: { id } });
  revalidatePath("/curriculum");
  return { success: "Override removed." };
}
