"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface PayActionResult { error?: string; success?: string; }

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

export async function verifyPaymentAction(paymentId: string, days: number): Promise<PayActionResult> {
  let user;
  try { user = await guard(); } catch { return { error: "Not authorised." }; }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { plan: true, school: true },
  });
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "pending") return { error: "Payment is not pending." };

  // Find active license for this school or create one
  const existing = await prisma.schoolLicense.findFirst({
    where: { schoolId: payment.schoolId, status: { in: ["active", "grace_period"] } },
    orderBy: { endDate: "desc" },
  });

  if (existing) {
    // Extend the current license
    await prisma.schoolLicense.update({
      where: { id: existing.id },
      data: {
        endDate: new Date(existing.endDate.getTime() + days * 24 * 60 * 60 * 1000),
        status: "active",
      },
    });
  } else {
    // Create a new license
    await prisma.schoolLicense.create({
      data: {
        schoolId: payment.schoolId,
        planId: payment.planId,
        startDate: new Date(),
        endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        status: "active",
        paymentReference: payment.reference ?? `payment-${payment.id}`,
        setBy: user.userId,
        notes: `Auto-created from verified payment ${payment.id}`,
      },
    });
  }

  // Mark payment as verified
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "verified", verifiedById: user.userId, verifiedAt: new Date() },
  });

  revalidatePath("/console/payments");
  revalidatePath(`/console/schools/${payment.schoolId}`);
  return { success: `Payment verified. License ${existing ? "extended" : "created"}.` };
}

export async function rejectPaymentAction(paymentId: string): Promise<PayActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "pending") return { error: "Payment is not pending." };

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "failed" },
  });

  revalidatePath("/console/payments");
  return { success: "Payment rejected." };
}
