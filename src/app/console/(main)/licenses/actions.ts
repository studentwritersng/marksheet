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
