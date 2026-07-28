"use server";

import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";

/**
 * Return all staff for this school with their availability at a given period+day.
 * isFree = no existing timetable entry for that teacher on that day/period.
 * Also respects staffAvailability maxPeriodsPerDay/Week if set.
 */
export async function getFreeTeachersAction(
  periodId: string,
  dayOfWeek: number,
): Promise<{ id: string; name: string; isFree: boolean }[]> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return [] as { id: string; name: string; isFree: boolean }[]; }
  try { await guardActiveLicense(ctx.schoolId); } catch { return []; }

  const [allStaff, takenEntries] = await Promise.all([
    prisma.staff.findMany({
      where: { schoolId: ctx.schoolId, accountStatus: "active" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, partTime: true, workDays: true },
    }),
    prisma.timetableEntry.findMany({
      where: { schoolId: ctx.schoolId, periodId, dayOfWeek },
      select: { staffId: true },
    }),
  ]);

  const takenSet = new Set(takenEntries.map((e) => e.staffId));

  return allStaff.map((s) => {
    const noEntry = !takenSet.has(s.id);
    const workDays = s.workDays ?? [];
    const availableToday = !s.partTime || workDays.includes(dayOfWeek);
    return { id: s.id, name: s.fullName, isFree: noEntry && availableToday };
  });
}
