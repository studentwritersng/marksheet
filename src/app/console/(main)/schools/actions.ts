"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface SchoolActionResult {
  error?: string;
  success?: string;
}

export async function createSchoolAction(
  _prev: SchoolActionResult,
  formData: FormData,
): Promise<SchoolActionResult> {
  let user;
  try {
    user = await getCurrentUser();
    if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  } catch {
    return { error: "Not authorised." };
  }

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const shortcode = (formData.get("shortcode") as string)?.trim() || null;
  const adminEmail = (formData.get("adminEmail") as string)?.trim() || null;
  const adminPassword = (formData.get("adminPassword") as string)?.trim() || null;
  const adminFirstName = (formData.get("adminFirstName") as string)?.trim() || null;
  const adminLastName = (formData.get("adminLastName") as string)?.trim() || null;

  if (!name) return { error: "School name is required." };

  // Check shortcode uniqueness
  if (shortcode) {
    const existing = await prisma.school.findFirst({ where: { shortcode } });
    if (existing) return { error: `Shortcode "${shortcode}" is already in use.` };
  }

  const school = await prisma.school.create({
    data: { name, address, phone, email, shortcode },
  });

  // Optionally create an initial admin user for the school
  if (adminEmail && adminPassword && adminFirstName && adminLastName) {
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      return { error: `User "${adminEmail}" already exists.` };
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const staff = await prisma.staff.create({
      data: {
        schoolId: school.id,
        fullName: `${adminFirstName} ${adminLastName}`,
        email: adminEmail,
      },
    });

    await prisma.user.create({
      data: {
        schoolId: school.id,
        email: adminEmail,
        passwordHash,
        role: "staff",
        staffId: staff.id,
      },
    });

    // Create school_admin assignment so the user gets full admin access
    await prisma.assignment.create({
      data: {
        schoolId: school.id,
        staffId: staff.id,
        assignmentType: "school_admin",
        isTemporary: false,
      },
    });
  }

  await recordAudit({
    actorId: user.userId,
    action: "create",
    entityType: "school",
    entityId: school.id,
    afterValue: { name, address, phone, email, shortcode, createdAdmin: !!adminEmail },
    schoolId: school.id,
  });

  revalidatePath("/console/schools");
  return { success: `"${name}" created.` };
}
