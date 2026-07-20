"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
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
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();

  if (!admissionNumber || !dateOfBirth) {
    return { error: "Admission number and date of birth are required." };
  }

  if (!schoolId) {
    return { error: "School not specified." };
  }

  const student = await prisma.student.findFirst({
    where: { schoolId, admissionNumber },
  });

  if (!student) {
    return { error: "Invalid admission number or date of birth." };
  }

  if (!student.dateOfBirth) {
    return { error: "No date of birth on record. Contact your school." };
  }

  const dobStr = student.dateOfBirth.toISOString().slice(0, 10);
  if (dobStr !== dateOfBirth) {
    return { error: "Invalid admission number or date of birth." };
  }

  let user = student.userId
    ? await prisma.user.findUnique({ where: { id: student.userId } })
    : null;

  if (!user) {
    user = await prisma.user.create({
      data: {
        schoolId,
        email: `student-${student.id}@marksheet.local`,
        passwordHash: await bcrypt.hash(dateOfBirth, 10),
        role: "student",
        isActive: true,
        student: { connect: { id: student.id } },
      },
    });
  }

  if (!user.isActive) {
    return { error: "Account is inactive. Contact your school." };
  }

  const token = createSessionToken({
    userId: user.id,
    role: "student",
    schoolId,
    staffId: null,
    email: user.email,
    mustChangePassword: false,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

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
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/parent");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
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
