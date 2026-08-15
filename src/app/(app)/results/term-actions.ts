"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolStaff, canManageSchool } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import type { Prisma } from "@prisma/client";

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Ensures all given student ids belong to classes the caller may act within.
 * Admins always pass; other staff are limited to their assigned classes.
 */
async function assertStudentsInScope(
  schoolId: string,
  perms: Awaited<ReturnType<typeof requireSchoolStaff>>["perms"],
  studentIds: string[],
): Promise<boolean> {
  if (canManageSchool(perms)) return true;
  const ids = [...new Set(studentIds)];
  if (ids.length === 0) return true;
  const students = await prisma.student.findMany({
    where: { id: { in: ids }, schoolId },
    select: { currentClassId: true },
  });
  return students.every((s) => !!s.currentClassId && perms.visibleClassIds.has(s.currentClassId));
}

export async function saveAffectiveRatingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); }
  catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const termId = formData.get("termId") as string;
  const raw = formData.get("ratings") as string;
  if (!termId || !raw) return { error: "Missing term or ratings." };

  const ratings: Record<string, Record<string, number>> = JSON.parse(raw);

  if (!(await assertStudentsInScope(ctx.schoolId, ctx.perms, Object.keys(ratings)))) {
    return { error: "Not authorised for one or more students." };
  }

  for (const [studentId, scores] of Object.entries(ratings)) {
    const existing = await prisma.termResult.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    if (existing) {
      const merged = { ...((existing.affectiveRatings ?? {}) as Record<string, number>), ...scores };
      await prisma.termResult.update({
        where: { id: existing.id },
        data: { affectiveRatings: merged as Prisma.InputJsonValue },
      });
    } else {
      await prisma.termResult.create({
        data: {
          studentId,
          termId,
          affectiveRatings: scores as Prisma.InputJsonValue,
          status: "computed",
        },
      });
    }
  }

  revalidatePath("/results/psychomotor");
  return { success: "Affective ratings saved." };
}

export async function saveAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); }
  catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const termId = formData.get("termId") as string;
  const raw = formData.get("attendance") as string;
  if (!termId || !raw) return { error: "Missing term or attendance data." };

  const attendance: Record<string, Record<string, number | string>> = JSON.parse(raw);

  if (!(await assertStudentsInScope(ctx.schoolId, ctx.perms, Object.keys(attendance)))) {
    return { error: "Not authorised for one or more students." };
  }

  for (const [studentId, data] of Object.entries(attendance)) {
    const existing = await prisma.termResult.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    if (existing) {
      const merged = { ...((existing.attendanceSummary ?? {}) as Record<string, unknown>), ...data };
      await prisma.termResult.update({
        where: { id: existing.id },
        data: { attendanceSummary: merged as Prisma.InputJsonValue },
      });
    } else {
      await prisma.termResult.create({
        data: {
          studentId,
          termId,
          attendanceSummary: data as Prisma.InputJsonValue,
          status: "computed",
        },
      });
    }
  }

  revalidatePath("/results/attendance");
  return { success: "Attendance records saved." };
}

export async function saveRemarksAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolStaff(); }
  catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const termId = formData.get("termId") as string;
  const raw = formData.get("remarks") as string;
  if (!termId || !raw) return { error: "Missing term or remarks." };

  const remarks: Record<string, { teacherComment?: string; principalComment?: string }> = JSON.parse(raw);

  if (!(await assertStudentsInScope(ctx.schoolId, ctx.perms, Object.keys(remarks)))) {
    return { error: "Not authorised for one or more students." };
  }

  for (const [studentId, data] of Object.entries(remarks)) {
    const existing = await prisma.termResult.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    const updateData: Record<string, string> = {};
    if (data.teacherComment !== undefined) updateData.teacherComment = data.teacherComment;
    if (data.principalComment !== undefined) updateData.principalComment = data.principalComment;

    if (existing) {
      await prisma.termResult.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      await prisma.termResult.create({
        data: {
          studentId,
          termId,
          ...updateData,
          status: "computed",
        },
      });
    }
  }

  revalidatePath("/results/remarks");
  return { success: "Remarks saved." };
}
