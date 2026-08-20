import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGES = [
  { url: "/", desc: "Marksheet — syllabus, exam and result platform for Nigerian secondary schools." },
  { url: "/blog", desc: "Guides for teachers, school owners and parents on exams, results and compliance." },
  { url: "/legal/privacy", desc: "How Marksheet handles personal data (NDPR/GDPR-aligned privacy policy)." },
  { url: "/legal/terms", desc: "Platform terms of service for schools and users." },
];

export async function GET() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "published" },
    select: { slug: true, title: true },
    orderBy: { publishedAt: "desc" },
  });

  const lines: string[] = [];
  lines.push("# Marksheet");
  lines.push("");
  lines.push("Marksheet is a Nigerian secondary school syllabus, lesson-note, examination and result portal.");
  lines.push("");
  lines.push("## High-value pages");
  for (const p of PAGES) {
    lines.push(`- [${p.url}](${SITE_URL}${p.url}): ${p.desc}`);
  }
  lines.push("");
  lines.push("## Published blog posts");
  if (posts.length === 0) {
    lines.push("_No published posts yet._");
  } else {
    for (const post of posts) {
      lines.push(`- [${post.title}](${SITE_URL}/blog/${post.slug})`);
    }
  }
  lines.push("");
  lines.push("Note: this file is curated for AI answer engines; it links only to public, published content.");

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain" },
  });
}
