"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkPasswordChangeRateLimit } from "@/lib/auth/route-security";
import { validatePasswordStrength } from "@/lib/auth/password";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth/session";

export interface ChangePasswordState { error?: string; success?: string }

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  // Rate-limit password changes to blunt brute-force / abuse.
  const throttle = checkPasswordChangeRateLimit(user.email);
  if (throttle) return { error: throttle };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!newPassword || !confirmPassword) {
    return { error: "New password fields are required." };
  }
  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return { error: strengthError };
  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) return { error: "User not found." };

  // When a password change is being forced, identity was already proven at
  // login (e.g. student first login via date of birth), so the current
  // password is not known/required.
  if (!dbUser.mustChangePassword) {
    if (!currentPassword) {
      return { error: "Current password is required." };
    }
    const ok = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!ok) return { error: "Current password is incorrect." };
  }

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
    proprietorGroupId: user.proprietorGroupId ?? null,
    proprietorPermissionLevel: user.proprietorPermissionLevel ?? null,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  redirect("/dashboard");
}