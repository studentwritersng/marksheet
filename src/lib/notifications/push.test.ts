import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import crypto from "crypto";

const mockUserFindFirst = vi.fn();
const mockUserFindUnique = vi.fn();
const mockParentAccountFindFirst = vi.fn();
const mockDevicesFindMany = vi.fn();
const mockDevicesDeleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    parentAccount: { findFirst: (...a: unknown[]) => mockParentAccountFindFirst(...a) },
    pushDevice: {
      findMany: (...a: unknown[]) => mockDevicesFindMany(...a),
      deleteMany: (...a: unknown[]) => mockDevicesDeleteMany(...a),
    },
  },
}));

let rsaKeyPair: crypto.KeyPairKeyObjectResult;

beforeAll(() => {
  rsaKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
});

// Exported PEM of the generated private key, set per-test
function setFcmEnv() {
  process.env.FCM_PROJECT_ID = "test-project";
  process.env.FCM_CLIENT_EMAIL = "firebase-adminsdk@test-project.iam.gserviceaccount.com";
  process.env.FCM_PRIVATE_KEY = rsaKeyPair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

const fetchMock = vi.fn();

beforeEach(() => {
  [mockUserFindFirst, mockUserFindUnique, mockParentAccountFindFirst, mockDevicesFindMany, mockDevicesDeleteMany, fetchMock].forEach((m) => m.mockReset());
  delete process.env.FCM_PROJECT_ID;
  delete process.env.FCM_CLIENT_EMAIL;
  delete process.env.FCM_PRIVATE_KEY;
});

/** Helper: first fetch call = OAuth2 token endpoint; subsequent = messages:send */
function stubAuthThenSends(sendResponder: (url: string, init?: RequestInit) => Response) {
  fetchMock.mockImplementationOnce(async () =>
    new Response(JSON.stringify({ access_token: "tok123", expires_in: 3600 }), { status: 200 })
  );
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => sendResponder(url, init));
}

describe("isPushConfigured", () => {
  it("returns false when env vars are missing", async () => {
    const { isPushConfigured } = await import("./push");
    expect(isPushConfigured()).toBe(false);
  });
  it("returns true when all three env vars are present", async () => {
    setFcmEnv();
    const { isPushConfigured } = await import("./push");
    expect(isPushConfigured()).toBe(true);
  });
});

describe("resolvePushUserIds", () => {
  it("passes parent and student recipientIds straight through (they are User ids)", async () => {
    const { resolvePushUserIds } = await import("./push");
    expect(await resolvePushUserIds("parent", "user-1")).toEqual(["user-1"]);
    expect(await resolvePushUserIds("student", "user-2")).toEqual(["user-2"]);
    expect(mockUserFindFirst).not.toHaveBeenCalled();
  });
  it("resolves staff recipientId (Staff.id) through User.staffId", async () => {
    mockUserFindFirst.mockResolvedValueOnce({ id: "user-9" });
    const { resolvePushUserIds } = await import("./push");
    expect(await resolvePushUserIds("staff", "staff-5")).toEqual(["user-9"]);
    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { staffId: "staff-5" } })
    );
  });
  it("returns [] when a staff recipientId matches no user", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null);
    const { resolvePushUserIds } = await import("./push");
    expect(await resolvePushUserIds("staff", "ghost")).toEqual([]);
  });
});

describe("deliverPushForNotification", () => {
  function happyDb() {
    mockUserFindUnique.mockResolvedValue({ email: "p@x.com" });
    mockParentAccountFindFirst.mockResolvedValue(null);
    mockDevicesFindMany.mockResolvedValue([
      { id: "dev-1", fcmToken: "tokA" },
      { id: "dev-2", fcmToken: "tokB" },
    ]);
    mockDevicesDeleteMany.mockResolvedValue({ count: 0 });
  }

  it("sends an FCM message to every device of the recipient", async () => {
    setFcmEnv(); happyDb();
    stubAuthThenSends(() => new Response("{}", { status: 200 }));
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "parent", recipientId: "user-1", eventType: "result_published", title: "Results out", content: "Check the app." },
      fetchMock as unknown as typeof fetch,
    );
    const sendCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("messages:send"));
    expect(sendCalls.length).toBe(2);
    const body = JSON.parse(String(sendCalls[0][1].body));
    expect(body.message.token).toMatch(/tokA|tokB/);
    expect(body.message.notification.title).toBe("Results out");
    expect(body.message.notification.body).toBe("Check the app.");
    expect(body.message.data.eventType).toBe("result_published");
    expect(mockDevicesDeleteMany).not.toHaveBeenCalled();
  });

  it("does nothing when push is not configured", async () => {
    happyDb();
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "parent", recipientId: "u1", eventType: "e", title: null, content: "hi" },
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when the recipient has no registered devices", async () => {
    setFcmEnv();
    mockUserFindUnique.mockResolvedValue({ email: "p@x.com" });
    mockParentAccountFindFirst.mockResolvedValue(null);
    mockDevicesFindMany.mockResolvedValue([]);
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "staff", recipientId: "s1", eventType: "e", title: null, content: "hi" },
      fetchMock as unknown as typeof fetch,
    );
    // staff resolution returned no user -> no devices query even needed
    expect(mockDevicesFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: { in: [] } } }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips muted parents (notificationPreferences.pushActive === false)", async () => {
    setFcmEnv();
    mockUserFindUnique.mockResolvedValue({ email: "p@x.com" });
    mockParentAccountFindFirst.mockResolvedValue({
      notificationPreferences: { smsActive: true, pushActive: false, enabledEvents: [] },
    });
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "parent", recipientId: "u1", eventType: "e", title: null, content: "hi" },
      fetchMock as unknown as typeof fetch,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockDevicesFindMany).not.toHaveBeenCalled();
  });

  it("prunes devices whose token Google reports as UNREGISTERED", async () => {
    setFcmEnv(); happyDb();
    stubAuthThenSends((_url, init) => {
      const body = JSON.parse(String(init?.body));
      const status = body.message.token === "tokA" ? 404 : 200;
      return new Response(status === 404 ? JSON.stringify({ error: { status: "UNREGISTERED" } }) : "{}", { status });
    });
    const { deliverPushForNotification } = await import("./push");
    await deliverPushForNotification(
      { recipientType: "student", recipientId: "u2", eventType: "exam_graded", title: null, content: "Graded!" },
      fetchMock as unknown as typeof fetch,
    );
    expect(mockDevicesDeleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["dev-1"] } } }));
  });

  it("never throws — provider outage is logged, not propagated", async () => {
    setFcmEnv(); happyDb();
    fetchMock.mockRejectedValue(new Error("network down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deliverPushForNotification } = await import("./push");
    await expect(
      deliverPushForNotification(
        { recipientType: "parent", recipientId: "u1", eventType: "e", title: null, content: "x" },
        fetchMock as unknown as typeof fetch,
      ),
    ).resolves.toBeUndefined();
    consoleSpy.mockRestore();
  });
});

describe("deepLinkForEvent", () => {
  it("falls back to home for unknown events", async () => {
    const { deepLinkForEvent } = await import("./push");
    expect(deepLinkForEvent("anything")).toBe("/");
  });
});
