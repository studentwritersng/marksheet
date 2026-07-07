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

  // Resolve class names to IDs.
  const classNames = [...new Set(valid.map((r) => r.className).filter(Boolean))];
  const classes = await prisma.class.findMany({
    where: { schoolId: ctx.schoolId, name: { in: classNames } },
    select: { id: true, name: true },
  });
  const classMap = new Map(classes.map((c) => [c.name, c.id]));

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

    const classId = r.className ? classMap.get(r.className) : null;
    if (r.className && !classId) {
      unresolvableClasses.push(r.className);
      continue;
    }

    studentsToCreate.push({
      schoolId: ctx.schoolId,
      admissionNumber: r.admissionNumber,
      firstName: r.firstName,
      middleName: r.middleName || null,
      lastName: r.lastName,
      gender: r.gender || null,
      currentClassId: classId,
      guardians: r.guardianName
        ? { create: [{ fullName: r.guardianName, phone: r.guardianPhone || null, relationship: r.guardianRelation || "father" }] }
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
