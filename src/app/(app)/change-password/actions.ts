"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth/session";

export interface ChangePasswordState { error?: string; success?: string }

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }
  if (newPassword.length < 6) {
    return { error: "New password must be at least 6 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) return { error: "User not found." };

  const ok = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  // Re-issue session without mustChangePassword flag
  const token = createSessionToken({
    userId: user.userId,
    role: user.role,
    schoolId: user.schoolId,
    staffId: user.staffId,
    email: user.email,
    mustChangePassword: false,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 8,
  });

  redirect("/dashboard");
}
