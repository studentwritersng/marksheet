"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface PMActionResult { error?: string; success?: string; }

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
}

export async function createPaymentMethodAction(_prev: PMActionResult, formData: FormData): Promise<PMActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const type = formData.get("type") as string;
  const label = (formData.get("label") as string)?.trim();
  if (!type || !label) return { error: "Type and label are required." };
  if (!["bank_transfer", "cash", "online"].includes(type)) return { error: "Invalid type." };

  let details: Record<string, string> | null = null;
  if (type === "bank_transfer") {
    const bankName = (formData.get("bankName") as string)?.trim();
    const accountNumber = (formData.get("accountNumber") as string)?.trim();
    const accountName = (formData.get("accountName") as string)?.trim();
    const instructions = (formData.get("instructions") as string)?.trim();
    if (!bankName || !accountNumber || !accountName) return { error: "All bank details are required." };
    details = { bankName, accountNumber, accountName };
    if (instructions) details.instructions = instructions;
  } else if (type === "online") {
    const provider = (formData.get("provider") as string)?.trim();
    const publicKey = (formData.get("publicKey") as string)?.trim();
    if (!provider || !publicKey) return { error: "Provider and public key are required." };
    details = { provider, publicKey };
  }

  try {
    await prisma.paymentMethod.create({ data: { type: type as any, label, details: details ?? undefined } });
  } catch {
    return { error: "Failed to create payment method." };
  }
  revalidatePath("/console/payment-methods");
  return { success: `"${label}" added.` };
}

export async function togglePaymentMethodAction(id: string, isActive: boolean): Promise<PMActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  await prisma.paymentMethod.update({ where: { id }, data: { isActive } });
  revalidatePath("/console/payment-methods");
  return { success: `Method ${isActive ? "activated" : "deactivated"}.` };
}

export async function deletePaymentMethodAction(id: string): Promise<PMActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const count = await prisma.payment.count({ where: { paymentMethodId: id } });
  if (count > 0) return { error: "Cannot delete — has payment records. Deactivate it instead." };
  await prisma.paymentMethod.delete({ where: { id } });
  revalidatePath("/console/payment-methods");
  return { success: "Payment method deleted." };
}
