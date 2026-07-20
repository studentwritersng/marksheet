"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { isAddonActive } from "@/lib/addons/check";
import { recordAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export interface WizardState {
  error?: string;
  success?: string;
  step?: number;
  stepData?: Record<string, unknown>;
  missingTeachers?: { classLevel: string; subjectName: string }[];
}

const TIMETABLE_ADDON = "Timetable Generator";

// Combined guard: active license + active Timetable Generator addon
async function guardTimetableAddon(schoolId: string): Promise<void> {
  await guardActiveLicense(schoolId);
  const active = await isAddonActive(schoolId, TIMETABLE_ADDON);
  if (!active) throw new Error("Timetable Generator addon is not active.");
}

// ── Get or create wizard state ─────────────────────────────────────────

export async function getOrCreateWizardAction(): Promise<{
  currentStep: number;
  stepData: Record<string, unknown>;
  completed: boolean;
}> {
  const ctx = await requireSchoolAdmin();
  await guardTimetableAddon(ctx.schoolId);
  let wizard = await prisma.timetableWizard.findUnique({
    where: { schoolId: ctx.schoolId },
  });
  if (!wizard) {
    wizard = await prisma.timetableWizard.create({
      data: { schoolId: ctx.schoolId },
    });
  }
  return {
    currentStep: wizard.currentStep,
    stepData: (wizard.stepData as Record<string, unknown>) ?? {},
    completed: wizard.completed,
  };
}

// ── Step 1: Intro → confirm → proceed to step 2 ───────────────────────

export async function startWizardAction(): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  await guardTimetableAddon(ctx.schoolId);
  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 2 },
    create: { schoolId: ctx.schoolId, currentStep: 2 },
  });
  return { step: 2 };
}

// ── Step 2: Validate classes & teacher assignments ────────────────────

export async function validateTeacherAssignmentsAction(): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId, archived: false },
    select: { id: true, level: true },
  });

  // Get all class-subject links
  const classSubjects = await prisma.classSubject.findMany({
    where: { schoolId: ctx.schoolId },
    include: { subject: { select: { name: true } } },
  });

  // Get all subject_teacher assignments for current session
  const currentSession = await prisma.session.findFirst({
    where: { schoolId: ctx.schoolId, isCurrent: true },
    select: { id: true },
  });

  const assignments = currentSession
    ? await prisma.assignment.findMany({
        where: {
          schoolId: ctx.schoolId,
          assignmentType: "subject_teacher",
          sessionId: currentSession.id,
        },
        select: { classId: true, subjectId: true },
      })
    : [];

  const assignedSet = new Set(assignments.map((a) => `${a.classId}:${a.subjectId}`));

  const missing: { classLevel: string; subjectName: string }[] = [];

  for (const cs of classSubjects) {
    if (!assignedSet.has(`${cs.classId}:${cs.subjectId}`)) {
      const cls = classes.find((c) => c.id === cs.classId);
      missing.push({
        classLevel: cls?.level ?? "unknown",
        subjectName: cs.subject.name,
      });
    }
  }

  if (missing.length > 0) {
    return { missingTeachers: missing, error: "Some subjects are not linked to a teacher." };
  }

  // Save step data (merge with existing to preserve previous entries)
  const existingWizard = await prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } });
  const existingData = (existingWizard?.stepData as Record<string, unknown>) ?? {};
  existingData.classes = classes.map((c) => c.id);
  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 3, stepData: existingData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 3, stepData: existingData as Prisma.InputJsonValue },
  });

  return { step: 3 };
}

// ── Step 3: Teacher availability ───────────────────────────────────────

export async function saveTeacherAvailabilityAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const teachersRaw = String(formData.get("teachers") ?? "[]");
  let teachers: {
    id: string;
    partTime: boolean;
    workDays: number[];
    dayStartTime: string;
    dayEndTime: string;
  }[];
  try { teachers = JSON.parse(teachersRaw); } catch { return { error: "Invalid data." }; }

  // Update Staff records
  for (const t of teachers) {
    await prisma.staff.update({
      where: { id: t.id },
      data: {
        partTime: t.partTime,
        workDays: t.workDays,
        dayStartTime: t.dayStartTime || null,
        dayEndTime: t.dayEndTime || null,
      },
    });
  }

  // Also populate StaffAvailability for the solver
  for (const t of teachers) {
    for (const day of t.workDays) {
      await prisma.staffAvailability.upsert({
        where: { staffId_day: { staffId: t.id, day } },
        update: { maxPeriodsPerDay: 8, maxPeriodsPerWeek: 40 },
        create: {
          schoolId: ctx.schoolId,
          staffId: t.id,
          day,
          availablePeriodIds: [],
          maxPeriodsPerDay: 8,
          maxPeriodsPerWeek: 40,
        },
      });
    }
  }

  const existing = await prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } });
  const stepData = (existing?.stepData as Record<string, unknown>) ?? {};
  stepData.teacherAvailability = teachers;

  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 4, stepData: stepData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 4, stepData: stepData as Prisma.InputJsonValue },
  });

  return { step: 4 };
}

