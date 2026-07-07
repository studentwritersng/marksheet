import Papa from "papaparse";
import { z } from "zod";

/**
 * Student CSV import — staged, validated, with row-level errors
 * (PRD 03 §3.2, PRD 10 §2.3). Never commits directly.
 */

export interface StagedRow {
  row: number;
  admissionNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelation: string;
  errors: string[];
  valid: boolean;
}

const rowSchema = z.object({
  admissionNumber: z.string().min(1, "Required"),
  firstName: z.string().min(1, "Required"),
  middleName: z.string().optional().default(""),
  lastName: z.string().min(1, "Required"),
  gender: z.string().optional().default(""),
  className: z.string().optional().default(""),
  guardianName: z.string().optional().default(""),
  guardianPhone: z.string().optional().default(""),
  guardianRelation: z.string().optional().default("father"),
});

export type CsvPreview = {
  headers: string[];
  rows: StagedRow[];
  summary: { total: number; valid: number; invalid: number };
};

export function parseStudentCsv(
  text: string,
): Omit<CsvPreview, "resolvedClasses"> {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rows: StagedRow[] = result.data.map((raw, i) => {
    const parsed = rowSchema.safeParse(raw);
    const errors: string[] = [];

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    }

    return {
      row: i + 2, // 1-indexed header + data
      admissionNumber: parsed.data?.admissionNumber ?? raw.admissionNumber ?? "",
      firstName: parsed.data?.firstName ?? raw.firstName ?? "",
      middleName: parsed.data?.middleName ?? raw.middleName ?? "",
      lastName: parsed.data?.lastName ?? raw.lastName ?? "",
      gender: parsed.data?.gender ?? raw.gender ?? "",
      className: parsed.data?.className ?? raw.className ?? "",
      guardianName: parsed.data?.guardianName ?? raw.guardianName ?? "",
      guardianPhone: parsed.data?.guardianPhone ?? raw.guardianPhone ?? "",
      guardianRelation: parsed.data?.guardianRelation ?? raw.guardianRelation ?? "",
      errors,
      valid: errors.length === 0,
    };
  });

  return {
    headers: result.meta.fields ?? [],
    rows,
    summary: {
      total: rows.length,
      valid: rows.filter((r) => r.valid).length,
      invalid: rows.filter((r) => !r.valid).length,
    },
  };
}
