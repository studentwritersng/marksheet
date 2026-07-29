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

  // Delete existing timetable entries first (they reference periods via FK)
  await prisma.timetableEntry.deleteMany({ where: { schoolId: ctx.schoolId } });
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

// ── Step 5: Rooms — manage room types, rooms, and class default rooms ──

export async function saveRoomsAction(
  _prev: WizardState,
  formData: FormData,
): Promise<WizardState> {
  const ctx = await requireSchoolAdmin();
  try { await guardTimetableAddon(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const roomsRaw = String(formData.get("rooms") ?? "[]");
  const roomTypesRaw = String(formData.get("roomTypes") ?? "[]");
  const classRoomsRaw = String(formData.get("classRooms") ?? "{}");

  let roomTypes: { name: string }[];
  let rooms: { name: string; roomTypeName: string }[];
  let classRooms: Record<string, string>; // classId → roomId

  try { roomTypes = JSON.parse(roomTypesRaw); } catch { return { error: "Invalid room types." }; }
  try { rooms = JSON.parse(roomsRaw); } catch { return { error: "Invalid rooms." }; }
  try { classRooms = JSON.parse(classRoomsRaw); } catch { return { error: "Invalid class rooms." }; }

  // Delete existing rooms and room types
  await prisma.timetableEntry.deleteMany({ where: { schoolId: ctx.schoolId, roomId: { not: null } } });
  const existingRooms = await prisma.room.findMany({ where: { schoolId: ctx.schoolId }, select: { id: true } });
  for (const r of existingRooms) {
    await prisma.room.delete({ where: { id: r.id } });
  }

  // Recreate room types — keyed by name for reference
  const roomTypeMap = new Map<string, string>(); // name → roomTypeId
  for (const rt of roomTypes) {
    const created = await prisma.roomType.create({
      data: { schoolId: ctx.schoolId, name: rt.name },
    });
    roomTypeMap.set(rt.name, created.id);
  }

  // Recreate rooms
  const roomMap = new Map<string, string>(); // "roomType|name" → roomId
  for (const r of rooms) {
    const roomTypeId = roomTypeMap.get(r.roomTypeName);
    if (!roomTypeId) continue;
    const created = await prisma.room.create({
      data: { schoolId: ctx.schoolId, name: r.name, roomTypeId },
    });
    roomMap.set(`${r.roomTypeName}|${r.name}`, created.id);
  }

  // classRooms maps classId → roomName (from the UI select).
  // Convert roomName → actual room ID using the roomMap built above.
  const roomNameToId = new Map<string, string>(); // roomName → roomId
  for (const [key, id] of roomMap.entries()) {
    const name = key.split("|")[1];
    roomNameToId.set(name, id);
  }

  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId, archived: false },
    select: { id: true },
  });
  for (const cls of classes) {
    const roomName = classRooms[cls.id] ?? null;
    const defaultRoomId = roomName ? (roomNameToId.get(roomName) ?? null) : null;
    await prisma.class.update({
      where: { id: cls.id },
      data: { defaultRoomId },
    });
  }

  const existing = await prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } });
  const stepData = (existing?.stepData as Record<string, unknown>) ?? {};
  stepData.rooms = rooms;
  stepData.roomTypes = roomTypes;
  stepData.classRooms = classRooms;

  await prisma.timetableWizard.upsert({
    where: { schoolId: ctx.schoolId },
    update: { currentStep: 6, stepData: stepData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 6, stepData: stepData as Prisma.InputJsonValue },
  });

  return { step: 6 };
}

// ── Step 6: Subject frequency per class ───────────────────────────────

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
    update: { currentStep: 7, stepData: stepData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 7, stepData: stepData as Prisma.InputJsonValue },
  });

  return { step: 7 };
}

// ── Step 7: Teacher load limits ───────────────────────────────────────

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
    update: { currentStep: 8, stepData: stepData as Prisma.InputJsonValue },
    create: { schoolId: ctx.schoolId, currentStep: 8, stepData: stepData as Prisma.InputJsonValue },
  });

  return { step: 8 };
}

