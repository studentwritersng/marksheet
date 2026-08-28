import { it, expect, vi, beforeEach, afterEach, describe } from "vitest";

/**
 * Regression tests for the provider fallback stack.
 *
 * Bug: decryptSecret() was called inside a .map() wrapped in a single
 * try/catch, so ONE provider with an undecryptable key threw and aborted the
 * whole stack, silently falling through to the env provider
 * (AI_DEFAULT_MODEL). Every AI call then used the env model regardless of the
 * configured priority order.
 */

const findMany = vi.fn();
const decryptSecret = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiProviderConfig: { findMany: (...a: unknown[]) => findMany(...a) },
    aiCallLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/secrets", () => ({
  decryptSecret: (...a: unknown[]) => decryptSecret(...a),
}));

function provider(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "id-" + (over.priority ?? 1),
    label: "P" + (over.priority ?? 1),
    baseUrl: "https://p" + (over.priority ?? 1) + ".test/v1",
    apiKeyEncrypted: "enc:v1:blob",
    defaultModelName: "model-p" + (over.priority ?? 1),
    priority: 1,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    ...over,
  };
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  findMany.mockReset();
  decryptSecret.mockReset();
  warn = vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.AI_BASE_URL = "https://env-provider.test/v1";
  process.env.AI_API_KEY = "env-key";
  process.env.AI_DEFAULT_MODEL = "gemini-2.5-flash";
});

afterEach(() => {
  warn.mockRestore();
});

async function loadStack() {
  const mod = await import("@/lib/ai/gateway");
  return mod.loadProviderStack();
}

describe("loadProviderStack", () => {
  it("skips a provider whose key cannot be decrypted and keeps the next priority", async () => {
    findMany.mockResolvedValue([
      provider({ priority: 1, defaultModelName: "claude-opus-5" }),
      provider({ priority: 2, defaultModelName: "step-3.7-flash" }),
    ]);
    decryptSecret
      .mockImplementationOnce(() => {
        throw new Error("Failed to decrypt a stored secret.");
      })
      .mockImplementationOnce(() => "good-key");

    const stack = await loadStack();

    expect(stack).toHaveLength(1);
    expect(stack[0].defaultModel).toBe("step-3.7-flash");
    expect(stack[0].providerConfigId).toBe("id-2");
  });

  it("does NOT fall back to the env model when a healthy lower-priority provider exists", async () => {
    findMany.mockResolvedValue([
      provider({ priority: 1 }),
      provider({ priority: 2, defaultModelName: "step-3.7-flash" }),
    ]);
    decryptSecret
      .mockImplementationOnce(() => {
        throw new Error("boom");
      })
      .mockImplementationOnce(() => "good-key");

    const stack = await loadStack();

    expect(stack.map((s) => s.defaultModel)).not.toContain("gemini-2.5-flash");
    expect(stack.every((s) => s.providerConfigId !== null)).toBe(true);
  });

  it("preserves priority order for all-healthy providers", async () => {
    findMany.mockResolvedValue([
      provider({ priority: 1, defaultModelName: "a" }),
      provider({ priority: 2, defaultModelName: "b" }),
      provider({ priority: 3, defaultModelName: "c" }),
    ]);
    decryptSecret.mockReturnValue("k");

    const stack = await loadStack();

    expect(stack.map((s) => s.defaultModel)).toEqual(["a", "b", "c"]);
  });

  it("logs which provider was skipped so the silent switch is visible", async () => {
    findMany.mockResolvedValue([
      provider({ priority: 1, label: "Opus 5 justdowork" }),
      provider({ priority: 2 }),
    ]);
    decryptSecret
      .mockImplementationOnce(() => {
        throw new Error("bad key");
      })
      .mockImplementationOnce(() => "k");

    await loadStack();

    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("Opus 5 justdowork");
  });

  it("skips providers missing baseUrl / model without consuming a decrypt", async () => {
    findMany.mockResolvedValue([
      provider({ priority: 1, baseUrl: "" }),
      provider({ priority: 2, defaultModelName: "" }),
      provider({ priority: 3, defaultModelName: "ok" }),
    ]);
    decryptSecret.mockReturnValue("k");

    const stack = await loadStack();

    expect(stack).toHaveLength(1);
    expect(stack[0].defaultModel).toBe("ok");
    expect(decryptSecret).toHaveBeenCalledTimes(1);
  });

  it("falls back to env only when every DB provider is unusable", async () => {
    findMany.mockResolvedValue([provider({ priority: 1 }), provider({ priority: 2 })]);
    decryptSecret.mockImplementation(() => {
      throw new Error("bad key");
    });

    const stack = await loadStack();

    expect(stack).toHaveLength(1);
    expect(stack[0].providerConfigId).toBeNull();
    expect(stack[0].defaultModel).toBe("gemini-2.5-flash");
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toMatch(/every configured AI provider|falling back to the environment/i);
  });

  it("falls back to env when the database is unreachable", async () => {
    findMany.mockRejectedValue(new Error("connection refused"));

    const stack = await loadStack();

    expect(stack).toHaveLength(1);
    expect(stack[0].providerConfigId).toBeNull();
  });

  it("returns an empty stack when there is no DB provider and no env config", async () => {
    findMany.mockResolvedValue([]);
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;

    expect(await loadStack()).toEqual([]);
  });
});
