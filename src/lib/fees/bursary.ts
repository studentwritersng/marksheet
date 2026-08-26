export type FeeStatus = "cleared" | "partial" | "not_paid";

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
