import { prisma } from "@/lib/prisma";

export type FeeStatus = "cleared" | "partial" | "not_paid";

export interface StudentFeeSummary {
  expected: number;
  paid: number;
  balance: number;
  overpaid: number;
  status: "cleared" | "partial" | "not_paid" | "no_structure";
  hasStructure: boolean;
}

function toNumber(d: { toNumber(): number } | number): number {
  return typeof d === "number" ? d : d.toNumber();
}

export async function getStudentFeeSummary(studentId: string, termId: string): Promise<StudentFeeSummary> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { currentClass: { select: { level: true } } },
  });
  const level = student?.currentClass?.level ?? null;

  const items = level
    ? await prisma.feeItem.findMany({ where: { termId, level } })
    : [];
  const paidAgg = await prisma.studentPayment.aggregate({
    where: { studentId, termId },
    _sum: { amount: true },
  });

  const expected = items.reduce((s, i) => s + toNumber(i.amount), 0);
  const paid = toNumber(paidAgg._sum.amount ?? 0);
  const hasStructure = items.length > 0;
  const status: StudentFeeSummary["status"] = hasStructure
    ? deriveFeeStatus(expected, paid)
    : "no_structure";

  return {
    expected,
    paid,
    balance: Math.max(0, expected - paid),
    overpaid: Math.max(0, paid - expected),
    status,
    hasStructure,
  };
}

export async function getStudentFeeSummaryBatch(schoolId: string, termId: string): Promise<Map<string, StudentFeeSummary>> {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, currentClass: { select: { level: true } } },
  });
  const [items, payments] = await Promise.all([
    prisma.feeItem.findMany({ where: { termId } }),
    prisma.studentPayment.findMany({ where: { termId } }),
  ]);
  const byLevel = new Map<string, number>();
  for (const it of items) {
    byLevel.set(it.level, (byLevel.get(it.level) ?? 0) + toNumber(it.amount));
  }
  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) ?? 0) + toNumber(p.amount));
  }
  const map = new Map<string, StudentFeeSummary>();
  for (const s of students) {
    const level = s.currentClass?.level ?? null;
    const expected = level ? (byLevel.get(level) ?? 0) : 0;
    const paid = paidByStudent.get(s.id) ?? 0;
    const hasStructure = !!level && (byLevel.get(level) ?? 0) > 0;
    map.set(s.id, {
      expected,
      paid,
      balance: Math.max(0, expected - paid),
      overpaid: Math.max(0, paid - expected),
      status: hasStructure ? deriveFeeStatus(expected, paid) : "no_structure",
      hasStructure,
    });
  }
  return map;
}

export function deriveFeeStatus(expected: number, paid: number): FeeStatus {
  if (expected > 0 && paid >= expected) return "cleared";
  if (paid > 0 && paid < expected) return "partial";
  return "not_paid";
}

export interface WardLine {
  name: string;
  className: string;
  expected: number;
  paid: number;
  balance: number;
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function buildFeeReminderContent(wards: WardLine[]): string {
  const lines = wards.map(
    (w) => `${w.name} (${w.className}): Total ${naira(w.expected)} · Paid ${naira(w.paid)} · Balance ${naira(w.balance)}`,
  );
  return `Fee reminder for your ward(s):\n${lines.join("\n")}`;
}

/** Context for rendering a fee reminder template with variables */
export interface FeeReminderTemplateContext {
  guardianName?: string;
  wards: WardLine[];
  schoolName?: string;
  termName?: string;
  sessionLabel?: string;
  date?: string;
  time?: string;
}

/** Default template used when no custom messageTemplate is stored */
export const DEFAULT_FEE_REMINDER_TEMPLATE =
  "Dear {{guardian_name}},\n\nThis is a friendly fee reminder from {{school_name}} for {{term}} ({{session}}) as of {{date}}.\n\n{{ward_list}}\n\nPlease settle the outstanding balance at your earliest convenience. For enquiries, contact the bursary.\n\nThank you.";

export function buildWardList(wards: WardLine[]): string {
  return wards
    .map((w) => `${w.name} (${w.className}): Total ${naira(w.expected)} · Paid ${naira(w.paid)} · Balance ${naira(w.balance)}`)
    .join("\n");
}

/**
 * Render a fee reminder template with ward + guardian variables.
 * If template is falsy, falls back to buildFeeReminderContent.
 */
export function buildFeeReminderContentFromTemplate(
  template: string | null | undefined,
  ctx: FeeReminderTemplateContext,
): string {
  if (!template || !template.trim()) {
    return buildFeeReminderContent(ctx.wards);
  }
  // lazy import to avoid circular deps; inline simple renderer to keep bursary.ts standalone
  const vars: Record<string, string> = {};
  const first = ctx.wards[0];
  const totalBalance = ctx.wards.reduce((s, w) => s + w.balance, 0);
  const d = ctx.date ?? new Date().toLocaleDateString("en-NG");
  const t = ctx.time ?? new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  vars.guardian_name = ctx.guardianName ?? "Guardian";
  vars.parent_name = vars.guardian_name;
  vars.student_name = first?.name ?? "";
  vars.class = first?.className ?? "";
  vars.balance = first ? naira(first.balance) : "";
  vars.expected = first ? naira(first.expected) : "";
  vars.paid = first ? naira(first.paid) : "";
  vars.total_balance = naira(totalBalance);
  vars.ward_list = buildWardList(ctx.wards);
  vars.term = ctx.termName ?? "";
  vars.session = ctx.sessionLabel ?? "";
  vars.school_name = ctx.schoolName ?? "";
  vars.date = d;
  vars.time = t;
  vars.datetime = `${d} ${t}`;

  return template.replace(/{{\s*(\w+)\s*}}/g, (_, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const aliases: Record<string, string> = { parent_name: "guardian_name", class_name: "class" };
    const canonical = aliases[key] ?? key;
    const val = vars[canonical] ?? vars[key];
    if (val === undefined) {
      // unknown variable: keep placeholder visible
      return `{{${rawKey}}}`;
    }
    return String(val);
  });
}
