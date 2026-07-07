"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email/send";

export interface ActionState {
  error?: string;
  success?: string;
  generatedPassword?: string;
}

export async function createStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const admissionNumber = String(formData.get("admissionNumber") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const studentEmail = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const classId = String(formData.get("classId") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const guardianName = String(formData.get("guardianName") ?? "").trim();
  const guardianPhone = String(formData.get("guardianPhone") ?? "").trim();
  const guardianEmail = String(formData.get("guardianEmail") ?? "").trim().toLowerCase() || null;
  const guardianRelation = String(formData.get("guardianRelation") ?? "").trim() || "father";
  const passportPhoto = String(formData.get("passportPhoto") ?? "").trim() || null;

  if (!admissionNumber || !firstName || !lastName) {
    return { error: "Admission number, first name, and last name are required." };
  }

  const existing = await prisma.student.findUnique({
    where: { schoolId_admissionNumber: { schoolId: ctx.schoolId, admissionNumber } },
  });
  if (existing) return { error: `Admission number ${admissionNumber} already exists.` };

  // Auto-generate student login
  const email = `${admissionNumber.toLowerCase().replace(/\s+/g, ".")}@ums.edu.ng`;
  const passwordRaw = `${firstName.toLowerCase().slice(0, 3)}${lastName.toLowerCase().slice(0, 3)}2026`;
  const passwordHash = await bcrypt.hash(passwordRaw, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "student",
      schoolId: ctx.schoolId,
      isActive: true,
    },
  });

  await prisma.student.create({
    data: {
      schoolId: ctx.schoolId,
      admissionNumber,
      firstName,
      lastName,
      email: studentEmail,
      passportPhoto,
      gender,
      currentClassId: classId,
      userId: user.id,
      guardians: guardianName
        ? { create: [{ fullName: guardianName, phone: guardianPhone || null, email: guardianEmail, relationship: guardianRelation }] }
        : undefined,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "student",
    afterValue: { admissionNumber, firstName, lastName } as never,
  });

  // Send credentials via email
  const sendResult = await sendEmail({
    to: email,
    subject: "Your Marksheet Portal Credentials",
    text: `Hello ${firstName},\n\nYour student portal account has been created.\n\nEmail: ${email}\nPassword: ${passwordRaw}\n\nLogin at: https://marksheet.ums.edu.ng/login\n\nRegards,\nSchool Admin`,
  });

  revalidatePath("/students");
  return {
    success: `${firstName} ${lastName} (${admissionNumber}) registered. Login: ${email}`,
    generatedPassword: sendResult.ok ? undefined : passwordRaw,
  };
}

export async function archiveStudentAction(
  studentId: string,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: ctx.schoolId },
  });
  if (!student) return { error: "Student not found." };

  await prisma.student.update({
    where: { id: studentId },
    data: { status: "withdrawn", currentClassId: null },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "update",
    entityType: "student",
    entityId: studentId,
    afterValue: { status: "withdrawn" } as never,
  });

  revalidatePath("/students");
  return { success: `${student.firstName} ${student.lastName} withdrawn.` };
}
