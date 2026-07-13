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

export async function getNerdcLevelsAction(): Promise<string[]> {
  const rows = await prisma.curriculumTopic.findMany({
    where: { isSystem: true },
    select: { classLevel: true },
    distinct: ["classLevel"],
    orderBy: { classLevel: "asc" },
  });
  return rows.map((r) => r.classLevel).filter(Boolean);
}

export async function bulkCreateClassesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const levelsRaw = formData.get("levels") as string;
  const sessionId = formData.get("sessionId") as string;
  if (!levelsRaw || !sessionId) return { error: "Missing levels or session." };
  const levels: string[] = JSON.parse(levelsRaw);

  // Verify session belongs to this school
  const session = await prisma.session.findFirst({
    where: { id: sessionId, schoolId: ctx.schoolId },
  });
  if (!session) return { error: "Invalid session." };

  let created = 0;
  for (const level of levels) {
    const name = level;
    const existing = await prisma.class.findFirst({
      where: { sessionId, level, section: "", department: "" },
    });
    if (existing) continue;
    await prisma.class.create({
      data: { schoolId: ctx.schoolId, sessionId, name, level, section: "", department: "" },
    });
    created++;
  }

  revalidatePath("/classes");
  return { success: `${created} class level(s) created from NERDC.` };
}

export async function createClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." }
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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

  // Auto-generate name
  let name: string;
  if (section && department) name = `${level}${section} ${department.charAt(0).toUpperCase() + department.slice(1)}`;
  else if (section) name = `${level}${section}`;
  else if (department) name = `${level} ${department.charAt(0).toUpperCase() + department.slice(1)}`;
  else name = level;

  // Verify session belongs to this school.
  const session = await prisma.session.findFirst({
    where: { id: sessionId, schoolId: ctx.schoolId },
  });
  if (!session) return { error: "Invalid session." };

  const existing = await prisma.class.findFirst({
    where: { sessionId, level, section, department },
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

export async function updateClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const classId = String(formData.get("classId") ?? "");
  const department = String(formData.get("department") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim().toUpperCase();

  if (!classId) return { error: "Missing class ID." };

  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId: ctx.schoolId },
  });
  if (!cls) return { error: "Class not found." };

  let name: string;
  if (section && department) name = `${cls.level}${section} ${department.charAt(0).toUpperCase() + department.slice(1)}`;
  else if (section) name = `${cls.level}${section}`;
  else if (department) name = `${cls.level} ${department.charAt(0).toUpperCase() + department.slice(1)}`;
  else name = cls.level;

  await prisma.class.update({
    where: { id: classId },
    data: { department, section, name },
  });

  revalidatePath("/classes");
  return { success: `"${name}" updated.` };
}

export async function archiveClassAction(
  classId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." }
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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
