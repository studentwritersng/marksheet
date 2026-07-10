"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";

export interface ActionState {
  error?: string;
  success?: string;
  generatedPassword?: string;
}

export async function createStaffAction(
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

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName || !email) return { error: "Full name and email are required." };

  const existing = await prisma.staff.findUnique({
    where: { schoolId_email: { schoolId: ctx.schoolId, email } },
  });
  if (existing) return { error: "A staff member with this email already exists." };

  // Create staff record
  const staff = await prisma.staff.create({
    data: { schoolId: ctx.schoolId, fullName, email, phone: phone || null },
  });

  // Create user account with random password + force password change
  const tempPassword = crypto.randomUUID().slice(0, 12);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.user.create({
    data: {
      schoolId: ctx.schoolId,
      email,
      passwordHash,
      role: "staff",
      staffId: staff.id,
      mustChangePassword: true,
    },
  });

  // Send credentials via email
  const school = await prisma.school.findUnique({
    where: { id: ctx.schoolId },
    select: { name: true },
  });
  const schoolName = school?.name ?? "School";

  await sendEmail({
    to: email,
    subject: `Welcome to ${schoolName} – Your Login Credentials`,
    text: `Hello ${fullName},\n\nYour ${schoolName} staff portal account has been created.\n\nLogin: ${email}\nTemporary password: ${tempPassword}\n\nYou will be required to change your password on first login.\n\nLogin at: https://marksheet.ums.edu.ng/login\n\nRegards,\nSchool Admin`,
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "staff",
    entityId: staff.id,
    afterValue: { fullName, email } as never,
  });

  revalidatePath("/staff");
  return { success: `${fullName} added. Credentials sent to ${email}.`, generatedPassword: tempPassword };
}
