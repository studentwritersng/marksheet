import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerHubAction, revokeHubAction, releaseExamToHub, cancelReleaseToHubAction, batchReleaseExamsToHub } from "./actions";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({
  resolvePermissions: vi.fn(),
  canManageSchool: (p: any) => p.isSuperAdmin || p.isSchoolAdmin,
}));
vi.mock("@/lib/auth/guards", () => ({
  canReviewExams: (p: any) => p.isExamOfficer || p.isSchoolAdmin || p.isSuperAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { hash: async (v: string) => `hashed:${v}` } }));
vi.mock("./crypto", () => ({ generateRandomBytes: (n: number) => "x".repeat(n) }));
vi.mock("./bundle", () => ({
  generatePin: () => "123456",
  hashPin: (p: string) => `pin:${p}`,
  serializeBundle: () => "payload",
  fetchExamDataForBundle: vi.fn(async () => ({
    exam: { id: "exam-1", schoolId: "school-1", durationMinutes: 60, shuffleEnabled: false, subjectName: "Maths", classNames: "JSS1", termLabel: "Term 1" },
    questions: [],
    students: [{ id: "stu-1", admissionNumber: "A1", firstName: "Ada", lastName: "Lovelace" }],
  })),
}));

const { prisma } = await import("@/lib/prisma");
const { getCurrentUser } = await import("@/lib/auth/current-user");
const { resolvePermissions } = await import("@/lib/auth/permissions");
const bcrypt = (await import("bcryptjs")).default;

const adminPerms = { isSuperAdmin: false, isSchoolAdmin: true, isExamOfficer: false } as any;
const officerPerms = { isSuperAdmin: false, isSchoolAdmin: false, isExamOfficer: true } as any;
const teacherPerms = { isSuperAdmin: false, isSchoolAdmin: false, isExamOfficer: false } as any;

function makeUser(over: any = {}) {
  return { id: "u1", role: "staff", staffId: "st1", schoolId: "school-1", ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  (resolvePermissions as any).mockResolvedValue(adminPerms);
});

describe("registerHubAction", () => {
  it("lets a school admin register a hub for their own school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.school as any) = { findUnique: vi.fn().mockResolvedValue({ id: "school-1" }) };
    (prisma.hub as any) = { create: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1", name: "Hall 1" }) };
    (bcrypt.hash as any) = async (v: string) => `hashed:${v}`;

    const form = new FormData();
    form.set("name", "Hall 1");
    const res = await registerHubAction({} as any, form);

    expect(res.error).toBeUndefined();
    expect(res.success).toContain("Hall 1");
    expect(res.data?.apiKey).toMatch(/^mk_hub_/);
    expect(prisma.hub.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ schoolId: "school-1", apiKeyHash: expect.stringContaining("hashed:") }),
    }));
  });

  it("rejects a non-admin", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const form = new FormData();
    form.set("name", "Hall 1");
    expect((await registerHubAction({} as any, form)).error).toBe("Not authorised.");
  });

  it("rejects a staff member with no school scope", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser({ schoolId: null }));
    const form = new FormData();
    form.set("name", "Hall 1");
    expect((await registerHubAction({} as any, form)).error).toBe("Not authorised.");
  });
});

describe("revokeHubAction", () => {
  beforeEach(() => {
    (prisma.offlineBundle as any) = { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) };
    (prisma.exam as any) = { update: vi.fn().mockResolvedValue({}) };
    (prisma.examAttempt as any) = { count: vi.fn().mockResolvedValue(0) };
    (prisma.$transaction as any) = async (fn: any) => fn(prisma);
  });

  it("lets a school admin revoke one of their own hubs", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = {
      findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1" }),
      update: vi.fn().mockResolvedValue({}),
    };
    const form = new FormData();
    form.set("hubId", "hub-1");
    const res = await revokeHubAction({} as any, form);
    expect(res.success).toBe("Hub revoked.");
    expect(prisma.hub.update).toHaveBeenCalledWith({ where: { id: "hub-1" }, data: { status: "revoked" } });
  });

  it("cannot revoke a hub belonging to another school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    };
    const form = new FormData();
    form.set("hubId", "other-hub");
    const res = await revokeHubAction({} as any, form);
    expect(res.error).toBe("Hub not found.");
    expect(prisma.hub.update).not.toHaveBeenCalled();
  });

  it("rejects a non-admin", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const form = new FormData();
    form.set("hubId", "hub-1");
    expect((await revokeHubAction({} as any, form)).error).toBe("Not authorised.");
  });

  it("deletes bundles and resets exams that were released only to the revoked hub", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = {
      findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1" }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma.offlineBundle as any).findMany.mockResolvedValue([{ id: "b-1", examId: "exam-1" }]);

    const form = new FormData();
    form.set("hubId", "hub-1");
    const res = await revokeHubAction({} as any, form);

    expect(res.success).toBe("Hub revoked.");
    expect(prisma.examAttempt.count).toHaveBeenCalledWith({ where: { examId: "exam-1", hubAttemptId: { not: null } } });
    expect(prisma.exam.update).toHaveBeenCalledWith({ where: { id: "exam-1" }, data: { offlineStatus: "none" } });
  });

  it("does not reset an exam that already synced attempts back when its hub is revoked", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = {
      findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1" }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma.offlineBundle as any).findMany.mockResolvedValue([{ id: "b-1", examId: "exam-1" }]);
    (prisma.examAttempt as any).count.mockResolvedValue(1);

    const form = new FormData();
    form.set("hubId", "hub-1");
    const res = await revokeHubAction({} as any, form);

    expect(res.success).toBe("Hub revoked.");
    expect(prisma.exam.update).not.toHaveBeenCalled();
  });

  it("does not reset an exam that is still released to another hub", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = {
      findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1" }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma.offlineBundle as any).findMany.mockResolvedValue([{ id: "b-1", examId: "exam-1" }]);
    (prisma.offlineBundle as any).count = vi.fn().mockResolvedValue(1);

    const form = new FormData();
    form.set("hubId", "hub-1");
    const res = await revokeHubAction({} as any, form);

    expect(res.success).toBe("Hub revoked.");
    expect(prisma.exam.update).not.toHaveBeenCalled();
  });
});

