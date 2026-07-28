"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface SettingsActionResult {
  error?: string;
  success?: string;
}

export async function updateReferralSettingsAction(
  _prev: SettingsActionResult,
  formData: FormData,
): Promise<SettingsActionResult> {
  let user;
  try {
    user = await getCurrentUser();
    if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  } catch {
    return { error: "Not authorised." };
  }

  const registrationFeeRaw = (formData.get("registrationFee") as string)?.trim();
  const commissionPercentRaw = (formData.get("commissionPercent") as string)?.trim();

  const registrationFee = registrationFeeRaw ? parseFloat(registrationFeeRaw) : null;
  const commissionPercent = commissionPercentRaw ? parseFloat(commissionPercentRaw) : null;

  if (registrationFee !== null && (isNaN(registrationFee) || registrationFee < 0)) {
    return { error: "Invalid registration fee." };
  }
  if (commissionPercent !== null && (isNaN(commissionPercent) || commissionPercent < 0 || commissionPercent > 100)) {
    return { error: "Commission percent must be between 0 and 100." };
  }

  const existing = await prisma.referralCommissionSetting.findFirst();

  if (existing) {
    await prisma.referralCommissionSetting.update({
      where: { id: existing.id },
      data: {
        ...(registrationFee !== null ? { registrationFee } : {}),
        ...(commissionPercent !== null ? { commissionPercent } : {}),
      },
    });
  } else {
    await prisma.referralCommissionSetting.create({
      data: {
        registrationFee: registrationFee ?? 10000,
        commissionPercent: commissionPercent ?? 10,
      },
    });
  }

  await recordAudit({
    actorId: user.userId,
    action: "update",
    entityType: "referral_settings",
    afterValue: { registrationFee, commissionPercent } as any,
  });

  revalidatePath("/console/referral-settings");
  return { success: "Settings updated." };
}
