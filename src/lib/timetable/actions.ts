"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { notifyStudents } from "@/lib/notifications/actions";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createPeriodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const classId = formData.get("classId") as string;
  const periodId = formData.get("periodId") as string;
  const subjectId = formData.get("subjectId") as string;
  const staffId = formData.get("staffId") as string;
  const dayOfWeek = parseInt(formData.get("dayOfWeek") as string);
  const roomId = (formData.get("roomId") as string)?.trim() || null;

  // With pairing allowed for SSS, there may be up to 2 entries per slot.
  // Delete existing entries for this slot and create the new one.
  // If the class is SSS and has departmental subjects, this creates a new entry alongside.
  const existing = await prisma.timetableEntry.findFirst({
    where: { classId, periodId, dayOfWeek },
    include: { subject: { select: { name: true } } },
  });

  if (existing) {
    await prisma.timetableEntry.delete({ where: { id: existing.id } });
  }

  await prisma.timetableEntry.create({
    data: { schoolId: ctx.schoolId, classId, periodId, subjectId, staffId, dayOfWeek, roomId },
  });

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const [cls, subject] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }),
  ]);
  await notifyStudents(
    classId,
    "timetable_updated",
    "Timetable Updated",
    `${subject?.name ?? "A subject"} has been scheduled for ${cls?.name ?? "your class"} on ${dayNames[dayOfWeek] ?? "an unknown day"}.`,
    ctx.schoolId
  );

  revalidatePath("/timetable");
  return { success: "Timetable entry saved." };
}

export async function deleteEntryAction(entryId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const entry = await prisma.timetableEntry.findUnique({
    where: { id: entryId },
    select: { classId: true, dayOfWeek: true, subject: { select: { name: true } } },
  });

  await prisma.timetableEntry.delete({ where: { id: entryId } });

  if (entry) {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const cls = await prisma.class.findUnique({ where: { id: entry.classId }, select: { name: true } });
    await notifyStudents(
      entry.classId,
      "timetable_updated",
      "Timetable Updated",
      `${entry.subject?.name ?? "A subject"} has been removed from your ${cls?.name ?? "class"} timetable on ${dayNames[entry.dayOfWeek] ?? "an unknown day"}.`,
      ctx.schoolId
    );
  }

  revalidatePath("/timetable");
  return { success: "Entry removed." };
}
