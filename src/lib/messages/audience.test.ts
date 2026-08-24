// src/lib/messages/audience.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindMany = vi.fn();
const mockStudentFindMany = vi.fn();
const mockGuardianFindMany = vi.fn();
const mockFeeStatusFindMany = vi.fn();
const mockTermFindFirst = vi.fn();
const mockStaffFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    student: { findMany: (...a: unknown[]) => mockStudentFindMany(...a) },
    guardian: { findMany: (...a: unknown[]) => mockGuardianFindMany(...a) },
    feeStatus: { findMany: (...a: unknown[]) => mockFeeStatusFindMany(...a) },
    term: { findFirst: (...a: unknown[]) => mockTermFindFirst(...a) },
    staff: { findMany: (...a: unknown[]) => mockStaffFindMany(...a) },
  },
}));

import { resolveAudienceUserIds, countAudience, BULK_SEND_CAP, searchDirectory } from "./audience";

beforeEach(() => {
  [mockUserFindMany, mockStudentFindMany, mockGuardianFindMany, mockFeeStatusFindMany, mockTermFindFirst, mockStaffFindMany].forEach((m) => m.mockReset());
});

describe("teachers audience", () => {
  it("returns staff ids excluding the sender", async () => {
    mockUserFindMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "teachers" }, "u1");
    expect(ids).toEqual(["u2"]);
  });
  it("never applies class filter", async () => {
    mockUserFindMany.mockResolvedValue([]);
    await resolveAudienceUserIds("s1", { audienceType: "teachers", classId: "c9" });
    expect(mockUserFindMany.mock.calls[0][0].where.role).toBe("staff");
    expect(mockUserFindMany.mock.calls[0][0].where.currentClassId).toBeUndefined();
  });
});

describe("students audience", () => {
  it("skips no-login students and the sender; applies class filter", async () => {
    mockStudentFindMany.mockResolvedValue([{ userId: "u5" }, { userId: "u1" }, { userId: null }]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "students", classId: "c1" }, "u1");
    expect(ids).toEqual(["u5"]);
    const where = mockStudentFindMany.mock.calls[0][0].where;
    expect(where.currentClassId).toBe("c1");
    expect(where.userId).toEqual({ not: null });
  });
});

describe("parents audience", () => {
  it("dedupes guardians sharing one parent user; excludes sender", async () => {
    mockGuardianFindMany.mockResolvedValue([{ parentUserId: "p1" }, { parentUserId: "p1" }, { parentUserId: "p2" }]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "parents" }, "p2");
    expect(ids).toEqual(["p1"]);
    const where = mockGuardianFindMany.mock.calls[0][0].where;
    expect(where.parentUserId).toEqual({ not: null });
    expect(where.student.schoolId).toBe("s1");
  });
  it("applies class filter through the ward student", async () => {
    mockGuardianFindMany.mockResolvedValue([]);
    await resolveAudienceUserIds("s1", { audienceType: "parents", classId: "c3" });
    expect(mockGuardianFindMany.mock.calls[0][0].where.student.currentClassId).toBe("c3");
  });
});

describe("countAudience / cap", () => {
  it("equals resolved list length", async () => {
    mockUserFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "b" }]);
    expect(await countAudience("s1", { audienceType: "teachers" })).toBe(3);
  });
  it("BULK_SEND_CAP is 1000 per spec", () => {
    expect(BULK_SEND_CAP).toBe(1000);
  });
});

