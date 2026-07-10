"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function saveAffectiveRatingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); }
  catch { return { error: "Not authorised." }; }

  const termId = formData.get("termId") as string;
  const raw = formData.get("ratings") as string;
  if (!termId || !raw) return { error: "Missing term or ratings." };

  const ratings: Record<string, Record<string, number>> = JSON.parse(raw);

  for (const [studentId, scores] of Object.entries(ratings)) {
    const existing = await prisma.termResult.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    if (existing) {
      const merged = { ...(existing.affectiveRatings as Record<string, number> ?? {}), ...scores };
      await prisma.termResult.update({
        where: { id: existing.id },
        data: { affectiveRatings: merged },
      });
    } else {
      await prisma.termResult.create({
        data: {
          studentId,
          termId,
          affectiveRatings: scores,
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
  try { ctx = await requireSchoolAdmin(); }
  catch { return { error: "Not authorised." }; }

  const termId = formData.get("termId") as string;
  const raw = formData.get("attendance") as string;
  if (!termId || !raw) return { error: "Missing term or attendance data." };

  const attendance: Record<string, Record<string, number | string>> = JSON.parse(raw);

  for (const [studentId, data] of Object.entries(attendance)) {
    const existing = await prisma.termResult.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });
    if (existing) {
      const merged = { ...(existing.attendanceSummary as Record<string, unknown> ?? {}), ...data };
      await prisma.termResult.update({
        where: { id: existing.id },
        data: { attendanceSummary: merged },
      });
    } else {
      await prisma.termResult.create({
        data: {
          studentId,
          termId,
          attendanceSummary: data,
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
  try { ctx = await requireSchoolAdmin(); }
  catch { return { error: "Not authorised." }; }

  const termId = formData.get("termId") as string;
  const raw = formData.get("remarks") as string;
  if (!termId || !raw) return { error: "Missing term or remarks." };

  const remarks: Record<string, { teacherComment?: string; principalComment?: string }> = JSON.parse(raw);

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
