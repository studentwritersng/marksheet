"use server";

import { generateStudentCsvTemplate } from "@/lib/csv/template";

export async function downloadStudentCsvAction(): Promise<{ csv: string; filename: string }> {
  return {
    csv: generateStudentCsvTemplate(),
    filename: "student-import-template.csv",
  };
}
