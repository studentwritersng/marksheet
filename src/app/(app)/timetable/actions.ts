"use server";

import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";

/**
 * Return subject-assigned teachers for a specific class+subject on a given period+day.
 * Only returns teachers who have a subject_teacher assignment for this class+subject.
 * isFree = no existing timetable entry for that teacher on that day/period anywhere in the school.
 */
export async function getFreeTeachersAction(
  periodId: string,
  dayOfWeek: number,
  classId: string,
  subjectId: string,
): Promise<{ id: string; name: string; isFree: boolean }[]> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return [] as { id: string; name: string; isFree: boolean }[]; }
  try { await guardActiveLicense(ctx.schoolId); } catch { return []; }

  // Only teachers assigned to this class+subject
  const [assignments, takenEntries] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        schoolId: ctx.schoolId,
        classId,
        subjectId,
        assignmentType: "subject_teacher",
      },
      select: { staffId: true, staff: { select: { id: true, fullName: true, partTime: true, workDays: true } } },
    }),
    prisma.timetableEntry.findMany({
      where: { schoolId: ctx.schoolId, periodId, dayOfWeek },
      select: { staffId: true },
    }),
  ]);

  const takenSet = new Set(takenEntries.map((e) => e.staffId));
  const seen = new Set<string>();

  return assignments
    .filter((a) => a.staff)
    .map((a) => {
      const staff = a.staff!;
      if (seen.has(staff.id)) return null;
      seen.add(staff.id);
      const noEntry = !takenSet.has(staff.id);
      const workDays = staff.workDays ?? [];
      const availableToday = !staff.partTime || workDays.includes(dayOfWeek);
      return { id: staff.id, name: staff.fullName, isFree: noEntry && availableToday };
    })
    .filter(Boolean) as { id: string; name: string; isFree: boolean }[];
}
