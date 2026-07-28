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
    },
  });

  return { success: "Registration submitted! The platform team will review your application and get in touch." };
}
