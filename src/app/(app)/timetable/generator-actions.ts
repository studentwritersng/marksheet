"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { isAddonActive } from "@/lib/addons/check";

export interface ActionResult { error?: string; success?: string; }

async function guardGenerator(schoolId: string) {
  const active = await isAddonActive(schoolId, "Timetable Generator");
  if (!active) throw new Error("Timetable Generator addon is not active for this school.");
}

// ─── Templates ───

export async function createTemplateAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const name = (formData.get("name") as string)?.trim();
  const appliesToRaw = formData.get("appliesTo") as string;
  if (!name) return { error: "Template name is required." };
  const appliesTo = appliesToRaw ? appliesToRaw.split(",").map((s) => s.trim()).filter(Boolean) : ["all"];
  try {
    await prisma.timetableTemplate.create({
      data: { schoolId: ctx.schoolId, name, appliesTo },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "A template with this name already exists." };
    return { error: "Failed to create template." };
  }
  revalidatePath("/timetable");
  return { success: `Template "${name}" created.` };
}

export async function deleteTemplateAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const templateId = formData.get("templateId") as string;
  if (!templateId) return { error: "Template ID is required." };
  await prisma.timetableTemplate.delete({ where: { id: templateId } });
  revalidatePath("/timetable");
  return { success: "Template deleted." };
}

// ─── School Days ───

export async function upsertDayAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const templateId = formData.get("templateId") as string;
  const dayIndex = parseInt(formData.get("dayIndex") as string);
  const dayName = formData.get("dayName") as string;
  const isTeachingDay = formData.get("isTeachingDay") === "true";
  if (!templateId || isNaN(dayIndex) || !dayName) return { error: "Missing required fields." };
  const existingDay = await prisma.schoolDay.findFirst({
    where: { templateId, dayIndex },
  });
  if (existingDay) {
    await prisma.schoolDay.update({ where: { id: existingDay.id }, data: { dayName, isTeachingDay } });
  } else {
    await prisma.schoolDay.create({ data: { templateId, dayName, dayIndex, isTeachingDay } });
  }
  revalidatePath("/timetable");
  return { success: "Day saved." };
}

// ─── Periods ───

export async function upsertPeriodAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const templateId = formData.get("templateId") as string;
  const periodNumber = parseInt(formData.get("periodNumber") as string);
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const periodType = formData.get("periodType") as string || "teaching";
  if (!templateId || isNaN(periodNumber) || !startTime || !endTime) return { error: "Missing required fields." };
  const existing = await prisma.addonPeriod.findFirst({ where: { templateId, periodNumber } });
  if (existing) {
    await prisma.addonPeriod.update({ where: { id: existing.id }, data: { startTime, endTime, periodType } });
  } else {
    await prisma.addonPeriod.create({ data: { templateId, periodNumber, startTime, endTime, periodType } });
  }
  revalidatePath("/timetable");
  return { success: "Period saved." };
}

export async function deletePeriodAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const periodId = formData.get("periodId") as string;
  if (!periodId) return { error: "Period ID is required." };
  await prisma.addonPeriod.delete({ where: { id: periodId } });
  revalidatePath("/timetable");
  return { success: "Period deleted." };
}

// ─── Subject Timetable Requirements ───

export async function upsertSubjectRequirementAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const subjectId = formData.get("subjectId") as string;
  const classId = (formData.get("classId") as string)?.trim() || null;
  const classLevel = (formData.get("classLevel") as string)?.trim() || null;
  const weeklyPeriodsRequired = parseInt(formData.get("weeklyPeriodsRequired") as string);
  const doublePeriodAllowed = formData.get("doublePeriodAllowed") === "true";
  const preferredTimeOfDay = (formData.get("preferredTimeOfDay") as string) || "none";
  const isPractical = formData.get("isPractical") === "true";
  if (!subjectId || isNaN(weeklyPeriodsRequired)) return { error: "Missing required fields." };
  const existing = await prisma.subjectTimetableRequirement.findFirst({
    where: { schoolId: ctx.schoolId, subjectId, classId },
  });
  const data = { schoolId: ctx.schoolId, subjectId, classId, classLevel, weeklyPeriodsRequired, doublePeriodAllowed, preferredTimeOfDay, isPractical };
  if (existing) {
    await prisma.subjectTimetableRequirement.update({ where: { id: existing.id }, data });
  } else {
    await prisma.subjectTimetableRequirement.create({ data });
  }
  revalidatePath("/timetable");
  return { success: "Requirement saved." };
}

export async function deleteSubjectRequirementAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const reqId = formData.get("reqId") as string;
  if (!reqId) return { error: "Requirement ID is required." };
  await prisma.subjectTimetableRequirement.delete({ where: { id: reqId } });
  revalidatePath("/timetable");
  return { success: "Requirement deleted." };
}

// ─── Staff Availability ───

export async function upsertStaffAvailabilityAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const staffId = formData.get("staffId") as string;
  const daysRaw = formData.get("days") as string;
  const maxPeriodsPerDay = parseInt(formData.get("maxPeriodsPerDay") as string) || 8;
  const maxPeriodsPerWeek = parseInt(formData.get("maxPeriodsPerWeek") as string) || 40;
  if (!staffId || !daysRaw) return { error: "Missing required fields." };
  let days: number[];
  try { days = JSON.parse(daysRaw); } catch { return { error: "Invalid days value." }; }
  if (!Array.isArray(days) || days.length === 0) return { error: "Select at least one day." };
  for (const day of days) {
    const existing = await prisma.staffAvailability.findUnique({
      where: { staffId_day: { staffId, day } },
    });
    const data = { schoolId: ctx.schoolId, staffId, day, maxPeriodsPerDay, maxPeriodsPerWeek };
    if (existing) {
      await prisma.staffAvailability.update({ where: { id: existing.id }, data });
    } else {
      await prisma.staffAvailability.create({ data });
    }
  }
  revalidatePath("/timetable");
  return { success: `Availability saved for ${days.length} day(s).` };
}

