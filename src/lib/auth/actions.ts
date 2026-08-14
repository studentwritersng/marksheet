"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkLoginRateLimit } from "./route-security";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "./session";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const schoolId = String(formData.get("schoolId") ?? "").trim();
  const loginMode = String(formData.get("loginMode") ?? "staff");

  if (loginMode === "student") {
    return handleStudentLogin(schoolId, formData);
  }

  if (loginMode === "parent") {
    return handleParentLogin(schoolId, formData);
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const rateError = checkLoginRateLimit(email);
  if (rateError) {
    return { error: rateError };
  }

  const user = schoolId
    ? await prisma.user.findFirst({ where: { email, schoolId } })
    : await prisma.user.findUnique({
        where: { email },
        include: { proprietorGroup: { select: { id: true } } },
      });

  if (!user || !user.isActive) {
    return { error: "Invalid credentials." };
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
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  // Route by role — proprietor goes to the proprietor console, not /dashboard
  if (user.role === "proprietor") {
    redirect("/proprietor");
  }

  redirect("/dashboard");
}

async function handleStudentLogin(
  schoolId: string,
  formData: FormData,
): Promise<LoginState> {
  const admissionNumber = String(formData.get("admissionNumber") ?? "").trim().toUpperCase();
  const password = String(formData.get("password") ?? "");

  if (!admissionNumber || !password) {
    return { error: "Admission number and password are required." };
  }

  const rateError = checkLoginRateLimit(admissionNumber);
  if (rateError) {
    return { error: rateError };
  }

  if (!schoolId) {
    return { error: "School not specified." };
  }

  const student = await prisma.student.findFirst({
    where: { schoolId, admissionNumber },
  });

  if (!student) {
    return { error: "Invalid admission number or password." };
  }

  let user = student.userId
    ? await prisma.user.findUnique({ where: { id: student.userId } })
    : null;

  if (!user) {
    return { error: "Account not set up. Contact your school." };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid admission number or password." };
  }

  if (!user.isActive) {
    return { error: "Account is inactive. Contact your school." };
  }

  const forcePasswordChange = user.mustChangePassword === true;

  const token = createSessionToken({
    userId: user.id,
    role: "student",
    schoolId,
    staffId: null,
    email: user.email,
    mustChangePassword: forcePasswordChange,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  if (forcePasswordChange) {
    redirect("/change-password");
  }

  redirect("/dashboard");
}

async function handleParentLogin(
  schoolId: string,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const rateError = checkLoginRateLimit(email);
  if (rateError) {
    return { error: rateError };
  }

  // Authenticate against User table with role: "parent"
  const user = await prisma.user.findFirst({
    where: { email, role: "parent", schoolId: schoolId || undefined },
  });

  if (!user || !user.isActive) {
    return { error: "Invalid credentials. Use the email and password provided by the school." };
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid credentials." };
  }

  // Verify this parent is linked to at least one guardian/student
  const guardianLink = await prisma.guardian.findFirst({
    where: { parentUserId: user.id },
    select: { id: true },
  });
  if (!guardianLink) {
    return { error: "No wards linked to this account. Contact the school." };
  }

  const token = createSessionToken({
    userId: user.id,
    role: "parent",
    schoolId,
    staffId: null,
    email: user.email,
    mustChangePassword: false,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  redirect("/parent");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  let redirectTo = "/login";

  // If the user belongs to a school, redirect to that school's login page
  if (token) {
    const payload = verifySessionToken(token);
    if (payload?.schoolId) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const school = await prisma.school.findUnique({
          where: { id: payload.schoolId },
          select: { shortcode: true },
        });
        if (school?.shortcode) {
          redirectTo = `/login/${school.shortcode.toLowerCase()}`;
        }
      } catch {}
    }
  }

  store.delete(SESSION_COOKIE);
  redirect(redirectTo);
}

export async function consoleLogoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/console/login");
}

export async function proprietorLogoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/proprietor/login");
}
