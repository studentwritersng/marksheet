import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateHub } from "./hub-auth";

vi.mock("@/lib/prisma", () => ({ prisma: { hub: {} } }));
const { prisma } = await import("@/lib/prisma");
const bcrypt = (await import("bcryptjs")).default;

const fakeHash = await bcrypt.hash("mk_hub_testkey", 4);

beforeEach(() => {
  (prisma.hub.findMany as any) = vi.fn().mockResolvedValue([
    { id: "hub-1", schoolId: "school-1", name: "Hall 1", signingSecret: "sec", apiKeyHash: fakeHash, status: "active" },
  ]);
  (prisma.hub.update as any) = vi.fn().mockResolvedValue({});
});

describe("authenticateHub", () => {
  it("accepts a valid API key", async () => {
    const req = new Request("http://x", { headers: { authorization: "Bearer mk_hub_testkey" } });
    const res = await authenticateHub(req);
    expect(res?.hub.id).toBe("hub-1");
  });

  it("rejects a wrong key", async () => {
    const req = new Request("http://x", { headers: { authorization: "Bearer mk_hub_wrong" } });
    expect(await authenticateHub(req)).toBeNull();
  });

  it("rejects missing header", async () => {
    expect(await authenticateHub(new Request("http://x"))).toBeNull();
  });
});