describe("parents_by_fee audience", () => {
  it("only includes students with an actual not_cleared fee row and dedupes parents", async () => {
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    mockStudentFindMany.mockResolvedValue([{ id: "st1" }, { id: "st2" }]);
    mockFeeStatusFindMany.mockResolvedValue([{ studentId: "st1" }]);
    mockGuardianFindMany.mockResolvedValue([{ parentUserId: "p1" }, { parentUserId: "p1" }, { parentUserId: "p2" }]);

    const ids = await resolveAudienceUserIds(
      "s1",
      { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"] },
      "p2",
    );
    expect(ids).toEqual(["p1"]);
    expect(mockStudentFindMany.mock.calls[0][0].where).toEqual({ schoolId: "s1" });
    expect(mockFeeStatusFindMany.mock.calls[0][0].where.studentId).toEqual({ in: ["st1", "st2"] });
    expect(mockGuardianFindMany.mock.calls[0][0].where.studentId).toEqual({ in: ["st1"] });
  });

  it("skips students with no fee row (not treated as not_cleared)", async () => {
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    mockStudentFindMany.mockResolvedValue([{ id: "st1" }, { id: "st2" }]);
    mockFeeStatusFindMany.mockResolvedValue([]);
    mockGuardianFindMany.mockResolvedValue([]);
    const ids = await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"] });
    expect(ids).toEqual([]);
    expect(mockGuardianFindMany).not.toHaveBeenCalled();
  });

  it("returns empty with no current term, and with empty statuses", async () => {
    mockTermFindFirst.mockResolvedValue(null);
    expect(await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee", feeStatuses: ["cleared"] })).toEqual([]);
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    expect(await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee" })).toEqual([]);
    expect(mockFeeStatusFindMany).not.toHaveBeenCalled();
  });

  it("applies class filter to the student scope", async () => {
    mockTermFindFirst.mockResolvedValue({ id: "t1" });
    mockStudentFindMany.mockResolvedValue([]);
    mockFeeStatusFindMany.mockResolvedValue([]);
    mockGuardianFindMany.mockResolvedValue([]);
    await resolveAudienceUserIds("s1", { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"], classId: "c7" });
    expect(mockStudentFindMany.mock.calls[0][0].where.currentClassId).toBe("c7");
  });
});

describe("searchDirectory", () => {
  it("teachers: label prefers Staff.fullName over email", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "u1", email: "a@x.com", staff: { fullName: "Ada Obi" } },
      { id: "u2", email: "b@x.com", staff: null },
    ]);
    const out = await searchDirectory("s1", { type: "teacher", query: "" });
    expect(out).toEqual([
      { id: "u1", label: "Ada Obi", sublabel: "a@x.com", type: "staff" },
      { id: "u2", label: "b@x.com", type: "staff" },
    ]);
    expect(mockUserFindMany.mock.calls[0][0].where.role).toBe("staff");
  });

  it("students: returns entries with ward label and admission/class sublabel", async () => {
    mockStudentFindMany.mockResolvedValue([
      { userId: "u5", firstName: "Tunde", lastName: "Bello", admissionNumber: "A01", currentClass: { name: "JSS1A" } },
      { userId: null, firstName: "No", lastName: "Login", admissionNumber: "A02", currentClass: null },
    ]);
    const out = await searchDirectory("s1", { type: "student", query: "tun", classId: "c1" });
    expect(out).toEqual([
      { id: "u5", label: "Tunde Bello", sublabel: "A01 · JSS1A", type: "student" },
    ]);
    const where = mockStudentFindMany.mock.calls[0][0].where;
    expect(where.userId).toEqual({ not: null });
    expect(where.currentClassId).toBe("c1");
    expect(where.OR[0].firstName.contains).toBe("tun");
  });

  it("parents: one entry per guardian user, labeled with ward name and class", async () => {
    mockGuardianFindMany.mockResolvedValue([
      { parentUserId: "p1", fullName: "Mrs Ade", relationship: "mother",
        student: { firstName: "Tunde", lastName: "Bello", currentClass: { name: "JSS2A" } } },
      { parentUserId: "p1", fullName: "Mrs Ade", relationship: "mother",
        student: { firstName: "Ada", lastName: "Bello", currentClass: { name: "JSS1A" } } },
    ]);
    const out = await searchDirectory("s1", { type: "parent", query: "" });
    expect(out).toEqual([
      { id: "p1", label: "Mrs Ade", sublabel: "mother of Tunde JSS2A", type: "parent" },
    ]);
  });
});
