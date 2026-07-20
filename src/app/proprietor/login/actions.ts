"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";

export interface ProprietorLoginState {
  error?: string;
}

export async function proprietorLoginAction(
  _prev: ProprietorLoginState,
  formData: FormData,
): Promise<ProprietorLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { proprietorGroup: { select: { id: true } } },
  });
  if (!user || !user.isActive) {
    return { error: "Invalid credentials." };
  }

  if (user.role !== "proprietor") {
    return { error: "Access denied. This login is for proprietors only." };
  }

  if (!user.proprietorGroupId) {
    return { error: "Account is not linked to a school group. Contact the platform owner." };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid credentials." };
  }

  const token = createSessionToken({
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId,
    staffId: user.staffId,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    proprietorGroupId: user.proprietorGroupId,
    proprietorPermissionLevel: user.proprietorPermissionLevel as "full" | "view_only" | null,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect("/proprietor");
}
