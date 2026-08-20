import { vi, it, expect } from "vitest";
import { generateBlogDraft } from "@/lib/blog/generate";

vi.mock("@/lib/ai/gateway", () => ({
  createCompletion: async () => ({
    content: JSON.stringify({
      titleOptions: ["A", "B"],
      subtitle: "sub",
      excerpt: "excerpt",
      body: "# A\n\nanswer.\n\n## X",
      metaTitle: "A",
      metaDescription: "excerpt",
      tags: ["t1"],
      imagePrompt: "img",
    }),
    model: "mock", promptTokens: 0, completionTokens: 0, latencyMs: 0, mocked: true,
  }),
}));

it("parses the AI JSON draft package", async () => {
  const pkg = await generateBlogDraft({ keyword: "waec registration", targetAudience: "school_admin" });
  expect(pkg.titleOptions).toHaveLength(2);
  expect(pkg.imagePrompt).toBe("img");
});
