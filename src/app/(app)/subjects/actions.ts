"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { getAllUniqueSubjects } from "@/lib/nerdc-subjects";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim() || null;

  if (!name) return { error: "Subject name is required." };

  const existing = await prisma.subject.findUnique({
    where: { schoolId_name: { schoolId: ctx.schoolId, name } },
  });
  if (existing) return { error: `Subject "${name}" already exists.` };

  await prisma.subject.create({
    data: { schoolId: ctx.schoolId, name, code },
  });

  revalidatePath("/subjects");
  return { success: `"${name}" created.` };
}

export async function getNerdcSubjectsAction(): Promise<string[]> {
  const dbRows = await prisma.curriculumTopic.findMany({
    where: { isSystem: true },
    select: { subject: true },
    distinct: ["subject"],
  });
  const dbSubjects = new Set(dbRows.map((r) => r.subject as string).filter(Boolean));
  const allSubjects = getAllUniqueSubjects();
  const merged = new Set([...allSubjects, ...dbSubjects]);
  return [...merged].sort((a, b) => a.localeCompare(b));
}

export async function bulkCreateSubjectsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const namesRaw = formData.get("subjectNames") as string;
  if (!namesRaw) return { error: "No subjects selected." };
  const names: string[] = JSON.parse(namesRaw);

  const existing = await prisma.subject.findMany({
    where: { schoolId: ctx.schoolId, name: { in: names } },
    select: { name: true },
  });
  const existingSet = new Set(existing.map((s) => s.name));
  const toCreate = names.filter((n) => !existingSet.has(n));

  if (toCreate.length === 0) return { error: "All selected subjects already exist." };

  await prisma.subject.createMany({
    data: toCreate.map((name) => ({ schoolId: ctx.schoolId, name })),
    skipDuplicates: true,
  });

  revalidatePath("/subjects");
  return { success: `${toCreate.length} subject(s) imported from NERDC.` };
}

export async function deleteSubjectAction(subjectId: string): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId: ctx.schoolId },
  });
  if (!subject) return { error: "Subject not found." };

  await prisma.subject.delete({ where: { id: subjectId } });

  revalidatePath("/subjects");
  return { success: `"${subject.name}" deleted.` };
}
