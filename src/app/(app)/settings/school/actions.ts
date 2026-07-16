"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { exportSchoolData } from "@/lib/backup/export";

export interface SchoolSettingsState {
  error?: string;
  success?: string;
}

export async function updateSchoolSettingsAction(
  _prev: SchoolSettingsState,
  formData: FormData,
): Promise<SchoolSettingsState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "School name is required." };

  const shortcode = String(formData.get("shortcode") ?? "").trim().toUpperCase() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const logo = String(formData.get("logo") ?? "").trim() || null;
  const signature = String(formData.get("signature") ?? "").trim() || null;
  const stamp = String(formData.get("stamp") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const motto = String(formData.get("motto") ?? "").trim() || null;
  const maintenanceMode = formData.get("maintenanceMode") === "on";
  const feeGateExams = formData.get("feeGateExams") === "on";
  const feeGateResults = formData.get("feeGateResults") === "on";

  await prisma.school.update({
    where: { id: ctx.schoolId },
    data: { name, shortcode, address, logo, signature, stamp, phone, email, motto, maintenanceMode, feeGateExams, feeGateResults },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "school_settings",
    afterValue: { name, address, phone, email } as never,
  });

  revalidatePath("/settings/school");
  return { success: "School settings updated." };
}

export async function exportSchoolBackupAction(mode: "config" | "full"): Promise<{ data?: string; filename?: string; error?: string }> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try {
    const school = await prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { name: true } });
    const backup = await exportSchoolData(ctx.schoolId, mode);
    const slug = school?.name?.replace(/\s+/g, "-").toLowerCase() ?? "school";
    return { data: JSON.stringify(backup, null, 2), filename: `${slug}-${mode}-backup-${new Date().toISOString().split("T")[0]}.json` };
  } catch (e: any) {
    return { error: `Export failed: ${e.message}` };
  }
}
