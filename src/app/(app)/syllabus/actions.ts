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

export async function createSyllabusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "");
  const file = String(formData.get("file") ?? "").trim() || null;
  const topicsRaw = String(formData.get("topics") ?? "").trim();

  if (!subjectId || !classLevel || !sessionId) {
    return { error: "Subject, class level, and session are required." };
  }

  const topics = topicsRaw
    ? topicsRaw.split("\n").map((t) => t.trim()).filter(Boolean)
    : [];

  const existing = await prisma.syllabus.findUnique({
    where: { schoolId_subjectId_classLevel_sessionId: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId } },
  });

  if (existing) {
    await prisma.syllabus.update({
      where: { id: existing.id },
      data: { file, parsedTopics: topics.length > 0 ? topics : undefined },
    });
  } else {
    await prisma.syllabus.create({
      data: {
        schoolId: ctx.schoolId,
        subjectId,
        classLevel,
        sessionId,
        file,
        parsedTopics: topics.length > 0 ? topics : undefined,
      },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: existing ? "update" : "create",
    entityType: "syllabus",
    afterValue: { subjectId, classLevel, sessionId, topicCount: topics.length } as never,
  });

  revalidatePath("/syllabus");
  return { success: existing ? "Syllabus updated." : "Syllabus uploaded." };
}

export async function deleteSyllabusAction(syllabusId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const s = await prisma.syllabus.findFirst({ where: { id: syllabusId, schoolId: ctx.schoolId } });
  if (!s) return { error: "Not found." };

  await prisma.syllabus.delete({ where: { id: syllabusId } });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "delete", entityType: "syllabus",
    beforeValue: { subjectId: s.subjectId, classLevel: s.classLevel } as never,
  });

  revalidatePath("/syllabus");
  return { success: "Syllabus deleted." };
}
