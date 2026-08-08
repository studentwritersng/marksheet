"use server";

import { prisma } from "@/lib/prisma";

export interface SchoolRegistrationActionResult {
  error?: string;
  success?: string;
}

export async function registerSchoolAction(
  _prev: SchoolRegistrationActionResult,
  formData: FormData,
): Promise<SchoolRegistrationActionResult> {
  const schoolName = (formData.get("schoolName") as string)?.trim();
  const schoolAddress = (formData.get("schoolAddress") as string)?.trim() || null;
  const schoolPhone = (formData.get("schoolPhone") as string)?.trim() || null;
  const schoolEmail = (formData.get("schoolEmail") as string)?.trim() || null;
  const principalFirstName = (formData.get("principalFirstName") as string)?.trim();
  const principalLastName = (formData.get("principalLastName") as string)?.trim();
  const principalEmail = (formData.get("principalEmail") as string)?.trim();
  const principalPhone = (formData.get("principalPhone") as string)?.trim() || null;
  const referralCode = (formData.get("referralCode") as string)?.trim() || null;

  // Payment fields
  const paymentMethodId = (formData.get("paymentMethodId") as string)?.trim() || null;
  const paymentReference = (formData.get("paymentReference") as string)?.trim() || null;
  const paymentProofUrl = (formData.get("paymentProofUrl") as string)?.trim() || null;
  const registrationFeeRaw = (formData.get("registrationFee") as string)?.trim() || null;

  if (!schoolName) return { error: "School name is required." };
  if (!principalFirstName) return { error: "Principal first name is required." };
  if (!principalLastName) return { error: "Principal last name is required." };
  if (!principalEmail) return { error: "Principal email is required." };

  // Validate referral code if provided
  let referralId: string | null = null;
  if (referralCode) {
    const referral = await prisma.referral.findUnique({ where: { referralCode } });
    if (!referral) return { error: "Invalid referral code." };
    referralId = referral.id;
  }

  // Validate payment method if provided
  if (paymentMethodId) {
    const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
    if (!method) return { error: "Invalid payment method." };
  }

  const registrationFee = registrationFeeRaw ? parseFloat(registrationFeeRaw) : null;
  const paymentStatus = paymentMethodId && paymentReference ? "pending" : "unpaid";

  await prisma.schoolRegistration.create({
    data: {
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      principalFirstName,
      principalLastName,
      principalEmail,
      principalPhone,
      referralCode,
      referralId,
      registrationFee: registrationFee || undefined,
      paymentMethodId: paymentMethodId || undefined,
      paymentReference: paymentReference || undefined,
      paymentProofUrl: paymentProofUrl || undefined,
      paymentStatus,
    },
  });

  // Auto-create commission if referral exists
  if (referralId && registrationFee && registrationFee > 0) {
    const setting = await prisma.referralCommissionSetting.findFirst();
    const commissionPercent = setting ? Number(setting.commissionPercent) : 20;
    const commissionAmount = (registrationFee * commissionPercent) / 100;

    const registration = await prisma.schoolRegistration.findFirst({
      where: { schoolEmail: principalEmail },
      orderBy: { createdAt: "desc" },
    });

    if (registration) {
      await prisma.referralCommission.create({
        data: {
          referralId,
          registrationId: registration.id,
          amount: commissionAmount,
          status: "pending",
        },
      });
    }
  }

  return { success: "Registration submitted! The platform team will review your application and get in touch." };
}
