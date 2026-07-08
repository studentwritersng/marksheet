"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import { parseStudentCsv, type StagedRow } from "@/lib/csv/student-import";

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
  try {
    await requireSchoolAdmin();
  } catch {
    return { error: "Not authorised." };
  }

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

  const rowsJson = String(formData.get("rows") ?? "");
  const rows: StagedRow[] = JSON.parse(rowsJson);
  const valid = rows.filter((r) => r.valid);

  if (valid.length === 0) return { error: "No valid rows to commit." };

  // Resolve class names + department to IDs.
  const classKeys = [...new Set(valid.filter((r) => r.className).map((r) => `${r.className}||${r.department || ""}`))];
  const allClasses = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId },
    select: { id: true, name: true, level: true, department: true, section: true },
  });
  const classMap = new Map<string, string>();
  for (const c of allClasses) {
    classMap.set(`${c.name}||`, c.id); // match by name only (no dept)
    if (c.department) classMap.set(`${c.name}||${c.department}`, c.id); // match by name + dept
    // Also match by level + department (in case CSV uses level like "SSS1")
    classMap.set(`${c.level}||${c.department}`, c.id);
  }

  // Check for duplicate admission numbers.
  const admissionNumbers = valid.map((r) => r.admissionNumber);
  const existing = await prisma.student.findMany({
    where: { schoolId: ctx.schoolId, admissionNumber: { in: admissionNumbers } },
    select: { admissionNumber: true },
  });
  const existingSet = new Set(existing.map((s) => s.admissionNumber));

  let created = 0;
  const studentsToCreate = [];
  const unresolvableClasses: string[] = [];

  for (const r of valid) {
    if (existingSet.has(r.admissionNumber)) continue;

    const classKey = `${r.className}||${r.department || ""}`;
    const classId = r.className ? (classMap.get(classKey) ?? classMap.get(`${r.className}||`)) : null;
    if (r.className && !classId) {
      unresolvableClasses.push(r.department ? `${r.className} (${r.department})` : r.className);
      continue;
    }

    studentsToCreate.push({
      schoolId: ctx.schoolId,
      admissionNumber: r.admissionNumber,
      firstName: r.firstName,
      middleName: r.middleName || null,
      lastName: r.lastName,
      email: r.email || null,
      gender: r.gender || null,
      currentClassId: classId,
      guardians: r.guardianName
        ? { create: [{ fullName: r.guardianName, phone: r.guardianPhone || null, email: r.guardianEmail || null, relationship: r.guardianRelation || "father" }] }
        : undefined,
    });
  }

  // Batch create
  for (const data of studentsToCreate) {
    const { guardians, ...studentData } = data;
    await prisma.student.create({
      data: guardians
        ? { ...studentData, guardians }
        : studentData,
    });
    created++;
  }

  let warnings: string[] = [];
  if (unresolvableClasses.length > 0) {
    warnings.push(`Unresolvable classes: ${[...new Set(unresolvableClasses)].join(", ")} — those rows were skipped.`);
  }
  if (existingSet.size > 0) {
    warnings.push(`${existingSet.size} duplicate admission number(s) skipped.`);
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
