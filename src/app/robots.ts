import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search/retrieval crawlers: explicitly allowed on public content.
const SEARCH = [
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "ChatGPT-User",
  "Perplexity-User",
  "Claude-User",
];

// AI training crawlers: owner opts out by default.
const TRAINING = [
  "GPTBot",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Search/retrieval engines may index public content.
      ...SEARCH.map((userAgent) => ({ userAgent, allow: "/" })),
      // Training crawlers are disallowed from the whole site.
      ...TRAINING.map((userAgent) => ({ userAgent, disallow: "/" })),
      // Default policy: allow public pages, block authenticated/app areas.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/console", "/app", "/api"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
