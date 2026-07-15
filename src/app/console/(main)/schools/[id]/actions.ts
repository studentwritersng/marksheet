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

export async function updateSchoolAction(_prev: SchoolActionResult, formData: FormData): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const schoolId = formData.get("schoolId") as string;
  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const motto = (formData.get("motto") as string)?.trim() || null;
  const shortcode = (formData.get("shortcode") as string)?.trim() || null;
  if (!schoolId || !name) return { error: "School name is required." };
  if (shortcode) {
    const existing = await prisma.school.findFirst({ where: { shortcode, id: { not: schoolId } } });
    if (existing) return { error: `Shortcode "${shortcode}" is already in use.` };
  }
  await prisma.school.update({ where: { id: schoolId }, data: { name, address, phone, email, motto, shortcode } });
  await recordAudit({
    actorId: (await getCurrentUser())!.userId,
    action: "update",
    entityType: "school",
    entityId: schoolId,
    afterValue: { name, address, phone, email, motto, shortcode },
    schoolId,
  });
  revalidatePath(`/console/schools/${schoolId}`);
  return { success: "School updated." };
}

export async function toggleSuspendSchoolAction(schoolId: string): Promise<SchoolActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { suspended: true } });
  if (!school) return { error: "School not found." };
  const newValue = !school.suspended;
  await prisma.school.update({ where: { id: schoolId }, data: { suspended: newValue } });
  await recordAudit({
    actorId: (await getCurrentUser())!.userId,
    action: newValue ? "suspend_school" : "unsuspend_school",
    entityType: "school",
    entityId: schoolId,
    beforeValue: { suspended: school.suspended },
    afterValue: { suspended: newValue },
    schoolId,
  });
  revalidatePath(`/console/schools/${schoolId}`);
  return { success: `School ${newValue ? "suspended" : "unsuspended"}.` };
}
