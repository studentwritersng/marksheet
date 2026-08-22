import { describe, it, expect, vi, beforeEach } from "vitest";

const runImmediately = (fn: () => unknown) => void fn();

vi.mock("next/server", () => ({ after: (...args: unknown[]) => runImmediately(args[0] as () => unknown) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/auth/permissions", () => ({
  resolvePermissions: vi.fn(),
  canManageSchool: vi.fn(),
}));

const mockNotificationCreate = vi.fn().mockResolvedValue({});
const mockDeliverPush = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { create: (...a: unknown[]) => mockNotificationCreate(...a) } },
}));

vi.mock("@/lib/notifications/push", () => ({
  deliverPushForNotification: (...a: unknown[]) => mockDeliverPush(...a),
}));

import { createNotification } from "./actions";

beforeEach(() => {
  mockNotificationCreate.mockClear();
  mockDeliverPush.mockClear();
});

describe("createNotification push fan-out", () => {
  it("fans out to push for the default (in_app) channel", async () => {
    await createNotification({
      schoolId: "school-1",
      recipientType: "parent",
      recipientId: "user-1",
      eventType: "result_published",
      title: "Results published",
      content: "Term 1 results are ready.",
    });
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mockDeliverPush).toHaveBeenCalledWith({
      recipientType: "parent",
      recipientId: "user-1",
      eventType: "result_published",
      title: "Results published",
      content: "Term 1 results are ready.",
    });
  });

  it("still writes the row even though push runs post-response", async () => {
    mockDeliverPush.mockImplementation(() => new Promise(() => {})); // never settles
    await expect(createNotification({
      recipientType: "staff", recipientId: "staff-1", eventType: "general_notice", content: "Hi",
    })).resolves.toBeUndefined();
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
  });

  it("does not fan out when an explicit non-in_app channel is requested", async () => {
    await createNotification({
      recipientType: "parent", recipientId: "user-1", eventType: "e", content: "x", channel: "sms",
    });
    expect(mockDeliverPush).not.toHaveBeenCalled();
  });
});