describe("cancelReleaseToHubAction", () => {
  beforeEach(() => {
    (prisma.exam as any) = {
      findFirst: vi.fn().mockResolvedValue({ id: "exam-1", schoolId: "school-1", offlineStatus: "released" }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma.examAttempt as any) = { count: vi.fn().mockResolvedValue(0) };
    (prisma.offlineBundle as any) = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    (prisma.$transaction as any) = async (fn: any) => fn(prisma);
  });

  it("lets a school admin cancel a release for their own exam", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await cancelReleaseToHubAction("exam-1");
    expect(res.success).toBe("Exam release cancelled.");
    expect(prisma.offlineBundle.deleteMany).toHaveBeenCalledWith({ where: { examId: "exam-1" } });
    expect(prisma.exam.update).toHaveBeenCalledWith({ where: { id: "exam-1" }, data: { offlineStatus: "none" } });
  });

  it("lets an exam officer cancel a release", async () => {
    (resolvePermissions as any).mockResolvedValue(officerPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await cancelReleaseToHubAction("exam-1");
    expect(res.success).toBe("Exam release cancelled.");
  });

  it("rejects a teacher without admin/officer permission", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await cancelReleaseToHubAction("exam-1");
    expect(res.error).toBe("Not authorised.");
  });

  it("cannot cancel an exam belonging to another school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findFirst.mockResolvedValue(null);
    const res = await cancelReleaseToHubAction("other-exam");
    expect(res.error).toBe("Exam not found.");
    expect(prisma.offlineBundle.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses to cancel once attempts have synced back from a hub", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.examAttempt as any).count.mockResolvedValue(1);
    const res = await cancelReleaseToHubAction("exam-1");
    expect(res.error).toBe("Exam attempts have already synced back from a hub; release cannot be cancelled.");
    expect(prisma.offlineBundle.deleteMany).not.toHaveBeenCalled();
    expect(prisma.exam.update).not.toHaveBeenCalled();
  });
});

describe("releaseExamToHub", () => {
  beforeEach(() => {
    (prisma.hub as any) = { findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1", name: "Hall 1", signingSecret: "sec" }) };
    (prisma.offlineBundle as any) = { create: vi.fn().mockResolvedValue({ id: "bundle-1" }) };
    (prisma.examPin as any) = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
    (prisma.exam as any) = { update: vi.fn().mockResolvedValue({}) };
    (prisma.$transaction as any) = async (fn: any) => fn(prisma);
  });

  it("lets a school admin release an exam", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await releaseExamToHub("exam-1", "hub-1");
    expect(res.success).toContain("Hall 1");
    expect(prisma.exam.update).toHaveBeenCalledWith({ where: { id: "exam-1" }, data: { offlineStatus: "released" } });
  });

  it("lets an exam officer release an exam", async () => {
    (resolvePermissions as any).mockResolvedValue(officerPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await releaseExamToHub("exam-1", "hub-1");
    expect(res.success).toContain("Hall 1");
  });

  it("rejects a teacher without admin/officer permission", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const res = await releaseExamToHub("exam-1", "hub-1");
    expect(res.error).toBe("Not authorised.");
  });

  it("cannot release to a hub outside the school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any) = { findFirst: vi.fn().mockResolvedValue(null) };
    const res = await releaseExamToHub("exam-1", "other-hub");
    expect(res.error).toBe("Active hub not found for this school.");
  });

  it("returns a graceful error when the exam cannot be fetched, without mutating the exam", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    const { fetchExamDataForBundle } = await import("./bundle");
    (fetchExamDataForBundle as any).mockRejectedValue(new Error("exam not found"));

    const res = await releaseExamToHub("exam-1", "hub-1");

    expect(res.error).toBe("Exam not found or not ready to release.");
    expect(prisma.exam.update).not.toHaveBeenCalled();

    (fetchExamDataForBundle as any).mockImplementation(async () => ({
      exam: { id: "exam-1", schoolId: "school-1", durationMinutes: 60, shuffleEnabled: false, subjectName: "Maths", classNames: "JSS1", termLabel: "Term 1" },
      questions: [],
      students: [{ id: "stu-1", admissionNumber: "A1", firstName: "Ada", lastName: "Lovelace" }],
    }));
  });
});

