"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";

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
