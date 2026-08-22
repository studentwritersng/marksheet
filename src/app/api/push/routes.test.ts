import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: (...a: unknown[]) => mockGetUser(...a) }));

vi.mock("@/lib/auth/route-security", () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
  clientKey: vi.fn().mockReturnValue("test-client"),
  tooManyRequests: vi.fn(),
}));

const mockUpsert = vi.fn().mockResolvedValue({});
const mockDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushDevice: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      deleteMany: (...a: unknown[]) => mockDeleteMany(...a),
    },
  },
}));

import { POST as registerPOST } from "./register/route";
import { POST as unregisterPOST } from "./unregister/route";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetUser.mockReset().mockResolvedValue({
    userId: "user-1", role: "parent", schoolId: "school-1", staffId: null,
    email: "p@x.com", mustChangePassword: false,
  });
  mockUpsert.mockClear();
  mockDeleteMany.mockClear();
});

describe("POST /api/push/register", () => {
  it("401s without a session", async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await registerPOST(jsonRequest("http://x/api/push/register", { fcmToken: "t".repeat(16) }));
    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400s on a missing/too-short/oversized token", async () => {
    for (const bad of [{}, { fcmToken: "short" }, { fcmToken: "t".repeat(5000) }]) {
      const res = await registerPOST(jsonRequest("http://x/api/push/register", bad));
      expect(res.status).toBe(400);
    }
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts by token, stamping the SESSION user and school", async () => {
    const res = await registerPOST(jsonRequest("http://x/api/push/register", { fcmToken: "fcm-token-abc", platform: "android" }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { fcmToken: "fcm-token-abc" },
      update: { userId: "user-1", schoolId: "school-1", platform: "android" },
      create: { fcmToken: "fcm-token-abc", userId: "user-1", schoolId: "school-1", platform: "android" },
    }));
  });

  it("re-registration overwrites a previous owner of the same token", async () => {
    mockGetUser.mockResolvedValueOnce({
      userId: "user-2", role: "student", schoolId: "school-2", staffId: null,
      email: "s@x.com", mustChangePassword: false,
    });
    await registerPOST(jsonRequest("http://x/api/push/register", { fcmToken: "fcm-token-abc" }));
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { userId: "user-2", schoolId: "school-2", platform: "android" },
    }));
  });
});

describe("POST /api/push/unregister", () => {
  it("deletes only the caller's own row", async () => {
    const res = await unregisterPOST(jsonRequest("http://x/api/push/unregister", { fcmToken: "fcm-token-abc" }));
    expect(res.status).toBe(200);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { fcmToken: "fcm-token-abc", userId: "user-1" },
    });
  });

  it("401s without a session", async () => {
    mockGetUser.mockResolvedValueOnce(null);
    const res = await unregisterPOST(jsonRequest("http://x/api/push/unregister", { fcmToken: "fcm-token-abc" }));
    expect(res.status).toBe(401);
  });
});