// ── Step 4: Define periods ────────────────────────────────────────────

export async function savePeriodsAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const periodsRaw = String(formData.get("periods") ?? "[]");
  let periods: { name: string; startTime: string; endTime: string; periodType: string }[];
  try { periods = JSON.parse(periodsRaw); } catch { return { error: "Invalid periods data." }; }

  if (periods.length < 3) return { error: "At least 3 periods required." };

  // Replace all existing timetable periods for this school
  await prisma.timetablePeriod.deleteMany({ where: { schoolId: ctx.schoolId } });
  for (const p of periods) {
    await prisma.timetablePeriod.create({
      data: { schoolId: ctx.schoolId, name: p.name, startTime: p.startTime, endTime: p.endTime, periodType: p.periodType || "period" },
    });
  }

  const existing = await prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } });
  const stepData = (existing?.stepData as Record<string, unknown>) ?? {};
  stepData.periods = periods;

  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 5, stepData: stepData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 5, stepData: stepData as Prisma.InputJsonValue },
  });

  return { step: 5 };
}

// ── Step 5: Subject frequency per class ───────────────────────────────

export async function saveSubjectFrequencyAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const freqRaw = String(formData.get("frequency") ?? "[]");
  let frequency: { classId: string; subjectId: string; minPerWeek: number; maxPerWeek: number }[];
  try { frequency = JSON.parse(freqRaw); } catch { return { error: "Invalid frequency data." }; }

  // Replace all existing subject requirements for this school
  await prisma.subjectTimetableRequirement.deleteMany({
    where: { schoolId: ctx.schoolId },
  });

  for (const f of frequency) {
    if (f.maxPerWeek < 1) continue;
    await prisma.subjectTimetableRequirement.create({
      data: {
        schoolId: ctx.schoolId,
        subjectId: f.subjectId,
        classId: f.classId,
        weeklyPeriodsRequired: f.maxPerWeek,
      },
    });
  }

  const existing = await prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } });
  const stepData = (existing?.stepData as Record<string, unknown>) ?? {};
  stepData.subjectFrequency = frequency;

  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 6, stepData: stepData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 6, stepData: stepData as Prisma.InputJsonValue },
  });

  return { step: 6 };
}

// ── Step 6: Teacher load limits ───────────────────────────────────────

export async function saveTeacherLoadAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const globalMaxPerDay = parseInt(String(formData.get("globalMaxPerDay") ?? "8"), 10);
  const globalMaxPerWeek = parseInt(String(formData.get("globalMaxPerWeek") ?? "40"), 10);

  const overridesRaw = String(formData.get("overrides") ?? "[]");
  let overrides: { staffId: string; maxPerDay: number; maxPerWeek: number }[];
  try { overrides = JSON.parse(overridesRaw); } catch { return { error: "Invalid overrides." }; }

  // Update StaffAvailability max periods
  const staffList = await prisma.staff.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, workDays: true },
  });

  for (const s of staffList) {
    const ov = overrides.find((o) => o.staffId === s.id);
    const maxDay = ov?.maxPerDay ?? globalMaxPerDay;
    const maxWeek = ov?.maxPerWeek ?? globalMaxPerWeek;
    for (const day of s.workDays) {
      await prisma.staffAvailability.upsert({
        where: { staffId_day: { staffId: s.id, day } },
        update: { maxPeriodsPerDay: maxDay, maxPeriodsPerWeek: maxWeek },
        create: {
          schoolId: ctx.schoolId,
          staffId: s.id,
          day,
          availablePeriodIds: [],
          maxPeriodsPerDay: maxDay,
          maxPeriodsPerWeek: maxWeek,
        },
      });
    }
  }

  const existing = await prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } });
  const stepData = (existing?.stepData as Record<string, unknown>) ?? {};
  stepData.teacherLoad = { globalMaxPerDay, globalMaxPerWeek, overrides };

  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 7, stepData: stepData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 7, stepData: stepData as Prisma.InputJsonValue },
  });

  return { step: 7 };
}

