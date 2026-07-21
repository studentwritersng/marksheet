import Papa from "papaparse";
import { z } from "zod";

/**
 * Student CSV import — staged, validated, with row-level errors.
 * Never commits directly.
 */

export interface StagedRow {
  row: number;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  ethnicity: string;
  religion: string;
  gender: string;
  className: string;
  department: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelation: string;
  errors: string[];
  valid: boolean;
}

const rowSchema = z.object({
  firstName: z.string().min(1, "Required"),
  middleName: z.string().optional().default(""),
  lastName: z.string().min(1, "Required"),
  dateOfBirth: z.string().optional().default(""),
  ethnicity: z.string().optional().default(""),
  religion: z.string().optional().default(""),
  gender: z.string().optional().default(""),
  className: z.string().optional().default(""),
  department: z.string().optional().default(""),
  email: z.string().optional().default(""),
  guardianName: z.string().optional().default(""),
  guardianPhone: z.string().optional().default(""),
  guardianEmail: z.string().optional().default(""),
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
      firstName: parsed.data?.firstName ?? raw.firstName ?? "",
      middleName: parsed.data?.middleName ?? raw.middleName ?? "",
      lastName: parsed.data?.lastName ?? raw.lastName ?? "",
      dateOfBirth: parsed.data?.dateOfBirth ?? raw.dateOfBirth ?? "",
      ethnicity: parsed.data?.ethnicity ?? raw.ethnicity ?? "",
      religion: parsed.data?.religion ?? raw.religion ?? "",
      gender: parsed.data?.gender ?? raw.gender ?? "",
      className: parsed.data?.className ?? raw.className ?? "",
      department: parsed.data?.department ?? raw.department ?? "",
      email: parsed.data?.email ?? raw.email ?? "",
      guardianName: parsed.data?.guardianName ?? raw.guardianName ?? "",
      guardianPhone: parsed.data?.guardianPhone ?? raw.guardianPhone ?? "",
      guardianEmail: parsed.data?.guardianEmail ?? raw.guardianEmail ?? "",
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