describe("batchReleaseExamsToHub", () => {
  beforeEach(() => {
    (prisma.hub as any) = { findFirst: vi.fn().mockResolvedValue({ id: "hub-1", schoolId: "school-1", name: "Hall 1", signingSecret: "sec" }) };
    (prisma.offlineBundle as any) = { create: vi.fn().mockResolvedValue({ id: "bundle-1" }) };
    (prisma.examPin as any) = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
    (prisma.exam as any) = {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma.$transaction as any) = async (fn: any) => fn(prisma);
  });

  it("releases multiple eligible exams to one hub", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "published", offlineStatus: "none", subject: { name: "Maths" } },
      { id: "exam-2", status: "published", offlineStatus: "none", subject: { name: "English" } },
    ]);

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1", "exam-2"]);

    expect(res.data?.released).toHaveLength(2);
    expect(prisma.exam.update).toHaveBeenCalledTimes(2);
    expect(prisma.exam.update).toHaveBeenCalledWith({ where: { id: "exam-2" }, data: { offlineStatus: "released" } });
  });

  it("skips already-released exams without re-releasing", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "published", offlineStatus: "released", subject: { name: "Maths" } },
      { id: "exam-2", status: "published", offlineStatus: "none", subject: { name: "English" } },
    ]);

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1", "exam-2"]);

    expect(res.data?.released).toHaveLength(1);
    expect(res.data?.skipped).toEqual([
      { examId: "exam-1", title: "Maths", reason: "already released" },
    ]);
    expect(prisma.exam.update).toHaveBeenCalledTimes(1);
  });

  it("skips non-published exams", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "draft", offlineStatus: "none", subject: { name: "Maths" } },
    ]);

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1"]);

    expect(res.data?.released).toHaveLength(0);
    expect(res.data?.skipped).toEqual([{ examId: "exam-1", title: "Maths", reason: "not published" }]);
  });

  it("isolates a per-exam failure so other exams still release", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.exam as any).findMany.mockResolvedValue([
      { id: "exam-1", status: "published", offlineStatus: "none", subject: { name: "Maths" } },
      { id: "exam-2", status: "published", offlineStatus: "none", subject: { name: "English" } },
    ]);
    const { fetchExamDataForBundle } = await import("./bundle");
    (fetchExamDataForBundle as any).mockRejectedValueOnce(new Error("No active students"));

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1", "exam-2"]);

    expect(res.data?.released).toHaveLength(1);
    expect(res.data?.failed).toEqual([
      { examId: "exam-1", title: "Maths", reason: "No active students" },
    ]);

    (fetchExamDataForBundle as any).mockImplementation(async () => ({
      exam: { id: "exam-1", schoolId: "school-1", durationMinutes: 60, shuffleEnabled: false, subjectName: "Maths", classNames: "JSS1", termLabel: "Term 1" },
      questions: [],
      students: [{ id: "stu-1", admissionNumber: "A1", firstName: "Ada", lastName: "Lovelace" }],
    }));
  });

  it("rejects a teacher without admin/officer permission", async () => {
    (resolvePermissions as any).mockResolvedValue(teacherPerms);
    (getCurrentUser as any).mockResolvedValue(makeUser());

    const res = await batchReleaseExamsToHub("hub-1", ["exam-1"]);

    expect(res.error).toBe("Not authorised.");
  });

  it("cannot release to a hub outside the school", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());
    (prisma.hub as any).findFirst.mockResolvedValue(null);

    const res = await batchReleaseExamsToHub("other-hub", ["exam-1"]);

    expect(res.error).toBe("Active hub not found for this school.");
  });

  it("no-ops when given an empty exam list", async () => {
    (getCurrentUser as any).mockResolvedValue(makeUser());

    const res = await batchReleaseExamsToHub("hub-1", []);

    expect(res.data?.released).toEqual([]);
    expect(res.success).toContain("0 released");
  });
});