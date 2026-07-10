"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface BillingActionResult { error?: string; success?: string; }

export async function submitPaymentAction(_prev: BillingActionResult, formData: FormData): Promise<BillingActionResult> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId) return { error: "Not authorised." };
  if (user.role !== "super_admin" && user.role !== "platform_owner") return { error: "Only school admins can pay." };

  const planId = formData.get("planId") as string;
  const methodId = formData.get("methodId") as string;
  const reference = (formData.get("reference") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!planId || !methodId) return { error: "Plan and payment method are required." };

  const plan = await prisma.licensePlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) return { error: "Invalid or inactive plan." };
  if (!plan.price) return { error: "Plan has no price set." };

  const method = await prisma.paymentMethod.findUnique({ where: { id: methodId } });
  if (!method || !method.isActive) return { error: "Invalid payment method." };

  // For bank_transfer, reference is required
  if (method.type === "bank_transfer" && !reference) {
    return { error: "Please enter a payment reference for bank transfer." };
  }

  try {
    await prisma.payment.create({
      data: {
        schoolId: user.schoolId,
        planId,
        amount: plan.price,
        paymentMethodId: methodId,
        status: "pending",
        reference,
        notes,
      },
    });
  } catch {
    return { error: "Failed to submit payment." };
  }

  revalidatePath("/billing");
  return { success: "Payment request submitted. Awaiting verification." };
}
