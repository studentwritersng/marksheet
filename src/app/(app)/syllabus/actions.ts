"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

export interface ActionState {
  error?: string;
  success?: string;
  preview?: { rows: CsvRow[] };
}

export interface CsvRow {
  term: string;
  subweek: string;
  week: number;
  weekSuffix: string;
  topic: string;
  subTopics: string[];
  objectives: string[];
}

function parseSubweek(val: string): { week: number; weekSuffix: string; subweek: string } {
  const s = val.trim();
  if (!s) return { week: 0, weekSuffix: "", subweek: "" };
  const parts = s.split(".");
  const week = parseInt(parts[0], 10);
  if (isNaN(week)) return { week: 0, weekSuffix: "", subweek: s };
  return { week, weekSuffix: parts[1] ?? "", subweek: s };
}

export async function createSyllabusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "");
  const term = String(formData.get("term") ?? "").trim();

  if (!subjectId || !classLevel || !sessionId) {
    return { error: "Subject, class level, and session are required." };
  }

  const topicRowsRaw = String(formData.get("topicRows") ?? "");
  let parsedTopics: Prisma.InputJsonValue[] = [];

  if (topicRowsRaw) {
    try {
      const rows: { subweek: string; topic: string; subTopics: string; objectives: string }[] = JSON.parse(topicRowsRaw);
      parsedTopics = rows
        .filter((r) => r.topic.trim())
        .map((r) => {
          const { week, weekSuffix, subweek } = parseSubweek(r.subweek);
          return {
            term: term || undefined,
            subweek,
            week,
            weekSuffix: weekSuffix || undefined,
            topic: r.topic.trim(),
            subTopics: r.subTopics ? splitSemicolon(r.subTopics) : [],
            objectives: r.objectives ? splitSemicolon(r.objectives) : [],
          } as Prisma.InputJsonValue;
        });
    } catch {
      return { error: "Invalid topic entries." };
    }
  }

  const existing = await prisma.syllabus.findUnique({
    where: { schoolId_subjectId_classLevel_sessionId: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId } },
  });

  if (existing) {
    await prisma.syllabus.update({
      where: { id: existing.id },
      data: { parsedTopics: parsedTopics.length > 0 ? parsedTopics : undefined },
    });
  } else {
    await prisma.syllabus.create({
      data: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId, parsedTopics: parsedTopics.length > 0 ? parsedTopics : undefined },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: existing ? "update" : "create",
    entityType: "syllabus",
    afterValue: { subjectId, classLevel, sessionId, topicCount: parsedTopics.length } as never,
  });

  revalidatePath("/syllabus");
  return { success: existing ? "Syllabus updated." : "Syllabus uploaded." };
}

export async function deleteSyllabusAction(syllabusId: string): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const s = await prisma.syllabus.findFirst({ where: { id: syllabusId, schoolId: ctx.schoolId } });
  if (!s) return { error: "Not found." };

  await prisma.syllabus.delete({ where: { id: syllabusId } });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "delete", entityType: "syllabus",
    beforeValue: { subjectId: s.subjectId, classLevel: s.classLevel } as never,
  });

  revalidatePath("/syllabus");
  return { success: "Syllabus deleted." };
}

export async function previewSyllabusCsvAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return { error: "No file uploaded." };

  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) return { error: "CSV is empty or has no data rows." };

  return { preview: { rows } };
}

export async function commitSyllabusCsvAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "");
  const term = String(formData.get("term") ?? "").trim();

  if (!subjectId || !classLevel || !sessionId) {
    return { error: "Subject, class level, and session are required." };
  }

  const rowsRaw = String(formData.get("rows") ?? "");
  let rows: CsvRow[];
  try { rows = JSON.parse(rowsRaw); } catch { return { error: "Invalid rows data." }; }

  if (!Array.isArray(rows) || rows.length === 0) return { error: "No rows to import." };

  const parsedTopics: Prisma.InputJsonValue[] = rows.map((r) => {
    const { week, weekSuffix, subweek } = parseSubweek(r.subweek);
    return {
      term: r.term || term || undefined,
      subweek,
      week,
      weekSuffix: weekSuffix || undefined,
      topic: r.topic,
      subTopics: r.subTopics || [],
      objectives: r.objectives || [],
    } as Prisma.InputJsonValue;
  });

  const existing = await prisma.syllabus.findUnique({
    where: { schoolId_subjectId_classLevel_sessionId: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId } },
  });

  if (existing) {
    await prisma.syllabus.update({
      where: { id: existing.id },
      data: { parsedTopics },
    });
  } else {
    await prisma.syllabus.create({
      data: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId, parsedTopics },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: existing ? "update" : "create",
    entityType: "syllabus",
    afterValue: { subjectId, classLevel, sessionId, topicCount: parsedTopics.length } as never,
  });

  revalidatePath("/syllabus");
  return { success: `Syllabus imported with ${parsedTopics.length} topics.` };
}

export async function downloadSyllabusCsvTemplateAction(): Promise<{ csv: string; filename: string }> {
  const csv = readFileSync(join(process.cwd(), "..", "syllabus_template.csv"), "utf-8");
  return { csv, filename: "syllabus-template.csv" };
}

// ── CSV Parser ──────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().trim();
  const cols = header.split(",").map((h) => h.trim());

  const termIdx = cols.indexOf("term");
  const subweekIdx = cols.indexOf("subweek");
  const topicIdx = cols.indexOf("topic");
  const subTopicsIdx = cols.indexOf("subtopics");
  const objectivesIdx = cols.indexOf("objectives");

  if (subweekIdx === -1 || topicIdx === -1) return [];

  const result: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    cols.forEach((_, ci) => { row[cols[ci]] = values[ci] ?? ""; });

    const subweekRaw = row[cols[subweekIdx]].trim();
    const { week, weekSuffix, subweek } = parseSubweek(subweekRaw);
    if (week === 0 && !subweek) continue;

    result.push({
      term: termIdx >= 0 ? row[cols[termIdx]].trim().toUpperCase() : "",
      subweek,
      week,
      weekSuffix,
      topic: row[cols[topicIdx]].trim(),
      subTopics: subTopicsIdx >= 0 ? splitSemicolon(row[cols[subTopicsIdx]]) : [],
      objectives: objectivesIdx >= 0 ? splitSemicolon(row[cols[objectivesIdx]]) : [],
    });
  }

  return result;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function splitSemicolon(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(";")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}