// ── Step 8: Mark wizard complete + auto-generate timetable ───────────

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
  const [classes, periods, subjectReqs, assignments, staffAvail, rooms] = await Promise.all([
    prisma.class.findMany({ where: { schoolId, archived: false }, select: { id: true, level: true, name: true, department: true, defaultRoomId: true } }),
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
    prisma.room.findMany({
      where: { schoolId },
      select: { id: true, name: true, roomTypeId: true },
    }),
  ]);

  if (periods.length === 0) return { error: "No teaching periods defined." };
  if (classes.length === 0) return { error: "No classes found." };

  const days = [0, 1, 2, 3, 4]; // Mon-Fri

  // Build room-type map — special rooms (non-default) go here
  const roomTypeMap = new Map<string, string>(); // subjectId → roomTypeId
  const roomsByType = new Map<string, typeof rooms>(); // roomTypeId → rooms[]
  for (const r of rooms) {
    const arr = roomsByType.get(r.roomTypeId) ?? [];
    arr.push(r);
    roomsByType.set(r.roomTypeId, arr);
  }

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
  const slotEntries = new Map<string, { subjectId: string }[]>(); // "classId|day|periodId" -> entries
  const teacherOccupied = new Set<string>(); // "staffId|day|periodId" — teacher cannot be in two places at once
  const roomOccupied = new Map<string, Set<string>>(); // "day|periodId" -> Set(roomId)

  const entriesToCreate: { classId: string; periodId: string; subjectId: string; staffId: string; dayOfWeek: number; roomId: string | null }[] = [];

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

  // Helper: place a subject into a slot with a teacher, respecting all constraints
  function tryPlace(
    classId: string, day: number, periodId: string, subjectId: string,
    cls: { level: string; department: string; defaultRoomId: string | null },
  ): boolean {
    const slotKey = `${classId}|${day}|${periodId}`;

    // One subject per period (no pairing)
    const entriesInSlot = slotEntries.get(slotKey) ?? [];
    if (entriesInSlot.length > 0) return false;

    const scKey = `${subjectId}|${classId}`;
    if (subjectClassDayPlaced.get(scKey)?.has(day)) return false;

    const candidates = validAssignments.filter(
      (a) => a.subjectId === subjectId && a.classId === classId,
    );
    for (const candidate of shuffleArray(candidates)) {
      const teacherSlotKey = `${candidate.staffId}|${day}|${periodId}`;
      if (teacherOccupied.has(teacherSlotKey)) continue;

      const dayPlaced = staffDayPlaced.get(candidate.staffId)?.get(day) ?? 0;
      const weekPlaced = staffWeekPlaced.get(candidate.staffId) ?? 0;
      const avail = availMap.get(candidate.staffId)?.get(day);
      if (dayPlaced >= (avail?.maxPerDay ?? 8)) continue;
      if (weekPlaced >= (avail?.maxPerWeek ?? 40)) continue;

      let assignedRoomId: string | null = cls.defaultRoomId ?? null;
      const roomKey = `${day}|${periodId}`;
      if (assignedRoomId && roomOccupied.get(roomKey)?.has(assignedRoomId)) assignedRoomId = null;

      entriesToCreate.push({
        classId, periodId, subjectId,
        staffId: candidate.staffId, dayOfWeek: day, roomId: assignedRoomId,
      });

      if (!subjectClassDayPlaced.has(scKey)) subjectClassDayPlaced.set(scKey, new Set());
      subjectClassDayPlaced.get(scKey)!.add(day);
      const cur = subjectClassTotalPlaced.get(scKey) ?? 0;
      subjectClassTotalPlaced.set(scKey, cur + 1);
      if (!slotEntries.has(slotKey)) slotEntries.set(slotKey, []);
      slotEntries.get(slotKey)!.push({ subjectId });
      teacherOccupied.add(teacherSlotKey);
      if (assignedRoomId) {
        if (!roomOccupied.has(roomKey)) roomOccupied.set(roomKey, new Set());
        roomOccupied.get(roomKey)!.add(assignedRoomId);
      }
      if (!staffDayPlaced.has(candidate.staffId)) staffDayPlaced.set(candidate.staffId, new Map());
      staffDayPlaced.get(candidate.staffId)!.set(day, dayPlaced + 1);
      staffWeekPlaced.set(candidate.staffId, weekPlaced + 1);
      return true;
    }
    return false;
  }

  // ── One subject per slot for all classes ──
  for (const cls of classes) {
    const reqs = (classReqMap.get(cls.id) ?? []).sort(
      (a, b) => b.weeklyPeriodsRequired - a.weeklyPeriodsRequired,
    );
    if (reqs.length === 0) continue;

    const placements: { subjectId: string; day: number }[] = [];
    for (const req of reqs) {
      for (const day of distributePeriods(req.weeklyPeriodsRequired)) {
        placements.push({ subjectId: req.subjectId, day });
      }
    }
    for (const p of shuffleArray(placements)) {
      for (const period of shuffleArray(periods)) {
        if (tryPlace(cls.id, p.day, period.id, p.subjectId, cls)) break;
      }
    }

    // Backfill: any subject that didn't meet quota
    for (const req of reqs) {
      const scKey = `${req.subjectId}|${cls.id}`;
      let stillNeeded = req.weeklyPeriodsRequired - (subjectClassTotalPlaced.get(scKey) ?? 0);
      if (stillNeeded <= 0) continue;
      for (const day of shuffleArray(days)) {
        if (stillNeeded <= 0) break;
        for (const period of shuffleArray(periods)) {
          if (tryPlace(cls.id, day, period.id, req.subjectId, cls)) { stillNeeded--; break; }
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
  classes: { id: string; level: string; section: string; department: string; defaultRoomId: string | null }[];
  rooms: { id: string; name: string; roomType: string }[];
  classSubjects: { classId: string; subjectId: string; department: string | null; subject: { id: string; name: string } }[];
  staff: { id: string; fullName: string; partTime: boolean; workDays: number[]; dayStartTime: string | null; dayEndTime: string | null }[];
  missingTeachers: { classLevel: string; subjectName: string }[];
  currentSessionId: string | null;
}> {
  const ctx = await requireSchoolAdmin();
  await guardTimetableAddon(ctx.schoolId);

  const [wizard, classes, classSubjects, staff, currentSession, existingRooms] = await Promise.all([
    prisma.timetableWizard.findUnique({ where: { schoolId: ctx.schoolId } }),
    prisma.class.findMany({
      where: { schoolId: ctx.schoolId, archived: false },
      select: { id: true, level: true, section: true, department: true, defaultRoomId: true },
      orderBy: [{ level: "asc" }, { section: "asc" }],
    }),
    prisma.classSubject.findMany({
      where: { schoolId: ctx.schoolId },
      select: { classId: true, subjectId: true, department: true, subject: { select: { id: true, name: true } } },
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
    prisma.room.findMany({
      where: { schoolId: ctx.schoolId },
      include: { roomType: { select: { name: true } } },
      orderBy: { name: "asc" },
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
    rooms: existingRooms.map((r) => ({ id: r.id, name: r.name, roomType: r.roomType.name })),
    classSubjects: classSubjects.map((cs) => ({ classId: cs.classId, subjectId: cs.subjectId, department: cs.department ?? null, subject: cs.subject })),
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
