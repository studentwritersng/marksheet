"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface ReferralManageActionResult {
  error?: string;
  success?: string;
}

export async function updateReferralStatusAction(
  _prev: ReferralManageActionResult,
  formData: FormData,
): Promise<ReferralManageActionResult> {
  let user;
  try {
    user = await getCurrentUser();
    if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  } catch {
    return { error: "Not authorised." };
  }

  const referralId = formData.get("referralId") as string;
  const status = formData.get("status") as string;

  if (!referralId || !["active", "inactive"].includes(status)) {
    return { error: "Invalid input." };
  }

  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) return { error: "Referral not found." };

  await prisma.referral.update({
    where: { id: referralId },
    data: { status },
  });

  await recordAudit({
    actorId: user.userId,
    action: "update",
    entityType: "referral",
    entityId: referralId,
    beforeValue: { status: referral.status } as any,
    afterValue: { status } as any,
  });

  revalidatePath("/console/referrals");
  return { success: `Referral ${status === "active" ? "activated" : "deactivated"}.` };
}

export async function deleteReferralAction(
  referralId: string,
): Promise<ReferralManageActionResult> {
  let user;
  try {
    user = await getCurrentUser();
    if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  } catch {
    return { error: "Not authorised." };
  }

  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) return { error: "Referral not found." };

  await prisma.referral.delete({ where: { id: referralId } });

  await recordAudit({
    actorId: user.userId,
    action: "delete",
    entityType: "referral",
    entityId: referralId,
    beforeValue: { referralCode: referral.referralCode, fullName: referral.fullName } as any,
  });

  revalidatePath("/console/referrals");
  return { success: "Referral deleted." };
}

export async function updateSchoolRegistrationStatusAction(
  _prev: ReferralManageActionResult,
  formData: FormData,
): Promise<ReferralManageActionResult> {
  let user;
  try {
    user = await getCurrentUser();
    if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  } catch {
    return { error: "Not authorised." };
  }

  const registrationId = formData.get("registrationId") as string;
  const status = formData.get("status") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!registrationId || !["pending", "reviewed", "approved", "rejected"].includes(status)) {
    return { error: "Invalid input." };
  }

  const registration = await prisma.schoolRegistration.findUnique({ where: { id: registrationId } });
  if (!registration) return { error: "Registration not found." };

  await prisma.schoolRegistration.update({
    where: { id: registrationId },
    data: { status, notes },
  });

  await recordAudit({
    actorId: user.userId,
    action: "update",
    entityType: "school_registration",
    entityId: registrationId,
    beforeValue: { status: registration.status } as any,
    afterValue: { status, notes } as any,
  });

  revalidatePath("/console/referrals");
  return { success: `Registration ${status}.` };
}
