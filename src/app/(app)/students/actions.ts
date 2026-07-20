"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { isGroupAddonActive } from "@/lib/addons/group-check";
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
        ? { create: [{ fullName: guardianName, phone: guardianPhone || "", email: guardianEmail, relationship: guardianRelation }] }
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

      // Send parent credentials via email
      await sendEmail({
        to: guardianEmail,
        subject: `Your Parent Portal Credentials – ${(await prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { name: true } }))?.name ?? "School"}`,
        text: `Hello ${guardianName},\n\nYour parent portal account has been created to monitor your ward's academic progress.\n\nLogin: ${guardianEmail}\nPassword: ${parentPasswordRaw}\n\nLogin at: https://marksheet.ums.edu.ng/login\n\nRegards,\nSchool Admin`,
      });
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

// ── Cross-branch student transfer (PRD 19 §4.4) ───────────────────────────

export interface TransferState {
  error?: string;
  success?: string;
}

/**
 * Search for origin students within the destination school's group only.
 * Returns matching students from OTHER branches in the same group.
 */
export async function searchGroupStudentsAction(query: string): Promise<{
  error?: string;
  results?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    schoolName: string;
    schoolId: string;
  }[];
}> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  // Check this school is in a group with Multi-Branch addon active
  const membership = await prisma.groupMembership.findUnique({
    where: { schoolId: ctx.schoolId },
    include: { group: true },
  });
  if (!membership) return { error: "This school is not part of a group." };

  const addonActive = await isGroupAddonActive(membership.groupId, "Multi-Branch / Group of Schools");
  if (!addonActive) return { error: "Multi-Branch addon is not active for your group." };

  const trimmed = query.trim();
  if (trimmed.length < 2) return { results: [] };

  // Search students in OTHER schools within the same group
  const otherMemberships = await prisma.groupMembership.findMany({
    where: { groupId: membership.groupId, schoolId: { not: ctx.schoolId } },
    select: { schoolId: true },
  });
  const otherSchoolIds = otherMemberships.map((m) => m.schoolId);
  if (otherSchoolIds.length === 0) return { results: [] };

  const students = await prisma.student.findMany({
    where: {
      schoolId: { in: otherSchoolIds },
      status: "active",
      OR: [
        { firstName: { contains: trimmed, mode: "insensitive" } },
        { lastName: { contains: trimmed, mode: "insensitive" } },
        { admissionNumber: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    include: { school: { select: { name: true } } },
    take: 20,
  });

  return {
    results: students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
      schoolName: s.school.name,
      schoolId: s.schoolId,
    })),
  };
}

/**
 * Transfer a student from another branch in the group to this school.
 * Creates a new Student record at the destination (this school) with a new
 * admission number, and a GroupStudentTransferRecord linking origin → destination.
 * The origin record is untouched.
 */
export async function transferStudentFromBranchAction(
  _prev: TransferState,
  formData: FormData,
): Promise<TransferState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const originStudentId = String(formData.get("originStudentId") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!originStudentId) return { error: "Origin student is required." };

  // Verify this school is in a group with Multi-Branch addon active
  const membership = await prisma.groupMembership.findUnique({
    where: { schoolId: ctx.schoolId },
    include: { group: true },
  });
  if (!membership) return { error: "This school is not part of a group." };

  const addonActive = await isGroupAddonActive(membership.groupId, "Multi-Branch / Group of Schools");
  if (!addonActive) return { error: "Multi-Branch addon is not active for your group." };

  // Verify origin student is in the same group (but different school)
  const originStudent = await prisma.student.findUnique({
    where: { id: originStudentId },
    include: { school: { select: { name: true } } },
  });
  if (!originStudent) return { error: "Origin student not found." };
  if (originStudent.schoolId === ctx.schoolId) return { error: "Cannot transfer from your own school." };

  const originMembership = await prisma.groupMembership.findUnique({
    where: { schoolId: originStudent.schoolId },
  });
  if (!originMembership || originMembership.groupId !== membership.groupId) {
    return { error: "Origin student is not in the same group. Cross-group transfers are not allowed." };
  }

  // Check for existing transfer (prevent duplicates)
  const existing = await prisma.groupStudentTransferRecord.findFirst({
    where: { originStudentId: originStudent.id, destinationSchoolId: ctx.schoolId },
  });
  if (existing) return { error: "This student has already been transferred to this school." };

  // Generate new admission number at destination school
  const school = await prisma.school.findUnique({ where: { id: ctx.schoolId } });
  const shortcode = school?.shortcode;
  if (!shortcode) return { error: "School shortcode not set." };

  const updated = await prisma.school.update({
    where: { id: ctx.schoolId },
    data: { studentSequence: { increment: 1 } },
  });
  const newAdmissionNumber = `${shortcode}${padSeq(updated.studentSequence)}`;

  // Generate student login
  const email = `${newAdmissionNumber.toLowerCase()}@${shortcode.toLowerCase()}.edu.ng`;
  const passwordRaw = originStudent.dateOfBirth
    ? formatDob(originStudent.dateOfBirth)
    : `${originStudent.firstName.toLowerCase().slice(0, 3)}${originStudent.lastName.toLowerCase().slice(0, 3)}2026`;
  const passwordHash = await bcrypt.hash(passwordRaw, 10);

  // Create new Student record at destination
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "student",
      schoolId: ctx.schoolId,
      isActive: true,
    },
  });

  const destStudent = await prisma.student.create({
    data: {
      schoolId: ctx.schoolId,
      admissionNumber: newAdmissionNumber,
      firstName: originStudent.firstName,
      lastName: originStudent.lastName,
      email: originStudent.email,
      dateOfBirth: originStudent.dateOfBirth,
      ethnicity: originStudent.ethnicity,
      religion: originStudent.religion,
      passportPhoto: originStudent.passportPhoto,
      gender: originStudent.gender,
      currentClassId: classId,
      userId: user.id,
      bioData: originStudent.bioData as any,
    },
  });

  // Create the transfer record
  await prisma.groupStudentTransferRecord.create({
    data: {
      groupId: membership.groupId,
      originSchoolId: originStudent.schoolId,
      originStudentId: originStudent.id,
      destinationSchoolId: ctx.schoolId,
      destinationStudentId: destStudent.id,
      initiatedBy: ctx.user.userId,
      notes,
    },
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "student",
    entityId: destStudent.id,
    afterValue: {
      admissionNumber: newAdmissionNumber,
      firstName: originStudent.firstName,
      lastName: originStudent.lastName,
      transferredFrom: originStudent.school.name,
      originAdmissionNumber: originStudent.admissionNumber,
    } as never,
  });

  revalidatePath("/students");
  return {
    success: `${originStudent.firstName} ${originStudent.lastName} transferred from ${originStudent.school.name}. New admission number: ${newAdmissionNumber}. Login: ${email}`,
  };
}
