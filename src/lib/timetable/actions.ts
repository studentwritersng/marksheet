"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createPeriodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const name = formData.get("name") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  if (!name || !startTime || !endTime) return { error: "Missing required fields." };

  await prisma.timetablePeriod.create({ data: { schoolId: ctx.schoolId, name, startTime, endTime } });
  revalidatePath("/timetable");
  return { success: `Period "${name}" created.` };
}

export async function setEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const classId = formData.get("classId") as string;
  const periodId = formData.get("periodId") as string;
  const subjectId = formData.get("subjectId") as string;
  const staffId = formData.get("staffId") as string;
  const dayOfWeek = parseInt(formData.get("dayOfWeek") as string);

  await prisma.timetableEntry.upsert({
    where: { classId_periodId_dayOfWeek: { classId, periodId, dayOfWeek } },
    update: { subjectId, staffId },
    create: { schoolId: ctx.schoolId, classId, periodId, subjectId, staffId, dayOfWeek },
  });

  revalidatePath("/timetable");
  return { success: "Timetable entry saved." };
}

export async function deleteEntryAction(entryId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  await prisma.timetableEntry.delete({ where: { id: entryId } });
  revalidatePath("/timetable");
  return { success: "Entry removed." };
}
