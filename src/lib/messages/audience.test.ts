// src/lib/messages/audience.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindMany = vi.fn();
const mockStudentFindMany = vi.fn();
const mockGuardianFindMany = vi.fn();
const mockFeeStatusFindMany = vi.fn();
const mockTermFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    student: { findMany: (...a: unknown[]) => mockStudentFindMany(...a) },
    guardian: { findMany: (...a: unknown[]) => mockGuardianFindMany(...a) },
    feeStatus: { findMany: (...a: unknown[]) => mockFeeStatusFindMany(...a) },
    term: { findFirst: (...a: unknown[]) => mockTermFindFirst(...a) },
  },
}));

import { resolveAudienceUserIds, countAudience, BULK_SEND_CAP } from "./audience";

beforeEach(() => {
  [mockUserFindMany, mockStudentFindMany, mockGuardianFindMany, mockFeeStatusFindMany, mockTermFindFirst].forEach((m) => m.mockReset());
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
