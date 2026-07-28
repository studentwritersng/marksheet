"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth/session";

const SESSION_COOKIE = "marksheet_session";

export interface ReferralLoginResult {
  error?: string;
}

export async function referralLoginAction(
  _prev: ReferralLoginResult,
  formData: FormData,
): Promise<ReferralLoginResult> {
  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();

  if (!email || !password) return { error: "Email and password are required." };

  const user = await prisma.user.findUnique({
    where: { email },
    include: { referral: true },
  });

  if (!user || user.role !== "referral") {
    return { error: "Invalid email or password." };
  }

  if (!user.isActive) {
    return { error: "Your account has been deactivated. Contact support." };
  }

  if (!user.referral) {
    return { error: "Referral profile not found." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { error: "Invalid email or password." };

  const token = createSessionToken({
    userId: user.id,
    role: user.role as any,
    schoolId: null,
    staffId: null,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });

  redirect("/referral/dashboard");
}
