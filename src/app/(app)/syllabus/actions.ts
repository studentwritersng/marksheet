"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
  preview?: { rows: CsvRow[] };
}

export interface CsvRow {
  term: string;
  week: number;
  weekSuffix: string;
  topic: string;
  subTopics: string[];
  objectives: string[];
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
  const file = String(formData.get("file") ?? "").trim() || null;
  const topicsRaw = String(formData.get("topics") ?? "").trim();

  if (!subjectId || !classLevel || !sessionId) {
    return { error: "Subject, class level, and session are required." };
  }

  const topics = topicsRaw
    ? topicsRaw.split("\n").map((t) => t.trim()).filter(Boolean)
    : [];

  const parsedTopics = topics.length > 0
    ? topics.map((t) => ({ term: term || undefined, topic: t }))
    : undefined;

  const existing = await prisma.syllabus.findUnique({
    where: { schoolId_subjectId_classLevel_sessionId: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId } },
  });

  if (existing) {
    await prisma.syllabus.update({
      where: { id: existing.id },
      data: { file, parsedTopics },
    });
  } else {
    await prisma.syllabus.create({
      data: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId, file, parsedTopics },
    });
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: existing ? "update" : "create",
    entityType: "syllabus",
    afterValue: { subjectId, classLevel, sessionId, topicCount: topics.length } as never,
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

  const parsedTopics = rows.map((r) => ({
    term: r.term || term || undefined,
    week: r.week,
    weekSuffix: r.weekSuffix || undefined,
    topic: r.topic,
    subTopics: r.subTopics || [],
    objectives: r.objectives || [],
  }));

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
  const header = "term,week,weekSuffix,topic,subTopics,objectives";
  const sample = [
    "FIRST,1,,Introduction to Numbers,\"Counting, Place values\",\"Identify numbers, Write numbers\"",
    "FIRST,2,A,Addition Basics,\"Simple addition, Word problems\",\"Solve addition problems\"",
    "SECOND,1,,Fractions,\"Proper fractions, Improper fractions\",\"Identify fraction types\"",
  ].join("\n");
  return { csv: header + "\n" + sample, filename: "syllabus-template.csv" };
}

// ── CSV Parser ──────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().trim();
  const cols = header.split(",").map((h) => h.trim());

  const termIdx = cols.indexOf("term");
  const weekIdx = cols.indexOf("week");
  const weekSuffixIdx = cols.indexOf("weeksuffix");
  const topicIdx = cols.indexOf("topic");
  const subTopicsIdx = cols.indexOf("subtopics");
  const objectivesIdx = cols.indexOf("objectives");

  if (weekIdx === -1 || topicIdx === -1) return [];

  const result: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    cols.forEach((_, ci) => { row[cols[ci]] = values[ci] ?? ""; });

    const week = parseInt(row[cols[weekIdx]], 10);
    if (isNaN(week)) continue;

    result.push({
      term: termIdx >= 0 ? row[cols[termIdx]].trim().toUpperCase() : "",
      week,
      weekSuffix: weekSuffixIdx >= 0 ? row[cols[weekSuffixIdx]].trim() : "",
      topic: row[cols[topicIdx]].trim(),
      subTopics: subTopicsIdx >= 0 ? splitList(row[cols[subTopicsIdx]]) : [],
      objectives: objectivesIdx >= 0 ? splitList(row[cols[objectivesIdx]]) : [],
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

function splitList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}
