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
  const dayOfWeek = parseInt(formData.get("dayOfWeek") as string);
  const roomId = (formData.get("roomId") as string)?.trim() || null;

  const [classCount, periodCount, subjectCount, roomCount] = await Promise.all([
    prisma.class.count({ where: { id: classId, schoolId: ctx.schoolId } }),
    prisma.timetablePeriod.count({ where: { id: periodId, schoolId: ctx.schoolId } }),
    prisma.subject.count({ where: { id: subjectId, schoolId: ctx.schoolId } }),
    roomId ? prisma.room.count({ where: { id: roomId, schoolId: ctx.schoolId } }) : 0,
  ]);
  if (classCount !== 1 || periodCount !== 1 || subjectCount !== 1 || (roomId && roomCount !== 1)) {
    return { error: "One or more selected items do not belong to this school." };
  }

  // Auto-resolve teacher from the subject_teacher assignment for this class+subject.
  // Teacher is no longer user-editable in the grid — it's determined by the assignment.
  const assignment = await prisma.assignment.findFirst({
    where: { schoolId: ctx.schoolId, classId, subjectId, assignmentType: "subject_teacher" },
    select: { staffId: true },
  });
  const staffId = assignment?.staffId ?? (formData.get("staffId") as string) ?? "";
  if (staffId) {
    const staffCount = await prisma.staff.count({ where: { id: staffId, schoolId: ctx.schoolId } });
    if (staffCount !== 1) return { error: "No teacher assigned to this subject for this class. Go to Staff → Assignments to link one." };
  }

  if (!staffId) return { error: "No teacher assigned to this subject for this class. Go to Staff → Assignments to link one." };

  // With pairing allowed for SSS, delete existing entries in this slot before creating.
  // There can be up to 2 entries per slot (paired departmental subjects).
  const existing = await prisma.timetableEntry.findMany({
    where: { classId, periodId, dayOfWeek },
    select: { id: true },
  });
  for (const e of existing) {
    await prisma.timetableEntry.delete({ where: { id: e.id } });
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

  const entry = await prisma.timetableEntry.findFirst({
    where: { id: entryId, schoolId: ctx.schoolId },
    select: { classId: true, dayOfWeek: true, subject: { select: { name: true } } },
  });
  if (!entry) return { error: "Entry not found." };

  await prisma.timetableEntry.deleteMany({ where: { id: entryId, schoolId: ctx.schoolId } });

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
