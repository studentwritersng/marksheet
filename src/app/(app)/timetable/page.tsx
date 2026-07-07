import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { TimetableView } from "./timetable-view";

export default async function TimetablePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [classes, periods, subjects, staff, entries] = await Promise.all([
    prisma.class.findMany({ where: { schoolId: user.schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.timetablePeriod.findMany({ where: { schoolId: user.schoolId }, orderBy: { startTime: "asc" } }),
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { schoolId: user.schoolId } }),
    prisma.timetableEntry.findMany({
      where: { schoolId: user.schoolId },
      include: { period: { select: { name: true } }, subject: { select: { name: true } }, staff: { select: { fullName: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Timetable
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Manage periods and schedule subjects per class.
        </p>
      </div>

      <TimetableView
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        periods={periods.map((p) => ({ id: p.id, name: p.name, startTime: p.startTime, endTime: p.endTime }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        staff={staff.map((s) => ({ id: s.id, name: s.fullName }))}
        entries={entries.map((e) => ({
          id: e.id,
          classId: e.classId,
          periodId: e.periodId,
          dayOfWeek: e.dayOfWeek,
          subjectName: e.subject.name,
          staffName: e.staff.fullName,
        }))}
      />
    </div>
  );
}