// ── Step 7: Mark wizard complete + auto-generate timetable ───────────

export async function completeWizardAction(): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  // Auto-generate timetable entries from wizard data
  const genResult = await generateFromWizard(ctx.schoolId);
  if (genResult.error) return { error: genResult.error };

  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { completed: true },
    create: { schoolId: ctx.schoolId, completed: true },
  });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "create", entityType: "timetable_wizard",
    afterValue: { completed: true, entriesGenerated: genResult.count } as never,
  });

  revalidatePath("/timetable");
  return { success: `Timetable setup complete! ${genResult.count} entries generated.` };
}

async function generateFromWizard(schoolId: string): Promise<{ error?: string; count?: number }> {
  const [classes, periods, subjectReqs, assignments, staffAvail] = await Promise.all([
    prisma.class.findMany({ where: { schoolId, archived: false }, select: { id: true, level: true, name: true } }),
    prisma.timetablePeriod.findMany({
      where: { schoolId, periodType: "period" },
      orderBy: { startTime: "asc" },
      select: { id: true },
    }),
    prisma.subjectTimetableRequirement.findMany({
      where: { schoolId },
      select: { subjectId: true, classId: true, weeklyPeriodsRequired: true },
    }),
    prisma.assignment.findMany({
      where: { schoolId, assignmentType: "subject_teacher" },
      select: { staffId: true, subjectId: true, classId: true },
    }),
    prisma.staffAvailability.findMany({
      where: { schoolId },
      select: { staffId: true, day: true, maxPeriodsPerDay: true, maxPeriodsPerWeek: true },
    }),
  ]);

  if (periods.length === 0) return { error: "No teaching periods defined." };
  if (classes.length === 0) return { error: "No classes found." };

  const days = [0, 1, 2, 3, 4]; // Mon-Fri

  // Build teacher-subject-class map
  const validAssignments = assignments.filter((a) => a.subjectId && a.classId)
    .map((a) => ({ staffId: a.staffId!, subjectId: a.subjectId!, classId: a.classId! }));

  // Build requirement map per class
  const classReqMap = new Map<string, { subjectId: string; weeklyPeriodsRequired: number }[]>();
  for (const r of subjectReqs) {
    if (!r.classId) continue;
    const arr = classReqMap.get(r.classId) ?? [];
    arr.push({ subjectId: r.subjectId, weeklyPeriodsRequired: r.weeklyPeriodsRequired });
    classReqMap.set(r.classId, arr);
  }

  // Build availability map
  const availMap = new Map<string, Map<number, { maxPerDay: number; maxPerWeek: number }>>();
  for (const sa of staffAvail) {
    if (!availMap.has(sa.staffId)) availMap.set(sa.staffId, new Map());
    availMap.get(sa.staffId)!.set(sa.day, { maxPerDay: sa.maxPeriodsPerDay, maxPerWeek: sa.maxPeriodsPerWeek });
  }

  // Track assignments
  const subjectClassDayPlaced = new Map<string, Set<number>>(); // "subjectId|classId" -> days
  const subjectClassTotalPlaced = new Map<string, number>(); // "subjectId|classId" -> total count
  const staffDayPlaced = new Map<string, Map<number, number>>(); // staffId -> day -> count
  const staffWeekPlaced = new Map<string, number>(); // staffId -> total
  const occupied = new Set<string>(); // "classId|day|periodId"
  const teacherOccupied = new Set<string>(); // "staffId|day|periodId" — teacher cannot be in two places at once

  const entriesToCreate: { classId: string; periodId: string; subjectId: string; staffId: string; dayOfWeek: number }[] = [];

  function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Distribute N periods evenly across 5 days with a random offset per subject
  function distributePeriods(count: number): number[] {
    const result: number[] = [];
    const offset = Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      result.push((offset + Math.floor(i * 5 / count)) % 5);
    }
    return result;
  }

  // Sort subjects by frequency descending so high-frequency subjects get placed first
  for (const cls of classes) {
    const reqs = (classReqMap.get(cls.id) ?? []).sort(
      (a, b) => b.weeklyPeriodsRequired - a.weeklyPeriodsRequired,
    );
    if (reqs.length === 0) continue;

    // Build placements per subject — evenly distributed across days
    const placements: { subjectId: string; day: number }[] = [];
    for (const req of reqs) {
      const subjectDays = distributePeriods(req.weeklyPeriodsRequired);
      for (const day of subjectDays) {
        placements.push({ subjectId: req.subjectId, day });
      }
    }

    // Shuffle placements for randomness
    const shuffledPlacements = shuffleArray(placements);

    // First pass: place each subject on its assigned day
    for (const p of shuffledPlacements) {
      const day = p.day;
      const scKey = `${p.subjectId}|${cls.id}`;

      if (subjectClassDayPlaced.get(scKey)?.has(day)) continue;

      const totalPlaced = subjectClassTotalPlaced.get(scKey) ?? 0;
      const req = reqs.find((r) => r.subjectId === p.subjectId);
      if (!req || totalPlaced >= req.weeklyPeriodsRequired) continue;

      // Try each period on this day (shuffled so not always period 1)
      for (const period of shuffleArray(periods)) {
        const slotKey = `${cls.id}|${day}|${period.id}`;
        if (occupied.has(slotKey)) continue;

        const candidates = validAssignments.filter(
          (a) => a.subjectId === p.subjectId && a.classId === cls.id,
        );

        for (const candidate of shuffleArray(candidates)) {
          const teacherSlotKey = `${candidate.staffId}|${day}|${period.id}`;
          if (teacherOccupied.has(teacherSlotKey)) continue;

          const dayPlaced = staffDayPlaced.get(candidate.staffId)?.get(day) ?? 0;
          const weekPlaced = staffWeekPlaced.get(candidate.staffId) ?? 0;
          const avail = availMap.get(candidate.staffId)?.get(day);

          if (dayPlaced >= (avail?.maxPerDay ?? 8)) continue;
          if (weekPlaced >= (avail?.maxPerWeek ?? 40)) continue;

          entriesToCreate.push({
            classId: cls.id,
            periodId: period.id,
            subjectId: p.subjectId,
            staffId: candidate.staffId,
            dayOfWeek: day,
          });

          if (!subjectClassDayPlaced.has(scKey)) subjectClassDayPlaced.set(scKey, new Set());
          subjectClassDayPlaced.get(scKey)!.add(day);
          subjectClassTotalPlaced.set(scKey, totalPlaced + 1);
          occupied.add(slotKey);
          teacherOccupied.add(teacherSlotKey);

          if (!staffDayPlaced.has(candidate.staffId)) staffDayPlaced.set(candidate.staffId, new Map());
          staffDayPlaced.get(candidate.staffId)!.set(day, dayPlaced + 1);
          staffWeekPlaced.set(candidate.staffId, weekPlaced + 1);

          break;
        }
        if (occupied.has(slotKey)) break;
      }
    }

    // Second pass: fill remaining unmet placements on any free day
    for (const req of reqs) {
      const scKey = `${req.subjectId}|${cls.id}`;
      const totalPlaced = subjectClassTotalPlaced.get(scKey) ?? 0;
      let stillNeeded = req.weeklyPeriodsRequired - totalPlaced;
      if (stillNeeded <= 0) continue;

      for (const day of shuffleArray(days)) {
        if (stillNeeded <= 0) break;
        if (subjectClassDayPlaced.get(scKey)?.has(day)) continue;

        for (const period of shuffleArray(periods)) {
          const slotKey = `${cls.id}|${day}|${period.id}`;
          if (occupied.has(slotKey)) continue;

          const candidates = shuffleArray(
            validAssignments.filter((a) => a.subjectId === req.subjectId && a.classId === cls.id),
          );

          for (const candidate of candidates) {
            const teacherSlotKey = `${candidate.staffId}|${day}|${period.id}`;
            if (teacherOccupied.has(teacherSlotKey)) continue;

            const dayPlaced = staffDayPlaced.get(candidate.staffId)?.get(day) ?? 0;
            const weekPlaced = staffWeekPlaced.get(candidate.staffId) ?? 0;
            const avail = availMap.get(candidate.staffId)?.get(day);

            if (dayPlaced >= (avail?.maxPerDay ?? 8)) continue;
            if (weekPlaced >= (avail?.maxPerWeek ?? 40)) continue;

            entriesToCreate.push({
              classId: cls.id,
              periodId: period.id,
              subjectId: req.subjectId,
              staffId: candidate.staffId,
              dayOfWeek: day,
            });

            if (!subjectClassDayPlaced.has(scKey)) subjectClassDayPlaced.set(scKey, new Set());
            subjectClassDayPlaced.get(scKey)!.add(day);
            const currentPlaced = subjectClassTotalPlaced.get(scKey) ?? 0;
            subjectClassTotalPlaced.set(scKey, currentPlaced + 1);
            occupied.add(slotKey);
            teacherOccupied.add(teacherSlotKey);

            if (!staffDayPlaced.has(candidate.staffId)) staffDayPlaced.set(candidate.staffId, new Map());
            staffDayPlaced.get(candidate.staffId)!.set(day, dayPlaced + 1);
            staffWeekPlaced.set(candidate.staffId, weekPlaced + 1);
            stillNeeded--;
            break;
          }
          if (occupied.has(slotKey)) break;
        }
      }
    }
  }

  // Delete existing entries and create new ones
  await prisma.timetableEntry.deleteMany({ where: { schoolId } });

  if (entriesToCreate.length > 0) {
    await prisma.timetableEntry.createMany({ data: entriesToCreate.map((e) => ({ ...e, schoolId })) });
  }

  return { count: entriesToCreate.length };
}

