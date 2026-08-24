// src/app/(app)/messages/actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.fn();
const mockResolvePermissions = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockConversationCreate = vi.fn();

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: (...a: unknown[]) => mockGetCurrentUser(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findMany: (...a: unknown[]) => mockUserFindMany(...a),
    },
    conversation: { create: (...a: unknown[]) => mockConversationCreate(...a) },
  },
}));
vi.mock("@/lib/notifications/actions", () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({
  resolvePermissions: (...a: unknown[]) => mockResolvePermissions(...a),
  canManageSchool: (p: { isSuperAdmin: boolean }) => p.isSuperAdmin,
}));
vi.mock("@/lib/messages/audience", () => ({
  resolveAudienceUserIds: vi.fn(),
  countAudience: vi.fn().mockResolvedValue(0),
  searchDirectory: vi.fn().mockResolvedValue([]),
  BULK_SEND_CAP: 1000,
}));

import { bulkSendAction, getMessageRecipientsAction } from "./actions";
import { resolveAudienceUserIds } from "@/lib/messages/audience";
const resolveMock = vi.mocked(resolveAudienceUserIds);

beforeEach(() => {
  [mockGetCurrentUser, mockResolvePermissions, mockUserFindUnique, mockUserFindMany, mockConversationCreate, resolveMock].forEach((m) => m.mockReset());
});

function adminUser() {
  return { userId: "admin1", role: "super_admin", schoolId: "s1", staffId: null, email: "a@x.com" };
}

describe("bulkSendAction", () => {
  it("rejects senders that are neither admins nor HODs", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser());
    mockResolvePermissions.mockResolvedValue({ isSuperAdmin: false, assignments: [] });
    const res = await bulkSendAction({ audienceType: "teachers" }, "Hi", "Body");
    expect(res.error).toBe("Not allowed.");
  });

  it("allows HODs via assignment and fans out 1:1 conversations + notifications", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser());
    mockResolvePermissions.mockResolvedValue({
      isSuperAdmin: false,
      assignments: [{ assignmentType: "hod", subjectId: "sub1", classId: null }],
    });
    resolveMock.mockResolvedValue(["u1", "u2"]);
    mockUserFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      ({ id: where.id, email: `${where.id}@x.com`, role: where.id === "u1" ? "staff" : "parent", schoolId: "s1" }));
    mockConversationCreate.mockImplementation(async ({ data }: { data: { participants: { create: { userId: string }[] } } }) =>
      ({ id: `conv-${data.participants.create[1].userId}` }));

    const res = await bulkSendAction(
      { audienceType: "parents_by_fee", feeStatuses: ["not_cleared"] },
      "Fees",
      "Please pay.",
    );
    expect(res).toEqual({ sent: 2 });
    expect(mockConversationCreate).toHaveBeenCalledTimes(2);
    expect(mockConversationCreate.mock.calls[0][0].data.messages.create.senderId).toBe("admin1");
  });

  it("errors on empty audience and over-cap audiences", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser());
    mockResolvePermissions.mockResolvedValue({ isSuperAdmin: true, assignments: [] });

    resolveMock.mockResolvedValue([]);
    expect((await bulkSendAction({ audienceType: "teachers" }, "S", "B")).error)
      .toBe("No recipients match this audience.");

    resolveMock.mockResolvedValue(Array.from({ length: 1001 }, (_, i) => `u${i}`));
    expect((await bulkSendAction({ audienceType: "teachers" }, "S", "B")).error)
      .toContain("Cap is 1000");
  });
});

describe("role-matrix regression (admins saw nobody)", () => {
  it("getMessageRecipientsAction returns staff for a super_admin sender", async () => {
    mockGetCurrentUser.mockResolvedValue(adminUser());
    mockUserFindMany.mockResolvedValue([{ id: "t1", email: "t@x.com", staffId: null }]);
    const res = await getMessageRecipientsAction();
    expect(res.recipients).toEqual([{ userId: "t1", label: "t@x.com", type: "staff" }]);
  });
});
