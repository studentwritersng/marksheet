"use server";

import { prisma } from "@/lib/prisma";
import { checkSignupRateLimit } from "@/lib/auth/route-security";

export interface SchoolRegistrationActionResult {
  error?: string;
  success?: string;
  registrationId?: string;
  invoiceId?: string;
  principalEmail?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
}

function makeInvoiceNumber(): string {
  const y = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MS-${y}-${rand}`;
}

export async function registerSchoolAction(
  _prev: SchoolRegistrationActionResult,
  formData: FormData,
): Promise<SchoolRegistrationActionResult> {
  const schoolName = (formData.get("schoolName") as string)?.trim();
  const schoolAddress = (formData.get("schoolAddress") as string)?.trim() || null;
  const schoolPhone = (formData.get("schoolPhone") as string)?.trim() || null;
  const schoolEmail = (formData.get("schoolEmail") as string)?.trim() || null;
  const studentCountBand = (formData.get("studentBand") as string)?.trim() || null;
  const branchCountBand = (formData.get("branchBand") as string)?.trim() || null;
  const teacherCountBand = (formData.get("teacherBand") as string)?.trim() || null;
  const principalFirstName = (formData.get("principalFirstName") as string)?.trim();
  const principalLastName = (formData.get("principalLastName") as string)?.trim();
  const principalEmail = (formData.get("principalEmail") as string)?.trim();
  const principalPhone = (formData.get("principalPhone") as string)?.trim() || null;
  const referralCode = (formData.get("referralCode") as string)?.trim() || null;

  // Honeypot — bots fill hidden fields; real users leave it blank.
  if ((formData.get("company") as string)?.trim()) {
    return { error: "Spam detected." };
  }

  // Rate-limit public sign-ups to blunt automated abuse.
  const throttle = checkSignupRateLimit(principalEmail ?? "");
  if (throttle) return { error: throttle };

  if (!schoolName) return { error: "School name is required." };
  if (!studentCountBand) return { error: "Please select the number of students." };
  if (!branchCountBand) return { error: "Please select the number of branches." };
  if (!teacherCountBand) return { error: "Please select the number of teachers." };
  if (!principalFirstName) return { error: "Principal first name is required." };
  if (!principalLastName) return { error: "Principal last name is required." };
  if (!principalEmail) return { error: "Principal email is required." };

  let referralId: string | null = null;
  if (referralCode) {
    const referral = await prisma.referral.findUnique({ where: { referralCode } });
    if (!referral) return { error: "Invalid referral code." };
    referralId = referral.id;
  }

  const setting = await prisma.referralCommissionSetting.findFirst();
  const invoiceAmount = setting ? Number(setting.registrationFee) : 250000;
  const invoiceNumber = makeInvoiceNumber();

  const registration = await prisma.schoolRegistration.create({
    data: {
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      studentCountBand,
      branchCountBand,
      teacherCountBand,
      principalFirstName,
      principalLastName,
      principalEmail,
      principalPhone,
      referralCode,
      referralId,
      registrationFee: invoiceAmount,
      invoiceNumber,
      invoiceAmount,
      paymentStatus: "unpaid",
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      registrationId: registration.id,
      invoiceNumber,
      amount: invoiceAmount,
      status: "pending",
    },
  });

  if (referralId) {
    const commissionPercent = setting ? Number(setting.commissionPercent) : 20;
    const commissionAmount = (invoiceAmount * commissionPercent) / 100;
    await prisma.referralCommission.create({
      data: {
        referralId,
        registrationId: registration.id,
        amount: commissionAmount,
        status: "pending",
      },
    });
  }

  return {
    success: "Application received! Choose how you'd like to pay below.",
    registrationId: registration.id,
    invoiceId: invoice.id,
    principalEmail,
    invoiceNumber,
    invoiceAmount,
  };
}
