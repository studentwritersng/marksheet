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
  existing?: boolean;
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

  // Upsert syllabus record
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

  // Also create curriculum topic entries
  if (parsedTopics.length > 0 && term) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
    if (subject) {
      for (const t of parsedTopics) {
        const row = t as { week: number; weekSuffix?: string; topic: string; subTopics?: string[]; objectives?: string[] };
        const weekSuffix = row.weekSuffix ?? "";

        const existingCurriculum = await prisma.curriculumTopic.findFirst({
          where: {
            classLevel,
            term,
            subject: subject.name,
            week: row.week,
            weekSuffix,
            OR: [{ schoolId: ctx.schoolId }, { schoolId: null }],
          },
        });

        if (existingCurriculum) {
          await prisma.curriculumTopic.update({
            where: { id: existingCurriculum.id },
            data: {
              topic: row.topic,
              subTopics: row.subTopics ?? [],
              behaviouralObjectives: row.objectives ?? [],
              isSystem: false,
              schoolId: ctx.schoolId,
            },
          });
        } else {
          await prisma.curriculumTopic.create({
            data: {
              classLevel,
              term,
              subject: subject.name,
              week: row.week,
              weekSuffix,
              topic: row.topic,
              subTopics: row.subTopics ?? [],
              behaviouralObjectives: row.objectives ?? [],
              isSystem: false,
              schoolId: ctx.schoolId,
            },
          });
        }
      }
    }
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: existing ? "update" : "create",
    entityType: "syllabus",
    afterValue: { subjectId, classLevel, sessionId, topicCount: parsedTopics.length } as never,
  });

  revalidatePath("/syllabus");
  revalidatePath("/curriculum");
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

export async function deleteSyllabusBulkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const sessionId = String(formData.get("sessionId") ?? "");
  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "");

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (sessionId) where.sessionId = sessionId;
  if (classLevel) where.classLevel = classLevel;
  if (subjectId) where.subjectId = subjectId;

  if (!sessionId && !classLevel && !subjectId) {
    return { error: "Select at least one filter." };
  }

  const count = await prisma.syllabus.count({ where: where as any });
  if (count === 0) return { error: "No matching syllabi found." };

  await prisma.syllabus.deleteMany({ where: where as any });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "bulk_delete", entityType: "syllabus",
    afterValue: { filter: { sessionId, classLevel, subjectId }, count } as never,
  });

  revalidatePath("/syllabus");
  return { success: `${count} syllabus record(s) deleted.` };
}

export async function deleteCurriculumBulkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }
  try { await guardActiveLicense(ctx.schoolId); } catch (e: any) { return { error: e.message }; }

  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const term = String(formData.get("term") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();

  const where: Record<string, unknown> = { schoolId: ctx.schoolId };
  if (classLevel) where.classLevel = classLevel;
  if (term) where.term = term;
  if (subject) where.subject = subject;

  if (!classLevel && !term && !subject) {
    return { error: "Select at least one filter." };
  }

  const count = await prisma.curriculumTopic.count({ where: where as any });
  if (count === 0) return { error: "No matching curriculum entries found." };

  await prisma.curriculumTopic.deleteMany({ where: where as any });

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: "bulk_delete", entityType: "curriculum_topic",
    afterValue: { filter: { classLevel, term, subject }, count } as never,
  });

  revalidatePath("/curriculum");
  return { success: `${count} curriculum topic(s) deleted.` };
}

// ── Get syllabi by class (for the filterable list) ────────────────────────

export async function getSyllabiByClassAction(
  classLevel: string,
  schoolId: string,
): Promise<{ id: string; subjectId: string; subjectName: string; sessionLabel: string; createdAt: Date; parsedTopics: Record<string, unknown>[] | null }[]> {
  const [syllabi, sessions] = await Promise.all([
    prisma.syllabus.findMany({
      where: { schoolId, classLevel },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.findMany({ where: { schoolId }, select: { id: true, label: true } }),
  ]);
  const sessionMap = Object.fromEntries(sessions.map((s) => [s.id, s.label]));
  return syllabi.map((s) => ({
    id: s.id,
    subjectId: s.subjectId,
    subjectName: s.subject.name,
    sessionLabel: sessionMap[s.sessionId] ?? s.sessionId,
    createdAt: s.createdAt,
    parsedTopics: s.parsedTopics as Record<string, unknown>[] | null,
  }));
}

// ── Check if syllabus exists for the CSV target ──────────────────────────

export async function checkSyllabusExistsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try { ctx = await requireSchoolAdmin(); } catch { return { error: "Not authorised." }; }

  const subjectId = String(formData.get("subjectId") ?? "");
  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "");

  if (!subjectId || !classLevel || !sessionId) return { existing: false };

  const existing = await prisma.syllabus.findUnique({
    where: { schoolId_subjectId_classLevel_sessionId: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId } },
  });

  return { existing: !!existing };
}

