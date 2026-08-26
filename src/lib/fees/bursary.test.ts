import { describe, it, expect } from "vitest";
import { deriveFeeStatus, buildFeeReminderContent } from "./bursary";

describe("deriveFeeStatus", () => {
  it("cleared when fully paid", () => {
    expect(deriveFeeStatus(50000, 50000)).toBe("cleared");
    expect(deriveFeeStatus(50000, 60000)).toBe("cleared"); // overpaid
  });
  it("partial when some paid", () => {
    expect(deriveFeeStatus(50000, 20000)).toBe("partial");
  });
  it("not_paid when nothing paid", () => {
    expect(deriveFeeStatus(50000, 0)).toBe("not_paid");
  });
});

describe("buildFeeReminderContent", () => {
  it("groups multiple wards into one message", () => {
    const out = buildFeeReminderContent([
      { name: "Ada", className: "JSS1A", expected: 50000, paid: 20000, balance: 30000 },
      { name: "Ben", className: "JSS2B", expected: 60000, paid: 60000, balance: 0 },
    ]);
    expect(out).toContain("Ada (JSS1A): Total ₦50,000 · Paid ₦20,000 · Balance ₦30,000");
    expect(out).toContain("Ben (JSS2B): Total ₦60,000 · Paid ₦60,000 · Balance ₦0");
  });
});
