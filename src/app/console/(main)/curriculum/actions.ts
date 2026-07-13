"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createCompletion } from "@/lib/ai/gateway";
import { revalidatePath } from "next/cache";
import { NERDC_SUBJECTS } from "@/lib/nerdc-subjects";

const CLASS_LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"] as const;

export async function getSubjectsByClass(): Promise<Record<string, string[]>> {
  return NERDC_SUBJECTS;
}

async function guardOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("FORBIDDEN");
  return user;
}

export interface ParseResult {
  week: number;
  topic: string;
  subTopics: string[];
  behaviouralObjectives: string[];
}

export interface ActionState {
  error?: string;
  success?: string;
  parsed?: ParseResult[];
}

export async function parseCurriculumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try { await guardOwner(); } catch { return { error: "Not authorised." }; }

  const classLevel = formData.get("classLevel") as string;
  const term = formData.get("term") as string;
  const subject = formData.get("subject") as string;

  if (!classLevel || !term || !subject) {
    return { error: "Class, term, and subject are required." };
  }

  // Read the nerdc content from the database
  const dbRow = await prisma.nerdcContent.findFirst({ orderBy: { createdAt: "desc" } });
  if (!dbRow) {
    return { error: "No NERDC syllabus uploaded. Go to Console > Upload NERDC first." };
  }
  const nerdcContent = dbRow.content;

  const clMap: Record<string, string> = {
    JSS1: "JUNIOR SECONDARY ONE", JSS2: "JUNIOR SECONDARY TWO", JSS3: "JUNIOR SECONDARY THREE",
    SSS1: "SENIOR SECONDARY ONE", SSS2: "SENIOR SECONDARY TWO", SSS3: "SENIOR SECONDARY THREE",
  };
  const classLabel = clMap[classLevel] ?? classLevel;

  const prompt = `You are a curriculum parser. Extract the syllabus for ${subject} — ${classLabel} — ${term.toUpperCase()} TERM from the NERDC markdown below.

The markdown file contains multiple subjects and classes. Find only the section matching:
- Class: ${classLabel} (or "JSS1" etc.)
- Subject: ${subject}
- Term: ${term.toUpperCase()} TERM

Rules:
1. For English Studies / Literature: each week has 5 columns (Speech Work, Grammar, Reading & Comprehension, Composition, Literature). Split each into a SEPARATE entry with week number, e.g. week 1 becomes 5 entries: "Week 1 – Speech Work: ...", "Week 1 – Grammar: ..." etc.
2. For other subjects: one entry per week row.
3. For week ranges like "11–13" or "11-13", create one entry with week=11 and note the range in topic.
4. Extract topic from the first content column, and subTopics as an array of detailed bullet points.
5. GENERATE behavioural objectives for EVERY entry (array of 3-4 sentences starting with "By the end of the lesson, students should be able to...").
6. Return ONLY valid JSON array — no markdown fences, no explanation. Each object: { week: number, topic: string, subTopics: string[], behaviouralObjectives: string[] }

NERDC CONTENT:
${nerdcContent.slice(0, 25000)}`;

  try {
    const result = await createCompletion({
      taskType: "curriculum_parsing",
      messages: [
        { role: "system", content: "You are a precise curriculum data parser. Return only valid JSON arrays." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 8000,
    });

    let raw = result.content.trim();

    // Strategy 1: try direct JSON parse
    let json: ParseResult[];
    try {
      json = JSON.parse(raw) as ParseResult[];
    } catch {
      // Strategy 2: extract from markdown code fences
      const fenceMatch = raw.match(/```(?:json)?\s*\r?\n?([\s\S]*?)```/);
      if (fenceMatch) {
        raw = fenceMatch[1].trim();
        json = JSON.parse(raw) as ParseResult[];
      } else {
        // Strategy 3: extract everything between the first [ and last ]
        const bracketStart = raw.indexOf('[');
        const bracketEnd = raw.lastIndexOf(']');
        if (bracketStart !== -1 && bracketEnd > bracketStart) {
          raw = raw.slice(bracketStart, bracketEnd + 1);
          json = JSON.parse(raw) as ParseResult[];
        } else {
          throw new Error("No JSON array found in AI response");
        }
      }
    }

    if (!Array.isArray(json) || json.length === 0) {
      return { error: "AI returned empty or invalid data. Try again." };
    }

    return { success: `Parsed ${json.length} entries. Review and save.`, parsed: json };
  } catch (e: any) {
    return { error: `Parse failed: ${e.message}` };
  }
}

export async function saveCurriculumAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try { await guardOwner(); } catch { return { error: "Not authorised." }; }

  const raw = formData.get("entries") as string;
  if (!raw) return { error: "No entries to save." };

  let entries: ParseResult[];
  try { entries = JSON.parse(raw); } catch { return { error: "Invalid entries JSON." }; }

  const classLevel = formData.get("classLevel") as string;
  const term = formData.get("term") as string;
  const subject = formData.get("subject") as string;

  // Delete existing system entries for this combo, then re-insert
  await prisma.curriculumTopic.deleteMany({
    where: { classLevel, term, subject, schoolId: null, isSystem: true },
  });

  await prisma.curriculumTopic.createMany({
    data: entries.map((e) => ({
      classLevel, term, subject, week: e.week,
      topic: e.topic,
      subTopics: e.subTopics,
      behaviouralObjectives: e.behaviouralObjectives,
      isSystem: true,
      schoolId: null,
    })),
  });

  revalidatePath("/console/curriculum");
  return { success: `${entries.length} curriculum entries saved for ${classLevel} ${subject} ${term}.` };
}