// ── CSV Preview ──────────────────────────────────────────────────────────

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

  // Check if existing syllabus will be overridden
  const subjectId = String(formData.get("subjectId") ?? "");
  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "");

  let existing = false;
  if (subjectId && classLevel && sessionId) {
    const s = await prisma.syllabus.findUnique({
      where: { schoolId_subjectId_classLevel_sessionId: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId } },
    });
    existing = !!s;
  }

  // Also check curriculum
  if (!existing && subjectId && classLevel) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
    if (subject) {
      const term = String(formData.get("term") ?? "").trim();
      if (term) {
        const c = await prisma.curriculumTopic.findFirst({
          where: { OR: [{ schoolId: ctx.schoolId }, { schoolId: null }], classLevel, term, subject: subject.name },
        });
        existing = !!c;
      }
    }
  }

  return { preview: { rows }, existing };
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

  // Look up subject name for curriculum entries
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
  const subjectName = subject?.name ?? "";

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

  // Upsert syllabus record
  const existingSyllabus = await prisma.syllabus.findUnique({
    where: { schoolId_subjectId_classLevel_sessionId: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId } },
  });

  if (existingSyllabus) {
    await prisma.syllabus.update({
      where: { id: existingSyllabus.id },
      data: { parsedTopics },
    });
  } else {
    await prisma.syllabus.create({
      data: { schoolId: ctx.schoolId, subjectId, classLevel, sessionId, parsedTopics },
    });
  }

  // Also create curriculum topic entries for each row
  if (subjectName) {
    for (const r of rows) {
      const { week, weekSuffix } = parseSubweek(r.subweek);
      const rowTerm = r.term || term;
      if (!rowTerm) continue;

      // Try to find existing curriculum record — either owned by this school
      // or a NERDC system default (schoolId = null)
      const existingCurriculum = await prisma.curriculumTopic.findFirst({
        where: {
          classLevel,
          term: rowTerm,
          subject: subjectName,
          week,
          weekSuffix,
          OR: [{ schoolId: ctx.schoolId }, { schoolId: null }],
        },
      });

      if (existingCurriculum) {
        await prisma.curriculumTopic.update({
          where: { id: existingCurriculum.id },
          data: {
            topic: r.topic,
            subTopics: r.subTopics,
            behaviouralObjectives: r.objectives,
            isSystem: false,
            schoolId: ctx.schoolId, // adopt the record for this school
          },
        });
      } else {
        await prisma.curriculumTopic.create({
          data: {
            classLevel,
            term: rowTerm,
            subject: subjectName,
            week,
            weekSuffix,
            topic: r.topic,
            subTopics: r.subTopics,
            behaviouralObjectives: r.objectives,
            isSystem: false,
            schoolId: ctx.schoolId,
          },
        });
      }
    }
  }

  await recordAudit({
    schoolId: ctx.schoolId, actorId: ctx.user.userId,
    action: existingSyllabus ? "update" : "create",
    entityType: "syllabus",
    afterValue: { subjectId, classLevel, sessionId, topicCount: parsedTopics.length } as never,
  });

  revalidatePath("/syllabus");
  revalidatePath("/curriculum");
  return { success: `Syllabus imported with ${parsedTopics.length} topics.` };
}

export async function downloadSyllabusCsvTemplateAction(): Promise<{ csv: string; filename: string }> {
  const csv = readFileSync(join(process.cwd(), "..", "syllabus_template.csv"), "utf-8");
  return { csv, filename: "syllabus-template.csv" };
}

// ── CSV Parser ──────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^\ufeff/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().trim();
  const cols = header.split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));

  const termIdx = cols.indexOf("term");
  const weekIdx = cols.indexOf("week");
  const weekSuffixIdx = cols.indexOf("weeksuffix");
  const subweekIdx = cols.indexOf("subweek");
  const topicIdx = cols.indexOf("topic");
  const subTopicsIdx = cols.indexOf("subtopics");
  const objectivesIdx = cols.indexOf("objectives");

  if ((subweekIdx === -1 && weekIdx === -1) || topicIdx === -1) return [];

  const result: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    cols.forEach((_, ci) => { row[cols[ci]] = values[ci] ?? ""; });

    let week = 0, weekSuffix = "", subweek = "";

    if (subweekIdx >= 0) {
      const raw = row[cols[subweekIdx]].trim();
      const p = parseSubweek(raw);
      week = p.week; weekSuffix = p.weekSuffix; subweek = p.subweek;
    } else {
      week = parseInt(row[cols[weekIdx]]?.trim(), 10);
      weekSuffix = weekSuffixIdx >= 0 ? row[cols[weekSuffixIdx]]?.trim() ?? "" : "";
      subweek = weekSuffix ? `${week}.${weekSuffix}` : String(week);
    }

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
