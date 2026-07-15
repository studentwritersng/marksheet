"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { parseStudentCsv, type StagedRow } from "@/lib/csv/student-import";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email/send";

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

export interface CsvActionState {
  error?: string;
  preview?: {
    headers: string[];
    rows: StagedRow[];
    summary: { total: number; valid: number; invalid: number };
  };
  success?: string;
}

export async function previewStudentCsvAction(
  _prev: CsvActionState,
  formData: FormData,
): Promise<CsvActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file uploaded." };

  const text = await file.text();
  const preview = parseStudentCsv(text);

  return { preview };
}

export async function commitStudentCsvAction(
  _prev: CsvActionState,
  formData: FormData,
): Promise<CsvActionState> {
  let ctx;
  try {
    ctx = await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const rowsJson = String(formData.get("rows") ?? "");
  const rows: StagedRow[] = JSON.parse(rowsJson);
  const valid = rows.filter((r) => r.valid);

  if (valid.length === 0) return { error: "No valid rows to commit." };

  // Resolve class names + department to IDs.
  const allClasses = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true, level: true, department: true, section: true },
  });
  const classMap = new Map<string, string>();
  for (const c of allClasses) {
    classMap.set(`${c.name}||`, c.id);
    if (c.department) classMap.set(`${c.name}||${c.department}`, c.id);
    classMap.set(`${c.level}||${c.department}`, c.id);
  }

  // Get school for shortcode
  const school = await prisma.school.findUnique({ where: { id: ctx.schoolId } });
  if (!school?.shortcode) {
    return { error: "School shortcode not set. Go to Settings → School to configure it first." };
  }

  let created = 0;
  let sequenceSkip = 0;
  const unresolvableClasses: string[] = [];

  for (const r of valid) {
    const classKey = `${r.className}||${r.department || ""}`;
    const classId = r.className ? (classMap.get(classKey) ?? classMap.get(`${r.className}||`)) : null;
    if (r.className && !classId) {
      unresolvableClasses.push(r.department ? `${r.className} (${r.department})` : r.className);
      continue;
    }

    // Atomically increment sequence
    const updated = await prisma.school.update({
      where: { id: ctx.schoolId },
      data: { studentSequence: { increment: 1 } },
    });
    const admissionNumber = `${school.shortcode}${padSeq(updated.studentSequence)}`;

    // Generate user account
    const email = `${admissionNumber.toLowerCase()}@ums.edu.ng`;
    const dob = r.dateOfBirth ? new Date(r.dateOfBirth) : null;
    const passwordRaw = dob ? formatDob(dob) : `${r.firstName.toLowerCase().slice(0, 3)}${r.lastName.toLowerCase().slice(0, 3)}2026`;
    const passwordHash = await bcrypt.hash(passwordRaw, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash, role: "student", schoolId: ctx.schoolId, isActive: true },
    });

    const student = await prisma.student.create({
      data: {
        schoolId: ctx.schoolId,
        admissionNumber,
        firstName: r.firstName,
        middleName: r.middleName || null,
        lastName: r.lastName,
        dateOfBirth: dob || null,
        ethnicity: r.ethnicity || null,
        religion: r.religion || null,
        email: r.email || null,
        gender: r.gender || null,
        currentClassId: classId,
        userId: user.id,
        guardians: r.guardianName
          ? { create: [{ fullName: r.guardianName, phone: r.guardianPhone || null, email: r.guardianEmail || null, relationship: r.guardianRelation || "father" }] }
          : undefined,
      },
    });

    // Send student credentials via email
    await sendEmail({
      to: email,
      subject: "Your Marksheet Portal Credentials",
      text: `Hello ${r.firstName},\n\nYour student portal account has been created.\n\nEmail: ${email}\nPassword: ${passwordRaw}\n\nLogin at: https://marksheet.ums.edu.ng/login\n\nRegards,\nSchool Admin`,
    });

    // Create parent User if guardian email is provided
    if (r.guardianEmail && r.guardianName) {
      const guardianRecord = await prisma.guardian.findFirst({
        where: { studentId: student.id, email: r.guardianEmail },
        select: { id: true },
      });

      if (guardianRecord) {
        const parentPasswordRaw = (r.guardianPhone ?? "").replace(/\D/g, "").slice(0, 8) || Math.random().toString(36).slice(2, 10);
        const parentHash = await bcrypt.hash(parentPasswordRaw, 10);

        const existingParent = await prisma.user.findFirst({
          where: { email: r.guardianEmail, role: "parent", schoolId: ctx.schoolId },
        });

        if (!existingParent) {
          await prisma.user.create({
            data: {
              email: r.guardianEmail,
              passwordHash: parentHash,
              role: "parent",
              schoolId: ctx.schoolId,
              isActive: true,
            },
          });
        }

        const parentUser = await prisma.user.findFirstOrThrow({
          where: { email: r.guardianEmail, role: "parent", schoolId: ctx.schoolId },
        });

        await prisma.guardian.update({
          where: { id: guardianRecord.id },
          data: { parentUserId: parentUser.id },
        });

        // Send parent credentials via email
        await sendEmail({
          to: r.guardianEmail,
          subject: `Your Parent Portal Credentials – ${(await prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { name: true } }))?.name ?? "School"}`,
          text: `Hello ${r.guardianName},\n\nYour parent portal account has been created to monitor your ward's academic progress.\n\nLogin: ${r.guardianEmail}\nPassword: ${parentPasswordRaw}\n\nLogin at: https://marksheet.ums.edu.ng/login\n\nRegards,\nSchool Admin`,
        });
      }
    }

    created++;
  }

  let warnings: string[] = [];
  if (unresolvableClasses.length > 0) {
    warnings.push(`Unresolvable classes: ${[...new Set(unresolvableClasses)].join(", ")} — those rows were skipped.`);
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user.userId,
    action: "create",
    entityType: "student",
    afterValue: { importedCount: created } as never,
  });

  revalidatePath("/students");
  return { success: `${created} student(s) imported. ${warnings.join(" ")}` };
}
