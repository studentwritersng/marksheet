"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { Prisma } from "@prisma/client";

export interface LicenseActionResult { error?: string; success?: string; }

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

export async function createPlanAction(_prev: LicenseActionResult, formData: FormData): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const name = (formData.get("name") as string)?.trim();
  const durationType = formData.get("durationType") as string;
  const priceRaw = formData.get("price") as string;
  const durationDaysRaw = formData.get("durationDays") as string;
  if (!name || !durationType) return { error: "Name and duration type are required." };
  if (!["monthly", "termly"].includes(durationType)) return { error: "Invalid duration type." };
  const price = priceRaw ? parseFloat(priceRaw) : null;
  const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : null;
  if (price !== null && isNaN(price)) return { error: "Invalid price." };
  if (durationDays !== null && (isNaN(durationDays) || durationDays < 1)) return { error: "Invalid duration days." };
  try {
    await prisma.licensePlan.create({ data: { name, durationType: durationType as "monthly" | "termly", price, durationDays } });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "A plan with this name already exists." };
    return { error: "Failed to create plan." };
  }
  revalidatePath("/console/licenses");
  return { success: `Plan "${name}" created.` };
}

export async function updatePlanAction(_prev: LicenseActionResult, formData: FormData): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const id = formData.get("planId") as string;
  const name = (formData.get("name") as string)?.trim();
  const durationType = formData.get("durationType") as string;
  const priceRaw = formData.get("price") as string;
  const durationDaysRaw = formData.get("durationDays") as string;
  if (!id || !name || !durationType) return { error: "Name and duration type are required." };
  if (!["monthly", "termly"].includes(durationType)) return { error: "Invalid duration type." };
  const price = priceRaw ? parseFloat(priceRaw) : null;
  const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : null;
  if (price !== null && isNaN(price)) return { error: "Invalid price." };
  if (durationDays !== null && (isNaN(durationDays) || durationDays < 1)) return { error: "Invalid duration days." };
  try {
    await prisma.licensePlan.update({ where: { id }, data: { name, durationType: durationType as "monthly" | "termly", price, durationDays } });
  } catch {
    return { error: "Failed to update plan." };
  }
  revalidatePath("/console/licenses");
  return { success: `Plan "${name}" updated.` };
}

export async function togglePlanActiveAction(planId: string, isActive: boolean): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  await prisma.licensePlan.update({ where: { id: planId }, data: { isActive } });
  revalidatePath("/console/licenses");
  return { success: `Plan ${isActive ? "activated" : "deactivated"}.` };
}

export async function deletePlanAction(planId: string): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const count = await prisma.schoolLicense.count({ where: { planId } });
  if (count > 0) return { error: "Cannot delete a plan that has licenses assigned. Deactivate it instead." };
  await prisma.licensePlan.delete({ where: { id: planId } });
  revalidatePath("/console/licenses");
  return { success: "Plan deleted." };
}

// ── Stage management ────────────────────────────────────────────────────

export async function createStageAction(_prev: LicenseActionResult, formData: FormData): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const planId = formData.get("planId") as string;
  const name = (formData.get("name") as string)?.trim();
  const priceRaw = formData.get("price") as string;
  const sortOrderRaw = formData.get("sortOrder") as string;
  if (!planId || !name) return { error: "Plan and stage name are required." };
  const price = priceRaw ? parseFloat(priceRaw) : null;
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;
  await prisma.planStage.create({ data: { planId, name, price, sortOrder } });
  revalidatePath("/console/licenses");
  return { success: `Stage "${name}" created.` };
}

export async function updateStageAction(_prev: LicenseActionResult, formData: FormData): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const id = formData.get("stageId") as string;
  const name = (formData.get("name") as string)?.trim();
  const priceRaw = formData.get("price") as string;
  const sortOrderRaw = formData.get("sortOrder") as string;
  if (!id || !name) return { error: "Stage name is required." };
  const price = priceRaw ? parseFloat(priceRaw) : null;
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;
  await prisma.planStage.update({ where: { id }, data: { name, price, sortOrder } });
  revalidatePath("/console/licenses");
  return { success: `Stage "${name}" updated.` };
}

export async function deleteStageAction(stageId: string): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const schools = await prisma.school.count({ where: { stageId } });
  if (schools > 0) return { error: `${schools} school(s) use this stage. Reassign them first.` };
  await prisma.planStage.delete({ where: { id: stageId } });
  revalidatePath("/console/licenses");
  return { success: "Stage deleted." };
}

export async function setLicenseStatusAction(licenseId: string, status: string): Promise<LicenseActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  if (!["active", "grace_period", "expired", "suspended"].includes(status)) return { error: "Invalid status." };
  const license = await prisma.schoolLicense.findUnique({ where: { id: licenseId } });
  if (!license) return { error: "License not found." };
  await prisma.schoolLicense.update({ where: { id: licenseId }, data: { status: status as any } });
  const user = await getCurrentUser();
  await recordAudit({
    actorId: user!.userId,
    action: "license_status_changed",
    entityType: "school_license",
    entityId: licenseId,
    beforeValue: { status: license.status },
    afterValue: { status },
    schoolId: license.schoolId,
  });
  revalidatePath("/console/licenses");
  return { success: `License status changed to "${status}".` };
}
