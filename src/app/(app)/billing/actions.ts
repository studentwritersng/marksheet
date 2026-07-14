"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";

export interface BillingActionResult { error?: string; success?: string; planId?: string; }

export async function submitPaymentAction(_prev: BillingActionResult, formData: FormData): Promise<BillingActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) return { error: "Only school admins can pay." };

  const planId = formData.get("planId") as string;
  const methodId = formData.get("methodId") as string;
  const cashCode = (formData.get("cashCode") as string)?.trim();
  const reference = (formData.get("reference") as string)?.trim() || null;
  const proofUrl = (formData.get("proofUrl") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!planId || !methodId) return { error: "Plan and payment method are required." };

  const plan = await prisma.licensePlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) return { error: "Invalid or inactive plan." };
  if (!plan.price) return { error: "Plan has no price set." };
  if (!plan.durationDays) return { error: "Plan has no duration days set." };

  const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
  if (!method || !method.isActive) return { error: "Invalid payment method." };

  if (method.type === "bank_transfer") {
    if (!reference) return { error: "Please enter a payment reference for bank transfer." };
  }

  if (method.type === "cash") {
    if (!cashCode) return { error: "Please enter the cash payment code provided by the admin." };

    const codeRecord = await prisma.cashCode.findUnique({ where: { code: cashCode } });
    if (!codeRecord) return { error: "Invalid cash code." };
    if (codeRecord.isUsed) return { error: "This code has already been used." };
    if (codeRecord.planId !== planId) return { error: "This code is not valid for the selected plan." };
    if (codeRecord.schoolId && codeRecord.schoolId !== user.schoolId) {
      return { error: "This code was issued to a different school." };
    }

    // Auto-verify cash payment
    const payment = await prisma.payment.create({
      data: {
        schoolId: user.schoolId,
        planId,
        amount: plan.price,
        paymentMethodId: methodId,
        cashCodeId: codeRecord.id,
        status: "verified",
        notes,
      },
    });

    await prisma.cashCode.update({
      where: { id: codeRecord.id },
      data: { isUsed: true, usedAt: new Date(), usedBySchoolId: user.schoolId },
    });

    // Activate or extend license
    const existing = await prisma.schoolLicense.findFirst({
      where: { schoolId: user.schoolId, status: { in: ["active", "grace_period"] } },
      orderBy: { endDate: "desc" },
    });

    if (existing) {
      await prisma.schoolLicense.update({
        where: { id: existing.id },
        data: {
          endDate: new Date(existing.endDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000),
          status: "active",
        },
      });
    } else {
      await prisma.schoolLicense.create({
        data: {
          schoolId: user.schoolId,
          planId,
          startDate: new Date(),
          endDate: new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000),
          status: "active",
          paymentReference: `cash-${payment.id}`,
          notes: `Auto-created from cash code ${cashCode}`,
        },
      });
    }

    revalidatePath("/billing");
    return { success: "Cash code validated! Your license is now active." };
  }

  // Bank transfer or online → create pending payment
  try {
    await prisma.payment.create({
      data: {
        schoolId: user.schoolId,
        planId,
        amount: plan.price,
        paymentMethodId: methodId,
        status: "pending",
        reference,
        proofUrl,
        notes,
      },
    });
  } catch {
    return { error: "Failed to submit payment." };
  }

  revalidatePath("/billing");
  return { success: "Payment request submitted. Awaiting verification." };
}
