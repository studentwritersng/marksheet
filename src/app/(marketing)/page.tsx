import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveLandingStats } from "@/lib/landing-stats";
import { prisma } from "@/lib/prisma";
import { MarketingLandingPage } from "./landing-page";
import { getSchoolByRequestHost } from "@/lib/school-domain";

export const metadata = {
  title: "Marksheet: Run the Whole School Term in One Place",
  description:
    "From syllabus upload to a verified report card. Marksheet runs sessions, terms, CA, exams and results for Nigerian secondary schools, offline-ready and tamper-proof.",
  openGraph: {
    title: "Marksheet: Run the whole school term in one place",
    description:
      "Syllabus, lesson notes, exams, AI grading and verified report cards for Nigerian secondary schools.",
    type: "website",
  },
};

export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  const school = await getSchoolByRequestHost(host);
  if (school) redirect("/login");

  const user = await getCurrentUser();
  if (user) {
    if (user.role === "platform_owner") redirect("/console");
    if (user.role === "referral") redirect("/referral/dashboard");
    redirect("/dashboard");
  }

  const stats = await resolveLandingStats();

  const posts = await prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 3,
    include: { category: true },
  });
  const postVMs = posts.map((p) => ({
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    category: p.category?.name ?? null,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    featuredImageUrl: p.featuredImageUrl ?? null,
  }));

  return (
    <MarketingLandingPage
      stats={stats.map((s) => ({ value: s.value, label: s.label }))}
      posts={postVMs}
    />
  );
}
