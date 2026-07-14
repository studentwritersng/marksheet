"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email/send";

export interface ActionState {
  error?: string;
  success?: string;
  generatedPassword?: string;
  parentCredentials?: { email: string; password: string };
}

/** Pad a number to at least 5 digits */
function padSeq(n: number): string {
  return String(n).padStart(5, "0");
}

function formatDob(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}${mm}${yyyy}`;
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
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const studentEmail = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const classId = String(formData.get("classId") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;
  const dobRaw = String(formData.get("dateOfBirth") ?? "").trim();
  const ethnicity = String(formData.get("ethnicity") ?? "").trim() || null;
  const religion = String(formData.get("religion") ?? "").trim() || null;
  const guardianName = String(formData.get("guardianName") ?? "").trim();
  const guardianPhone = String(formData.get("guardianPhone") ?? "").trim();
  const guardianEmail = String(formData.get("guardianEmail") ?? "").trim().toLowerCase() || null;
  const guardianRelation = String(formData.get("guardianRelation") ?? "").trim() || "father";
  const passportPhoto = String(formData.get("passportPhoto") ?? "").trim() || null;
  const dataConsent = formData.get("dataConsent") === "true";

  if (!firstName || !lastName) {
    return { error: "First name and last name are required." };
  }

  // Parse date of birth; if invalid, return error early
  const dateOfBirth = dobRaw ? new Date(dobRaw) : null;
  if (dobRaw && isNaN(dateOfBirth!.getTime())) {
    return { error: "Invalid date of birth." };
  }

  // Auto-generate admission number: shortcode + 5-digit sequence
  const school = await prisma.school.findUnique({ where: { id: ctx.schoolId } });
  const shortcode = school?.shortcode;
  if (!shortcode) {
    return { error: "School shortcode not set. Go to Settings → School to configure it first." };
  }

  const updated = await prisma.school.update({
    where: { id: ctx.schoolId },
    data: { studentSequence: { increment: 1 } },
  });
  const admissionNumber = `${shortcode}${padSeq(updated.studentSequence)}`;

  // Auto-generate student login
  const email = `${admissionNumber.toLowerCase()}@ums.edu.ng`;
  const passwordRaw = dateOfBirth ? formatDob(dateOfBirth) : `${firstName.toLowerCase().slice(0, 3)}${lastName.toLowerCase().slice(0, 3)}2026`;
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

  const student = await prisma.student.create({
    data: {
      schoolId: ctx.schoolId,
      admissionNumber,
      firstName,
      lastName,
      email: studentEmail,
      dateOfBirth,
      ethnicity,
      religion,
      passportPhoto,
      gender,
      currentClassId: classId,
      userId: user.id,
      guardians: guardianName
        ? { create: [{ fullName: guardianName, phone: guardianPhone || null, email: guardianEmail, relationship: guardianRelation }] }
        : undefined,
    },
  });

  // Create parent User account if guardian email is provided
  let parentCreds: { email: string; password: string } | undefined;
  if (guardianEmail && guardianName) {
    const guardianRecord = await prisma.guardian.findFirst({
      where: { studentId: student.id, email: guardianEmail },
      select: { id: true },
    });

    if (guardianRecord) {
      const parentPasswordRaw = (guardianPhone ?? "").replace(/\D/g, "").slice(0, 8) || Math.random().toString(36).slice(2, 10);
      const parentHash = await bcrypt.hash(parentPasswordRaw, 10);

      const existingParent = await prisma.user.findFirst({
        where: { email: guardianEmail, role: "parent", schoolId: ctx.schoolId },
      });

      if (!existingParent) {
        await prisma.user.create({
          data: {
            email: guardianEmail,
            passwordHash: parentHash,
            role: "parent",
            schoolId: ctx.schoolId,
            isActive: true,
          },
        });
      }

      const parentUser = await prisma.user.findFirstOrThrow({
        where: { email: guardianEmail, role: "parent", schoolId: ctx.schoolId },
      });

      await prisma.guardian.update({
        where: { id: guardianRecord.id },
        data: { parentUserId: parentUser.id },
      });

      parentCreds = { email: guardianEmail, password: parentPasswordRaw };
    }
  }

  // Capture data processing consent (PRD 11 §3.4)
  if (dataConsent) {
    await prisma.consentRecord.create({
      data: {
        studentId: student.id,
        consentType: "data_processing",
        consentMethod: "registration_form",
        schoolId: ctx.schoolId,
      },
    }).catch(() => { /* non-critical */ });
  }

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
    ...(parentCreds ? { parentCredentials: parentCreds } : {}),
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
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

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
