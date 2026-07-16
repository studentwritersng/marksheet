import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";
import { TimetableView } from "./timetable-view";
import { TimetableGeneratorClient } from "./generator-client";

export default async function TimetablePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const [classes, periods, subjects, staff, entries, addonActive] = await Promise.all([
    prisma.class.findMany({ where: { schoolId: user.schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.timetablePeriod.findMany({ where: { schoolId: user.schoolId }, orderBy: { startTime: "asc" } }),
    prisma.subject.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { schoolId: user.schoolId } }),
    prisma.timetableEntry.findMany({
      where: { schoolId: user.schoolId },
      include: { period: { select: { name: true } }, subject: { select: { name: true } }, staff: { select: { fullName: true } } },
    }),
    isAddonActive(user.schoolId, "Timetable Generator"),
  ]);

  let genData: any = null;
  if (addonActive) {
    const [templates, requirements, staffAvail, rules, roomTypes, rooms, timetables, allEntries, classSubjects] = await Promise.all([
      prisma.timetableTemplate.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
      prisma.subjectTimetableRequirement.findMany({ where: { schoolId: user.schoolId } }),
      prisma.staffAvailability.findMany({ where: { schoolId: user.schoolId } }),
      prisma.schoolTimetableRule.findMany({ where: { schoolId: user.schoolId } }),
      prisma.roomType.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
      prisma.room.findMany({ where: { schoolId: user.schoolId }, orderBy: { name: "asc" } }),
      prisma.addonTimetable.findMany({ where: { schoolId: user.schoolId }, orderBy: { generatedAt: "desc" } }),
      prisma.addonTimetableEntry.findMany({
        where: { timetable: { schoolId: user.schoolId } },
        include: { class: { select: { name: true } }, subject: { select: { name: true } }, staff: { select: { fullName: true } } },
      }),
      prisma.classSubject.findMany({ where: { schoolId: user.schoolId } }),
    ]);

    genData = {
      templates: templates.map((t) => ({ id: t.id, name: t.name, appliesTo: t.appliesTo })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
      staff: staff.map((s) => ({ id: s.id, fullName: s.fullName })),
      classes: classes.map((c) => ({ id: c.id, name: c.name, level: c.level })),
      requirements: requirements.map((r) => ({
        id: r.id, subjectId: r.subjectId, subjectName: subjects.find((s) => s.id === r.subjectId)?.name ?? "",
        classId: r.classId, className: classes.find((c) => c.id === r.classId)?.name ?? null,
        classLevel: r.classLevel, weeklyPeriodsRequired: r.weeklyPeriodsRequired,
        doublePeriodAllowed: r.doublePeriodAllowed, preferredTimeOfDay: r.preferredTimeOfDay, isPractical: r.isPractical,
      })),
      staffAvail: staffAvail.map((sa) => ({
        id: sa.id, staffId: sa.staffId, staffName: staff.find((s) => s.id === sa.staffId)?.fullName ?? "",
        day: sa.day, maxPeriodsPerDay: sa.maxPeriodsPerDay, maxPeriodsPerWeek: sa.maxPeriodsPerWeek,
      })),
      rules: rules.map((r) => ({
        id: r.id, ruleType: r.ruleType, parameters: r.parameters as Record<string, any>, isHard: r.isHard, weight: r.weight,
      })),
      roomTypes: roomTypes.map((rt) => ({ id: rt.id, name: rt.name })),
      rooms: rooms.map((r) => ({
        id: r.id, name: r.name, roomTypeId: r.roomTypeId, capacity: r.capacity,
      })),
      timetables: timetables.map((tt) => ({
        id: tt.id, status: tt.status, generatedAt: tt.generatedAt.toISOString(), generationScore: tt.generationScore,
      })),
      entries: allEntries.map((e) => ({
        id: e.id, timetableId: e.timetableId, classId: e.classId, className: e.class.name, day: e.day,
        periodId: e.periodId, subjectName: e.subject.name, staffName: e.staff?.fullName ?? null, isLocked: e.isLocked,
      })),
      classSubjects: classSubjects.map((cs) => ({ classId: cs.classId, subjectId: cs.subjectId })),
    };
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
        {addonActive && (
          <a href="#generator" className="bg-[#002046] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#003366]">
            Open Generator
          </a>
        )}
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

      {addonActive && genData && (
        <div id="generator" className="pt-8 border-t border-outline-variant">
          <TimetableGeneratorClient
            templates={genData.templates}
            subjects={genData.subjects}
            staff={genData.staff}
            classes={genData.classes}
            requirements={genData.requirements}
            staffAvail={genData.staffAvail}
            rules={genData.rules}
            roomTypes={genData.roomTypes}
            rooms={genData.rooms}
            timetables={genData.timetables}
            entries={genData.entries}
            classSubjects={genData.classSubjects}
          />
        </div>
      )}
    </div>
  );
}