// ---------------------------------------------------------------------------
// Manual CRUD — for adding/editing/deleting system curriculum entries manually
// ---------------------------------------------------------------------------

export interface CrudState { error?: string; success?: string }

export async function createCurriculumEntryAction(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  try { await guardOwner(); } catch { return { error: "Not authorised." }; }

  const classLevel = (formData.get("classLevel") as string)?.trim();
  const term = (formData.get("term") as string)?.trim();
  const subject = (formData.get("subject") as string)?.trim();
  const week = parseInt(formData.get("week") as string);
  const topic = (formData.get("topic") as string)?.trim();
  const subTopics = ((formData.get("subTopics") as string) || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const objectives = ((formData.get("behaviouralObjectives") as string) || "").split("\n").map((s) => s.trim()).filter(Boolean);

  if (!classLevel || !term || !subject || !week || !topic) {
    return { error: "Class, term, subject, week, and topic are required." };
  }

  await prisma.curriculumTopic.create({
    data: { classLevel, term, subject, week, topic, subTopics, behaviouralObjectives: objectives, isSystem: true, schoolId: null },
  }).catch(() => {
    // If unique constraint failed (same class/term/subject/week), update instead
    return prisma.curriculumTopic.updateMany({
      where: { classLevel, term, subject, week, schoolId: null, isSystem: true },
      data: { topic, subTopics, behaviouralObjectives: objectives },
    });
  });

  revalidatePath("/console/curriculum");
  return { success: `"${topic}" added.` };
}

export async function updateCurriculumEntryAction(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  try { await guardOwner(); } catch { return { error: "Not authorised." }; }

  const id = formData.get("id") as string;
  const topic = (formData.get("topic") as string)?.trim();
  const subTopics = ((formData.get("subTopics") as string) || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const objectives = ((formData.get("behaviouralObjectives") as string) || "").split("\n").map((s) => s.trim()).filter(Boolean);

  if (!id || !topic) return { error: "ID and topic are required." };

  await prisma.curriculumTopic.update({
    where: { id },
    data: { topic, subTopics, behaviouralObjectives: objectives },
  });

  revalidatePath("/console/curriculum");
  return { success: "Entry updated." };
}

export async function deleteCurriculumEntryAction(id: string): Promise<CrudState> {
  try { await guardOwner(); } catch { return { error: "Not authorised." }; }
  await prisma.curriculumTopic.delete({ where: { id } });
  revalidatePath("/console/curriculum");
  return { success: "Entry deleted." };
}

export interface EntryVM {
  id: string; classLevel: string; term: string; subject: string;
  week: number; topic: string; subTopics: string[]; behaviouralObjectives: string[];
}

export async function getSystemEntries(
  classLevel: string, term: string, subject: string,
): Promise<EntryVM[]> {
  const rows = await prisma.curriculumTopic.findMany({
    where: { classLevel, term, subject, schoolId: null, isSystem: true },
    orderBy: { week: "asc" },
  });
  return rows.map((r) => ({
    id: r.id, classLevel: r.classLevel, term: r.term, subject: r.subject,
    week: r.week, topic: r.topic,
    subTopics: (r.subTopics as string[]) ?? [],
    behaviouralObjectives: (r.behaviouralObjectives as string[]) ?? [],
  }));
}
