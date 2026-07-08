"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const level = String(formData.get("level") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim().toUpperCase();
  const department = String(formData.get("department") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!level || !sessionId) {
    return { error: "Level and session are required." };
  }

  if (!["JSS1","JSS2","JSS3","SSS1","SSS2","SSS3"].includes(level)) {
    return { error: "Invalid level." };
  }

  // Auto-generate name: level + section (no space), or just level if no section
  const name = section ? `${level}${section}` : level;

  // Verify session belongs to this school.
  const session = await prisma.session.findFirst({
    where: { id: sessionId, schoolId: ctx.schoolId },
  });
  if (!session) return { error: "Invalid session." };

  const existing = await prisma.class.findFirst({
    where: { sessionId, level, section },
  });
  if (existing) return { error: `"${name}" already exists in this session.` };

  await prisma.class.create({
    data: { schoolId: ctx.schoolId, sessionId, name, level, section, department },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "class",
    afterValue: { name, level, section, department, sessionId },
  });

  revalidatePath("/classes");
  return { success: `Class "${name}" created.` };
}

export async function archiveClassAction(
  classId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId: ctx.schoolId },
    include: { students: { where: { status: "active" }, take: 1 } },
  });
  if (!cls) return { error: "Class not found." };
  if (cls.students.length > 0) {
    return {
      error: `Cannot archive a class with active students. Promote or withdraw them first.`,
    };
  }

  await prisma.class.update({
    where: { id: classId },
    data: { archived: true },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "class",
    entityId: classId,
    afterValue: { archived: true },
  });

  revalidatePath("/classes");
  return { success: `"${cls.name}" archived.` };
}
