import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";
import { runSolver } from "@/lib/timetable/solver";
import type { SolverInput } from "@/lib/timetable/solver";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, violations: ["Not authenticated."] }, { status: 401 });
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return NextResponse.json({ success: false, violations: ["Not authorised."] }, { status: 403 });
  }
  const schoolId = user.schoolId;

  const active = await isAddonActive(schoolId, "Timetable Generator");
  if (!active) {
    return NextResponse.json({ success: false, violations: ["Timetable Generator addon is not active for this school."] }, { status: 403 });
  }

  const session = await prisma.session.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!session) {
    return NextResponse.json({ success: false, violations: ["No current session found."] });
  }

  const term = await prisma.term.findFirst({
    where: { sessionId: session.id, isCurrent: true },
  });
  if (!term) {
    return NextResponse.json({ success: false, violations: ["No current term found."] });
  }

  const template = await prisma.timetableTemplate.findFirst({
    where: { schoolId },
    include: { schoolDays: true, periods: { orderBy: { periodNumber: "asc" } } },
  });
  if (!template) {
    return NextResponse.json({ success: false, violations: ["No timetable template configured. Go to the Template tab first."] });
  }

  const teachingDays = template.schoolDays.filter((d) => d.isTeachingDay).map((d) => d.dayIndex);
  const teachingPeriods = template.periods.filter((p) => p.periodType === "teaching");

  if (teachingDays.length === 0) {
    return NextResponse.json({ success: false, violations: ["No teaching days configured in the template."] });
  }
  if (teachingPeriods.length === 0) {
    return NextResponse.json({ success: false, violations: ["No teaching periods configured in the template."] });
  }

  const [classes, subjects, staff, requirements, staffAvail, rules] = await Promise.all([
    prisma.class.findMany({ where: { schoolId, archived: false }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { schoolId } }),
    prisma.subjectTimetableRequirement.findMany({ where: { schoolId } }),
    prisma.staffAvailability.findMany({ where: { schoolId } }),
    prisma.schoolTimetableRule.findMany({ where: { schoolId } }),
  ]);

  const input: SolverInput = {
    classes: classes.map((c) => ({ id: c.id, name: c.name, level: c.level })),
    subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
    staff: staff.map((s) => ({ id: s.id, fullName: s.fullName })),
    periods: teachingPeriods.map((p) => ({ id: p.id, periodNumber: p.periodNumber, periodType: p.periodType })),
    days: teachingDays,
    requirements: requirements.map((r) => ({
      subjectId: r.subjectId,
      classLevel: r.classLevel,
      weeklyPeriodsRequired: r.weeklyPeriodsRequired,
      doublePeriodAllowed: r.doublePeriodAllowed,
      preferredTimeOfDay: r.preferredTimeOfDay,
      isPractical: r.isPractical,
    })),
    staffAvailability: staffAvail.map((sa) => ({
      staffId: sa.staffId,
      day: sa.day,
      maxPeriodsPerDay: sa.maxPeriodsPerDay,
      maxPeriodsPerWeek: sa.maxPeriodsPerWeek,
    })),
    rules: rules.map((r) => ({
      ruleType: r.ruleType,
      parameters: r.parameters as Record<string, any>,
      isHard: r.isHard,
      weight: r.weight,
    })),
    lockedEntries: [],
  };

  const result = runSolver(input);

  if (result.entries.length > 0) {
    const timetable = await prisma.addonTimetable.create({
      data: {
        schoolId,
        sessionId: session.id,
        termId: term.id,
        templateId: template.id,
        status: result.success ? "draft" : "draft",
        generationScore: result.score,
        entries: {
          create: result.entries.map((e) => ({
            classId: e.classId,
            periodId: e.periodId,
            day: e.day,
            subjectId: e.subjectId,
            staffId: e.staffId,
          })),
        },
      },
      include: { entries: true },
    });

    await prisma.timetableGenerationRun.create({
      data: {
        timetableId: timetable.id,
        triggeredBy: user.userId,
        completedAt: new Date(),
        status: result.success ? "success" : "partial",
        finalScore: result.score,
        hardConstraintViolations: result.violations,
        iterationsRun: result.iterationsRun,
      },
    });

    return NextResponse.json({
      success: result.success,
      score: result.score,
      entries: timetable.entries,
      violations: result.violations,
      timetableId: timetable.id,
    });
  }

  return NextResponse.json({
    success: false,
    score: 0,
    entries: [],
    violations: result.violations.length > 0 ? result.violations : ["Solver could not generate any valid entries."],
  });
}
