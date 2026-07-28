"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export interface ReferralActionResult {
  error?: string;
  success?: string;
  referralCode?: string;
  referralId?: string;
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function registerReferralAction(
  _prev: ReferralActionResult,
  formData: FormData,
): Promise<ReferralActionResult> {
  const fullName = (formData.get("fullName") as string)?.trim();
  const address = (formData.get("address") as string)?.trim();
  const dateOfBirth = formData.get("dateOfBirth") as string;
  const phoneNumber = (formData.get("phoneNumber") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const whatsappNumber = (formData.get("whatsappNumber") as string)?.trim();
  const bankName = (formData.get("bankName") as string)?.trim();
  const bankAccountNumber = (formData.get("bankAccountNumber") as string)?.trim();
  const bankAccountName = (formData.get("bankAccountName") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const confirmPassword = (formData.get("confirmPassword") as string)?.trim();

  if (!fullName) return { error: "Full name is required." };
  if (!address) return { error: "Address is required." };
  if (!dateOfBirth) return { error: "Date of birth is required." };
  if (!phoneNumber) return { error: "Phone number is required." };
  if (!email) return { error: "Email is required." };
  if (!whatsappNumber) return { error: "WhatsApp number is required." };
  if (!bankName) return { error: "Bank name is required." };
  if (!bankAccountNumber) return { error: "Bank account number is required." };
  if (!bankAccountName) return { error: "Bank account name is required." };
  if (!password) return { error: "Password is required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const existingEmail = await prisma.referral.findUnique({ where: { email } });
  if (existingEmail) return { error: "A referral account with this email already exists." };

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return { error: "An account with this email already exists." };

  let referralCode = generateReferralCode();
  let attempts = 0;
  while (attempts < 10) {
    const codeExists = await prisma.referral.findUnique({ where: { referralCode } });
    if (!codeExists) break;
    referralCode = generateReferralCode();
    attempts++;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const referral = await prisma.referral.create({
    data: {
      fullName,
      address,
      dateOfBirth: new Date(dateOfBirth),
      phoneNumber,
      email,
      whatsappNumber,
      bankName,
      bankAccountNumber,
      bankAccountName,
      passwordHash,
      referralCode,
    },
  });

  // Create a User account so the referral can log in
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "referral",
      referralId: referral.id,
    },
  });

  return {
    success: "Registration successful! You can now log in with your email and password.",
    referralCode: referral.referralCode,
    referralId: referral.id,
  };
}
