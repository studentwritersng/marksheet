"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface AddonActionResult { error?: string; success?: string; }

export async function activateAddonWithCodeAction(_prev: AddonActionResult, formData: FormData): Promise<AddonActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authorised." };

  const code = (formData.get("code") as string)?.trim().toUpperCase();
  if (!code) return { error: "Activation code is required." };

  const codeRecord = await prisma.addonCode.findUnique({ where: { code } });
  if (!codeRecord) return { error: "Invalid activation code." };
  if (codeRecord.isUsed) return { error: "This code has already been used." };
  if (codeRecord.schoolId && codeRecord.schoolId !== user.schoolId) {
    return { error: "This code was issued to a different school." };
  }

  const addon = await prisma.addon.findUnique({ where: { id: codeRecord.addonId } });
  if (!addon || !addon.isActive) return { error: "This addon is no longer available." };

  const existing = await prisma.schoolAddon.findUnique({
    where: { schoolId_addonId: { schoolId: user.schoolId, addonId: codeRecord.addonId } },
  });
  if (existing && existing.status === "active") return { error: "This addon is already active for your school." };

  const expiresAt = addon.durationDays ? new Date(Date.now() + addon.durationDays * 24 * 60 * 60 * 1000) : null;

  await prisma.$transaction([
    prisma.addonCode.update({ where: { id: codeRecord.id }, data: { isUsed: true, usedAt: new Date(), usedBySchoolId: user.schoolId } }),
    prisma.schoolAddon.upsert({
      where: { schoolId_addonId: { schoolId: user.schoolId, addonId: codeRecord.addonId } },
      update: { status: "active", activatedVia: "code", activationCode: code, expiresAt, activatedAt: new Date() },
      create: { schoolId: user.schoolId, addonId: codeRecord.addonId, status: "active", activatedVia: "code", activationCode: code, expiresAt },
    }),
  ]);

  revalidatePath("/addons");
  return { success: `"${addon.name}" activated successfully!` };
}

export async function purchaseAddonAction(_prev: AddonActionResult, formData: FormData): Promise<AddonActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authorised." };

  const addonId = formData.get("addonId") as string;
  const methodId = formData.get("methodId") as string;
  if (!addonId || !methodId) return { error: "Addon and payment method are required." };

  const addon = await prisma.addon.findUnique({ where: { id: addonId } });
  if (!addon || !addon.isActive) return { error: "Invalid or inactive addon." };
  if (!addon.price) return { error: "This addon is free. Use the Activate tab instead." };
  if (!addon.durationDays) return { error: "This addon has no duration set." };

  const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
  if (!method || !method.isActive) return { error: "Invalid payment method." };

  const reference = (formData.get("reference") as string)?.trim() || null;
  const proofUrl = (formData.get("proofUrl") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (method.type === "bank_transfer" && !reference) return { error: "Please enter a payment reference for bank transfer." };

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      schoolId: user.schoolId,
      planId: addon.id,
      amount: addon.price,
      paymentMethodId: methodId,
      status: "pending",
      reference,
      proofUrl,
      notes: notes ? `${notes} (Addon purchase: ${addon.name})` : `Addon purchase: ${addon.name}`,
    },
  });

  revalidatePath("/addons");
  return { success: `Purchase request submitted for "${addon.name}". Awaiting verification.` };
}
