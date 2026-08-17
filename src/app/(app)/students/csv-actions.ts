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
  // Matching is tolerant: whitespace, punctuation and letter case are ignored
  // so CSV values like "JSS 1"/"JSS-1" still resolve to the school class "JSS1",
  // and "Science" still matches the school's "science" department.
  const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const allClasses = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true, level: true, department: true, section: true },
  });
  const classMap = new Map<string, string>();
  const classInfo = new Map<string, { department: string; level: string }>();
  for (const c of allClasses) {
    classMap.set(`${normalizeKey(c.name)}||`, c.id);
    if (c.department) classMap.set(`${normalizeKey(c.name)}||${normalizeKey(c.department)}`, c.id);
    classMap.set(`${normalizeKey(c.level)}||${normalizeKey(c.department)}`, c.id);
    classInfo.set(c.id, { department: c.department, level: c.level });
  }

  // Get school for shortcode
  const school = await prisma.school.findUnique({ where: { id: ctx.schoolId } });
  if (!school?.shortcode) {
    return { error: "School shortcode not set. Go to Settings → School to configure it first." };
  }

  let created = 0;
  let sequenceSkip = 0;
  const unresolvableClasses: string[] = [];

  // Optional target class chosen by the admin: when present, every row is
  // assigned to this class and the CSV className column is ignored.
  const defaultClassIdRaw = String(formData.get("defaultClassId") ?? "").trim();
  const defaultClass = defaultClassIdRaw
    ? await prisma.class.findFirst({
        where: { id: defaultClassIdRaw, schoolId: ctx.schoolId, archived: false },
        select: { id: true, level: true, department: true },
      })
    : null;

  for (const r of valid) {
    const classKey = `${normalizeKey(r.className)}||${normalizeKey(r.department || "")}`;
    let resolvedClassId = defaultClass
      ? defaultClass.id
      : (r.className ? (classMap.get(classKey) ?? classMap.get(`${normalizeKey(r.className)}||`)) : null);
    if (r.className && !resolvedClassId && !defaultClass) {
      unresolvableClasses.push(r.department ? `${r.className} (${r.department})` : r.className);
      continue;
    }
    if (!resolvedClassId) {
      unresolvableClasses.push("No class specified for a row and no target class chosen.");
      continue;
    }

    // Department is only stored for classes that have SSS departments
    const classMeta = defaultClass ?? classInfo.get(resolvedClassId);
    const studentDepartment = classMeta && classMeta.department ? r.department.toLowerCase() || classMeta.department : "";

    // Atomically increment sequence
    const updated = await prisma.school.update({
      where: { id: ctx.schoolId },
      data: { studentSequence: { increment: 1 } },
    });
    const admissionNumber = `${school.shortcode}${padSeq(updated.studentSequence)}`;

    // Generate user account
    const email = `${admissionNumber.toLowerCase()}@marksheet.top`;
    const dob = r.dateOfBirth ? new Date(r.dateOfBirth) : null;
    const passwordRaw = dob ? formatDob(dob) : `${r.firstName.toLowerCase().slice(0, 3)}${r.lastName.toLowerCase().slice(0, 3)}2026`;
    const passwordHash = await bcrypt.hash(passwordRaw, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash, role: "student", schoolId: ctx.schoolId, isActive: true, mustChangePassword: false },
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
        currentClassId: resolvedClassId,
        department: studentDepartment,
        userId: user.id,
        guardians: r.guardianName
          ? { create: [{ fullName: r.guardianName, phone: r.guardianPhone || "", email: r.guardianEmail || null, relationship: r.guardianRelation || "father" }] }
          : undefined,
      },
    });

    // Send student credentials via email
    await sendEmail({
      to: email,
      subject: "Your Marksheet Portal Credentials",
      text: `Hello ${r.firstName},\n\nYour student portal account has been created.\n\nEmail: ${email}\nPassword: ${passwordRaw}\n\nLogin at: https://marksheet.top/login\n\nRegards,\nSchool Admin`,
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

        // Always write the generated password hash so the credentials we
        // communicate actually authenticate — including when the parent account
        // was created during an earlier registration.
        let parentUser;
        if (!existingParent) {
          parentUser = await prisma.user.create({
            data: {
              email: r.guardianEmail,
              passwordHash: parentHash,
              role: "parent",
              schoolId: ctx.schoolId,
              isActive: true,
            },
          });
        } else {
          parentUser = await prisma.user.update({
            where: { id: existingParent.id },
            data: {
              passwordHash: parentHash,
              isActive: true,
              role: "parent",
              schoolId: ctx.schoolId,
            },
          });
        }

        await prisma.guardian.update({
          where: { id: guardianRecord.id },
          data: { parentUserId: parentUser.id },
        });

        // Send parent credentials via email
        await sendEmail({
          to: r.guardianEmail,
          subject: `Your Parent Portal Credentials – ${(await prisma.school.findUnique({ where: { id: ctx.schoolId }, select: { name: true } }))?.name ?? "School"}`,
          text: `Hello ${r.guardianName},\n\nYour parent portal account has been created to monitor your ward's academic progress.\n\nLogin: ${r.guardianEmail}\nPassword: ${parentPasswordRaw}\n\nLogin at: https://marksheet.top/login\n\nRegards,\nSchool Admin`,
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
