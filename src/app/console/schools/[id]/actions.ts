"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface SchoolActionResult {
  error?: string;
  success?: string;
}

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

export async function setMaintenanceModeAction(schoolId: string, maintenanceMode: boolean): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  await prisma.school.update({ where: { id: schoolId }, data: { maintenanceMode } });
  await recordAudit({
    actorId: (await getCurrentUser())!.userId,
    action: maintenanceMode ? "enable_maintenance" : "disable_maintenance",
    entityType: "school",
    entityId: schoolId,
    afterValue: { maintenanceMode },
    schoolId,
  });
  revalidatePath(`/console/schools/${schoolId}`);
  return { success: `Maintenance mode ${maintenanceMode ? "enabled" : "disabled"}.` };
}

export async function updateLicenseAction(schoolId: string, formData: FormData): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const user = await getCurrentUser();

  const planId = formData.get("planId") as string;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const paymentReference = (formData.get("paymentReference") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!planId || !startDate || !endDate) return { error: "Plan, start date, and end date are required." };
  if (endDate <= startDate) return { error: "End date must be after start date." };

  // Set all previous licenses for this school to expired
  await prisma.schoolLicense.updateMany({
    where: { schoolId, status: { in: ["active", "grace_period"] } },
    data: { status: "expired" },
  });

  await prisma.schoolLicense.create({
    data: {
      schoolId,
      planId,
      startDate,
      endDate,
      status: "active",
      paymentReference,
      notes,
      setBy: user!.userId,
    },
  });

  await recordAudit({
    actorId: user!.userId,
    action: "license_assigned",
    entityType: "school_license",
    entityId: schoolId,
    afterValue: { planId, startDate: startDate.toISOString(), endDate: endDate.toISOString(), paymentReference, notes },
    schoolId,
  });

  revalidatePath(`/console/schools/${schoolId}`);
  return { success: "License assigned." };
}

export async function suspendLicenseAction(licenseId: string): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const user = await getCurrentUser();

  const license = await prisma.schoolLicense.findUnique({ where: { id: licenseId } });
  if (!license) return { error: "License not found." };

  await prisma.schoolLicense.update({ where: { id: licenseId }, data: { status: "suspended" } });
  await recordAudit({
    actorId: user!.userId,
    action: "license_suspended",
    entityType: "school_license",
    entityId: licenseId,
    beforeValue: { status: license.status },
    afterValue: { status: "suspended" },
    schoolId: license.schoolId,
  });
  revalidatePath(`/console/schools/${license.schoolId}`);
  return { success: "License suspended." };
}

export async function reactivateLicenseAction(licenseId: string, newEndDateStr: string): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const user = await getCurrentUser();
  const newEndDate = new Date(newEndDateStr);

  const license = await prisma.schoolLicense.findUnique({ where: { id: licenseId } });
  if (!license) return { error: "License not found." };

  await prisma.schoolLicense.update({
    where: { id: licenseId },
    data: { status: "active", endDate: newEndDate },
  });
  await recordAudit({
    actorId: user!.userId,
    action: "license_reactivated",
    entityType: "school_license",
    entityId: licenseId,
    beforeValue: { status: license.status, endDate: license.endDate.toISOString() },
    afterValue: { status: "active", endDate: newEndDate.toISOString() },
    schoolId: license.schoolId,
  });
  revalidatePath(`/console/schools/${license.schoolId}`);
  return { success: "License reactivated." };
}
