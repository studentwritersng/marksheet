import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CONTENT } from "@/lib/marketing/content";
import { ContentEditorClient } from "./client";

const SECTIONS: { group: string; keys: string[] }[] = [
  {
    group: "Hero",
    keys: ["hero_badge", "hero_headline", "hero_subheadline", "hero_cta", "hero_secondary"],
  },
  {
    group: "Problem framing",
    keys: ["problem_headline", "problem_text", "problem_stat_1", "problem_stat_1_label", "problem_stat_2", "problem_stat_2_label", "problem_stat_3", "problem_stat_3_label"],
  },
  {
    group: "Feature pillars",
    keys: ["pillar_1_title", "pillar_1_desc", "pillar_2_title", "pillar_2_desc", "pillar_3_title", "pillar_3_desc"],
  },
  {
    group: "Differentiators",
    keys: ["diff_1_title", "diff_1_desc", "diff_2_title", "diff_2_desc", "diff_3_title", "diff_3_desc", "diff_4_title", "diff_4_desc"],
  },
  {
    group: "Addon teaser",
    keys: ["addons_headline", "addons_subheadline"],
  },
  {
    group: "Pricing",
    keys: ["pricing_monthly", "pricing_termly", "pricing_note", "pricing_cta"],
  },
  {
    group: "Final CTA",
    keys: ["cta_headline", "cta_subheadline"],
  },
  {
    group: "FAQ",
    keys: ["faq_1_q", "faq_1_a", "faq_2_q", "faq_2_a", "faq_3_q", "faq_3_a", "faq_4_q", "faq_4_a", "faq_5_q", "faq_5_a", "faq_6_q", "faq_6_a"],
  },
];

export default async function ConsoleHomepageContentPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const blocks = await prisma.homepageContentBlock.findMany();

  const blockMap = new Map(blocks.map((b) => [b.sectionKey, b]));

  const grouped = SECTIONS.map((s) => ({
    group: s.group,
    items: s.keys.map((key) => ({
      key,
      defaultContent: DEFAULT_CONTENT[key] ?? "",
      content: blockMap.get(key)?.content ?? null, // null = using default
      isVisible: blockMap.get(key)?.isVisible ?? true,
    })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Homepage Content</h1>
      <p className="text-sm text-white/50 mb-6">
        Edit headline copy, pricing figures, and FAQ answers. Changes go live on the homepage immediately — no deployment needed.
      </p>
      <ContentEditorClient grouped={grouped} />
    </div>
  );
}
