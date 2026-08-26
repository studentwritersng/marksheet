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