// ─── Rules ───

export async function upsertRuleAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const ruleType = formData.get("ruleType") as string;
  const parametersRaw = formData.get("parameters") as string;
  const isHard = formData.get("isHard") === "true";
  const weight = parseInt(formData.get("weight") as string) || 100;
  if (!ruleType) return { error: "Rule type is required." };
  let parameters: Record<string, any> = {};
  try { if (parametersRaw) parameters = JSON.parse(parametersRaw); } catch { return { error: "Invalid JSON in parameters." }; }
  await prisma.schoolTimetableRule.create({ data: { schoolId: ctx.schoolId, ruleType, parameters, isHard, weight } });
  revalidatePath("/timetable");
  return { success: "Rule created." };
}

export async function deleteRuleAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const ruleId = formData.get("ruleId") as string;
  if (!ruleId) return { error: "Rule ID is required." };
  await prisma.schoolTimetableRule.delete({ where: { id: ruleId } });
  revalidatePath("/timetable");
  return { success: "Rule deleted." };
}

// ─── Rooms ───

export async function createRoomTypeAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Room type name is required." };
  const existing = await prisma.roomType.findFirst({ where: { schoolId: ctx.schoolId, name } });
  if (!existing) {
    await prisma.roomType.create({ data: { schoolId: ctx.schoolId, name } });
  }
  revalidatePath("/timetable");
  return { success: "Room type created." };
}

export async function createRoomAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const name = (formData.get("name") as string)?.trim();
  const roomTypeId = formData.get("roomTypeId") as string;
  const capacity = parseInt(formData.get("capacity") as string) || 40;
  if (!name || !roomTypeId) return { error: "Missing required fields." };
  await prisma.room.create({ data: { schoolId: ctx.schoolId, name, roomTypeId, capacity } });
  revalidatePath("/timetable");
  return { success: "Room created." };
}

export async function deleteRoomAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }
  const roomId = formData.get("roomId") as string;
  if (!roomId) return { error: "Room ID is required." };
  await prisma.room.delete({ where: { id: roomId } });
  revalidatePath("/timetable");
  return { success: "Room deleted." };
}

// ─── Publish ───

export async function publishTimetableAction(timetableId: string): Promise<ActionResult> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardGenerator(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const timetable = await prisma.addonTimetable.findUnique({
    where: { id: timetableId },
    include: {
      entries: { include: { subject: { select: { id: true } }, staff: { select: { id: true } } } },
      template: { include: { periods: { orderBy: { periodNumber: "asc" } } } },
    },
  });
  if (!timetable) return { error: "Timetable not found." };

  // Build periodNumber → TimetablePeriod mapping
  const existingPeriods = await prisma.timetablePeriod.findMany({ where: { schoolId: ctx.schoolId } });
  const periodByNumber = new Map<string, string>();
  for (const tp of existingPeriods) {
    const num = parseInt(tp.name.replace(/\D/g, ""));
    if (!isNaN(num)) periodByNumber.set(String(num), tp.id);
  }

  // Delete existing timetable entries for this school
  await prisma.timetableEntry.deleteMany({ where: { schoolId: ctx.schoolId } });

  // Find a fallback staff member per subject (for entries where staffId is null)
  const currentSession = await prisma.session.findFirst({ where: { schoolId: ctx.schoolId, isCurrent: true } });
  const assignments = await prisma.assignment.findMany({
    where: { schoolId: ctx.schoolId, assignmentType: "subject_teacher", sessionId: currentSession?.id ?? "" },
    select: { staffId: true, subjectId: true },
  });
  const subjectStaffMap = new Map<string, string>();
  for (const a of assignments) {
    if (a.staffId && a.subjectId && !subjectStaffMap.has(a.subjectId)) subjectStaffMap.set(a.subjectId, a.staffId);
  }
  const allStaff = await prisma.staff.findMany({ where: { schoolId: ctx.schoolId }, take: 1 });
  const defaultStaffId = allStaff[0]?.id;

  // Insert new entries
  let inserted = 0;
  for (const entry of timetable.entries) {
    const periodEntry = timetable.template.periods.find((p) => p.id === entry.periodId);
    if (!periodEntry) continue;
    const tpId = periodByNumber.get(String(periodEntry.periodNumber));
    if (!tpId) continue;
    const resolvedStaff = entry.staffId ?? subjectStaffMap.get(entry.subjectId) ?? defaultStaffId;
    if (!resolvedStaff) continue;
    const staffId: string = resolvedStaff;
    await prisma.timetableEntry.create({
      data: {
        schoolId: ctx.schoolId,
        classId: entry.classId,
        periodId: tpId,
        subjectId: entry.subjectId,
        staffId,
        dayOfWeek: entry.day,
      },
    });
    inserted++;
  }

  await prisma.addonTimetable.update({
    where: { id: timetableId },
    data: { status: "published" },
  });

  revalidatePath("/timetable");
  return { success: `Timetable published (${inserted} entries). You may need to adjust staff assignments in the manual view.` };
}
