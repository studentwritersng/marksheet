import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";
import { TimetableView } from "./timetable-view";
import { RegenerateButton } from "./regenerate-button";

export default async function TimetablePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const addonActive = await isAddonActive(user.schoolId, "Timetable Generator");

  if (!addonActive) {
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
        <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
          The Timetable Generator addon is not active for your school. Enable it on the{" "}
          <a href="/addons" className="underline font-semibold">Addons</a> page to access the setup wizard and automatic scheduler.
        </div>
      </div>
    );
  }

  const [classes, periods, subjects, staff, entries, wizard] = await Promise.all([
    prisma.class.findMany({ where: { schoolId: user.schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.timetablePeriod.findMany({ where: { schoolId: user.schoolId }, orderBy: { startTime: "asc" } }),
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { schoolId: user.schoolId } }),
    prisma.timetableEntry.findMany({
      where: { schoolId: user.schoolId },
      include: {
        period: { select: { name: true } },
        subject: { select: { name: true } },
        staff: { select: { id: true, fullName: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.timetableWizard.findUnique({ where: { schoolId: user.schoolId } }),
  ]);

  // Redirect to wizard if not completed
  if (!wizard?.completed) {
    redirect("/timetable/wizard");
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Timetable
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Manage periods and schedule subjects per class.
          </p>
        </div>
        <div className="flex gap-2">
          <RegenerateButton />
          <a href="/timetable/wizard?restart=1" className="border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-surface-container transition-colors text-sm">
            Re-run Setup
          </a>
        </div>
      </div>

      <TimetableView
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        periods={periods.map((p) => ({ id: p.id, name: p.name, startTime: p.startTime, endTime: p.endTime, periodType: p.periodType }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        staff={staff.map((s) => ({ id: s.id, name: s.fullName }))}
        entries={entries.map((e) => ({
          id: e.id,
          classId: e.classId,
          className: e.class.name,
          periodId: e.periodId,
          dayOfWeek: e.dayOfWeek,
          subjectName: e.subject.name,
          staffId: e.staff.id,
          staffName: e.staff.fullName,
        }))}
      />
    </div>
  );
}
