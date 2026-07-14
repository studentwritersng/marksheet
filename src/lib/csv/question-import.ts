import Papa from "papaparse";
import { z } from "zod";

export interface StagedQuestionRow {
  row: number;
  type: "mcq" | "essay";
  text: string;
  marks: number;
  difficulty: string | null;
  topic: string | null;
  classLevel: string | null;
  // MCQ-specific
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  // Essay-specific
  modelAnswer?: string;
  rubricPoints?: string;
  // Group
  groupTitle?: string;
  stimulusType?: string;
  stimulusContent?: string;
  errors: string[];
  valid: boolean;
}

const mcqSchema = z.object({
  type: z.literal("mcq"),
  text: z.string().min(1, "Question text is required"),
  marks: z.coerce.number().min(0.5, "Marks must be at least 0.5"),
  difficulty: z.string().optional().default(""),
  topic: z.string().optional().default(""),
  classLevel: z.string().optional().default(""),
  optionA: z.string().min(1, "Option A is required"),
  optionB: z.string().min(1, "Option B is required"),
  optionC: z.string().optional().default(""),
  optionD: z.string().optional().default(""),
  correctAnswer: z.string().min(1, "Correct answer is required").toUpperCase(),
  groupTitle: z.string().optional().default(""),
  stimulusType: z.string().optional().default(""),
  stimulusContent: z.string().optional().default(""),
});

const essaySchema = z.object({
  type: z.literal("essay"),
  text: z.string().min(1, "Question text is required"),
  marks: z.coerce.number().min(0.5, "Marks must be at least 0.5"),
  difficulty: z.string().optional().default(""),
  topic: z.string().optional().default(""),
  classLevel: z.string().optional().default(""),
  modelAnswer: z.string().min(1, "Model answer is required for essay"),
  rubricPoints: z.string().optional().default(""),
  groupTitle: z.string().optional().default(""),
  stimulusType: z.string().optional().default(""),
  stimulusContent: z.string().optional().default(""),
});

export function parseQuestionCsv(csvContent: string): {
  rows: StagedQuestionRow[];
  summary: { total: number; valid: number; invalid: number };
} {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transform: (val) => val.trim(),
  });

  const rows: StagedQuestionRow[] = parsed.data
    .filter((r) => r.text)
    .map((raw, i) => {
      const rowNum = i + 2; // 1-indexed + header
      const type = raw.type?.trim().toLowerCase() as "mcq" | "essay" | undefined;
      const errors: string[] = [];

      if (!type || !["mcq", "essay"].includes(type)) {
        errors.push("Type must be 'mcq' or 'essay'");
      }

      if (type === "mcq") {
        const result = mcqSchema.safeParse(raw);
        if (!result.success) {
          result.error.issues.forEach((iss) => errors.push(iss.message));
        }
        return {
          row: rowNum,
          type: "mcq",
          text: raw.text || "",
          marks: Number(raw.marks) || 1,
          difficulty: raw.difficulty || null,
          topic: raw.topic || null,
          classLevel: raw.classLevel || null,
          optionA: raw.optionA,
          optionB: raw.optionB,
          optionC: raw.optionC,
          optionD: raw.optionD,
          correctAnswer: (raw.correctAnswer || "").toUpperCase(),
          groupTitle: raw.groupTitle || undefined,
          stimulusType: raw.stimulusType || undefined,
          stimulusContent: raw.stimulusContent || undefined,
          errors,
          valid: errors.length === 0,
        };
      }

      const result = essaySchema.safeParse(raw);
      if (!result.success) {
        result.error.issues.forEach((iss) => errors.push(iss.message));
      }
      return {
        row: rowNum,
        type: "essay",
        text: raw.text || "",
        marks: Number(raw.marks) || 1,
        difficulty: raw.difficulty || null,
        topic: raw.topic || null,
        classLevel: raw.classLevel || null,
        modelAnswer: raw.modelAnswer || "",
        rubricPoints: raw.rubricPoints,
        groupTitle: raw.groupTitle || undefined,
        stimulusType: raw.stimulusType || undefined,
        stimulusContent: raw.stimulusContent || undefined,
        errors,
        valid: errors.length === 0,
      };
    });

  const valid = rows.filter((r) => r.valid);
  return {
    rows,
    summary: { total: rows.length, valid: valid.length, invalid: rows.length - valid.length },
  };
}