// ── Reset wizard ──────────────────────────────────────────────────────

export async function resetWizardAction(): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  await guardTimetableAddon(ctx.schoolId);
  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 1, completed: false, stepData: {} },
    create: { schoolId: ctx.schoolId, currentStep: 1, stepData: {} },
  });
  revalidatePath("/timetable/wizard");
  return { step: 1 };
}

// ── Get initial wizard data for the client ────────────────────────────

export async function getWizardInitData(): Promise<{
  wizard: { currentStep: number; stepData: Record<string, unknown>; completed: boolean } | null;
  classes: { id: string; level: string; section: string; department: string }[];
  classSubjects: { classId: string; subjectId: string; subject: { id: string; name: string } }[];
  staff: { id: string; fullName: string; partTime: boolean; workDays: number[]; dayStartTime: string | null; dayEndTime: string | null }[];
  missingTeachers: { classLevel: string; subjectName: string }[];
  currentSessionId: string | null;
}> {
  const ctx = await requireSchoolAdmin();
  await guardTimetableAddon(ctx.schoolId);

  const [wizard, classes, classSubjects, staff, currentSession] = await Promise.all([
    prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } }),
    prisma.class.findMany({
      where: { schoolId: ctx.schoolId, archived: false },
      select: { id: true, level: true, section: true, department: true },
      orderBy: [{ level: "asc" }, { section: "asc" }],
    }),
    prisma.classSubject.findMany({
      where: { schoolId: ctx.schoolId },
      include: { subject: { select: { id: true, name: true } } },
    }),
    prisma.staff.findMany({
      where: { schoolId: ctx.schoolId, accountStatus: "active" },
      select: { id: true, fullName: true, partTime: true, workDays: true, dayStartTime: true, dayEndTime: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.session.findFirst({
      where: { schoolId: ctx.schoolId, isCurrent: true },
      select: { id: true },
    }),
  ]);

  // Check missing teacher assignments
  const assignments = currentSession
    ? await prisma.assignment.findMany({
        where: {
          schoolId: ctx.schoolId,
          assignmentType: "subject_teacher",
          sessionId: currentSession.id,
        },
        select: { classId: true, subjectId: true },
      })
    : [];

  const assignedSet = new Set(assignments.map((a) => `${a.classId}:${a.subjectId}`));
  const missing: { classLevel: string; subjectName: string }[] = [];
  for (const cs of classSubjects) {
    if (!assignedSet.has(`${cs.classId}:${cs.subjectId}`)) {
      const cls = classes.find((c) => c.id === cs.classId);
      missing.push({
        classLevel: cls?.level ?? "unknown",
        subjectName: cs.subject.name,
      });
    }
  }

  return {
    wizard: wizard ? { currentStep: wizard.currentStep, stepData: wizard.stepData as Record<string, unknown> ?? {}, completed: wizard.completed } : null,
    classes,
    classSubjects: classSubjects.map((cs) => ({ classId: cs.classId, subjectId: cs.subjectId, subject: cs.subject })),
    staff: staff.map((s) => ({ ...s, workDays: s.workDays ?? [], dayStartTime: s.dayStartTime, dayEndTime: s.dayEndTime })),
    missingTeachers: missing,
    currentSessionId: currentSession?.id ?? null,
  };
}

// ── Regenerate timetable (standalone, no wizard) ─────────────────────

export async function regenerateTimetableAction(): Promise<{ error?: string; success?: string }> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const result = await generateFromWizard(ctx.schoolId);
  if (result.error) return { error: result.error };

  revalidatePath("/timetable");
  return { success: `Timetable regenerated with ${result.count} entries.` };
}
