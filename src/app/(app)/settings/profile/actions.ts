"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit";

export interface ProfileState {
  error?: string;
  success?: string;
}

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user || !user.staffId || !user.schoolId) return { error: "Not authorised." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) return { error: "Full name is required." };

  const phone = String(formData.get("phone") ?? "").trim() || null;
  const image = String(formData.get("image") ?? "").trim() || null;
  const signature = String(formData.get("signature") ?? "").trim() || null;

  await prisma.staff.update({
    where: { id: user.staffId, schoolId: user.schoolId },
    data: { fullName, phone, image, signature },
  });

  await recordAudit({
    schoolId: user.schoolId,
    actorId: user.userId,
    action: "update",
    entityType: "staff",
    entityId: user.staffId,
    afterValue: { fullName, phone } as never,
  });

  revalidatePath("/settings/profile");
  return { success: "Profile updated." };
}

export async function updateStudentProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user || !user.schoolId || user.role !== "student") return { error: "Not authorised." };

  const student = await prisma.student.findUnique({ where: { userId: user.userId } });
  if (!student) return { error: "Student record not found." };

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName || !lastName) return { error: "First and last name are required." };

  const middleName = String(formData.get("middleName") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const image = String(formData.get("image") ?? "").trim() || null;

  await prisma.student.update({
    where: { id: student.id },
    data: { firstName, middleName, lastName, email: phone, passportPhoto: image },
  });

  await recordAudit({
    schoolId: user.schoolId,
    actorId: user.userId,
    action: "update",
    entityType: "student",
    entityId: student.id,
    afterValue: { firstName, lastName } as never,
  });

  revalidatePath("/settings/profile");
  return { success: "Profile updated." };
}
