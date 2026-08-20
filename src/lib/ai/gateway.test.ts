import { it, expect, vi } from "vitest";
import { createCompletion } from "@/lib/ai/gateway";

vi.mock("@/lib/prisma", () => ({
  prisma: { aiCallLog: { create: vi.fn().mockResolvedValue({}) } },
}));

it("returns a mock blog draft package for blog_generation when AI_MOCK=true", async () => {
  process.env.AI_MOCK = "true";
  const res = await createCompletion({
    taskType: "blog_generation",
    messages: [{ role: "user", content: "Keyword: waec registration" }],
  });
  expect(res.mocked).toBe(true);
  const pkg = JSON.parse(res.content);
  expect(Array.isArray(pkg.titleOptions)).toBe(true);
  expect(typeof pkg.imagePrompt).toBe("string");
});
