# Blog System & Google Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the owner-console Blog System (PRD 21) and the public-only Google Analytics integration (PRD 22) in the `marksheet` Next.js app, with AI-assisted draft generation through the existing AI Gateway.

**Architecture:** Blog entities are **platform-level** (owned by the Platform Owner, not per-school — the blog is marketing content). All AI calls go through the existing `createCompletion` gateway (PRD 14); we add a `blog_generation` task type. Console sections (keyword bank, drafts, posts, analytics config) live under `src/app/console/(main)/`. Public blog + GEO files (`robots.txt`, `llms.txt`, `sitemap.xml`) live under the marketing/public route group. GA4 is a single client component injected **only** into public layouts (never the authenticated app or console), gated by a DB-backed `AnalyticsConfig` and Google Consent Mode.

**Tech Stack:** Next.js (App Router, RSC + client components), Prisma + PostgreSQL, TypeScript, existing `src/lib/ai/gateway.ts`, existing `src/lib/secrets.ts` (if any secret storage needed), React client components for console/GA UI, GA4 `gtag.js` snippet.

## Global Constraints

- All AI calls MUST go through `createCompletion` in `src/lib/ai/gateway.ts` — never hardcode a provider SDK, base URL, or model name in feature code (PRD 14 / Platform Def §6.7).
- GA4 MUST load only on public unauthenticated pages (marketing `src/app/(marketing)/`, public blog, and the Result Verification Portal) — NEVER inside the authenticated app or the Platform Owner Console (PRD 22 §2, §4.1).
- GA must never receive student PII: no student name, school name, scores, or verification code in any GA event/parameter/captured URL (PRD 22 §4.1, §6).
- Consent Mode MUST be implemented; declining consent must stop all GA network requests and the site must stay fully usable (PRD 22 §4.2, §5).
- Configuration (GA measurement ID, consent settings, blog data) is **database-backed and console-editable**, not environment variables (PRD 14/15, PRD 22 §3).
- AI-generated blog content MUST NOT auto-publish: flow is `draft → pending_review → published → archived`, with explicit human approval (PRD 21 §3.2, §3.5).
- Multi-tenancy note: the blog/analytics subsystem is platform-owned and global; it does NOT carry `schoolId` (unlike school-scoped features).
- On-page SEO checks surface as **warnings**, never hard blocks; reviewers can override with a reason (PRD 21 §3.3).
- Keyword cannibalization warning is informational only, never blocking (PRD 21 §3.1).
- `llms.txt` is **curated, not auto-dumped**; capped ~20–50 high-value links with context descriptions (PRD 21 §3.4).
- `robots.txt` MUST distinguish training crawlers (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended) from search/retrieval crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot, ChatGPT-User, Perplexity-User, Claude-User) (PRD 21 §3.4).
- Use TDD: write failing tests for pure logic (SEO validation, slug safety, GEO file content) before implementation; commit frequently.

---

## File Structure

**Schema / AI**
- `prisma/schema.prisma` — add `Keyword`, `BlogCategory`, `BlogPost`, `AiBlogDraftRequest`, `AnalyticsConfig`, `ConversionEventDefinition` models.
- `prisma/migrations/` — generated migration (run `prisma migrate dev`).
- `src/lib/ai/gateway.ts` — add `"blog_generation"` to `AiTaskType` + mock branch.

**Blog logic (lib)**
- `src/lib/blog/types.ts` — shared TS types for blog entities + draft package.
- `src/lib/blog/seo.ts` — pure `validateBlogSeo(post)` + `slugify()` + `isUrlSafeSlug()`.
- `src/lib/blog/seo.test.ts` — unit tests for the above.
- `src/lib/blog/generate.ts` — `generateBlogDraft(input)` calling `createCompletion`; parses the returned JSON draft package.
- `src/lib/blog/generate.test.ts` — mock `createCompletion` to assert prompt shape + parse.

**Console (owner) UI + actions**
- `src/app/console/(main)/sidebar.tsx` — add "Blog" and "Analytics" nav items.
- `src/app/console/(main)/blog/page.tsx` + `blog-client.tsx` — keyword bank table + post pipeline view.
- `src/app/console/(main)/blog/keywords/actions.ts` — keyword + category CRUD server actions.
- `src/app/console/(main)/blog/drafts/actions.ts` — `requestBlogDraftAction`, `publishBlogPostAction`, `updateBlogPostAction`.
- `src/app/console/(main)/blog/[id]/page.tsx` + editor client — post editor with SEO warnings + AI generate button.
- `src/app/console/(main)/analytics/page.tsx` + `analytics-client.tsx` — `AnalyticsConfig` + conversion event editor.
- `src/app/console/(main)/analytics/actions.ts` — config save action.

**Public blog + GEO**
- `src/app/(marketing)/blog/page.tsx` — post list (published only).
- `src/app/(marketing)/blog/[slug]/page.tsx` — post view with schema.org JSON-LD (`BlogPosting`/`Article`/`FAQPage`).
- `src/app/(marketing)/layout.tsx` — mount `<PublicAnalytics />` (the ONLY GA injection point for marketing).
- `src/app/(marketing)/robots.txt/route.ts` — dynamic robots with training vs search crawler rules.
- `src/app/(marketing)/llms.txt/route.ts` — curated llms.txt.
- `src/app/(marketing)/sitemap.xml/route.ts` — sitemap incl. published posts (or extend existing sitemap if present).

**GA**
- `src/components/analytics/PublicAnalytics.tsx` — client component: Consent Mode + gtag loader, reads config from props, fires conversion events.
- `src/lib/analytics/events.ts` — typed `trackEvent(name, params)` + predefined converters (`trackDemoRequest`, `trackBlogRead`, `trackVerificationLookup`).
- `src/app/(marketing)/layout.tsx` — fetch `AnalyticsConfig` server-side, pass to `<PublicAnalytics />`.

---

## Task 1: Prisma schema — blog + analytics entities

**Files:**
- Modify: `prisma/schema.prisma`
- Test: none (schema); verify via `prisma validate` + migration.

**Interfaces:** (none — foundational)

- [ ] **Step 1: Add models to `prisma/schema.prisma`**

Append these models (inside the existing file, after a logical group):

```prisma
// ---- PRD 21: Blog System (platform-owned marketing content) ----
model Keyword {
  id             String   @id @default(cuid())
  keywordText    String
  type           String   @default("short_tail") // short_tail | long_tail
  searchIntent   String   @default("informational") // informational | commercial | comparison
  targetAudience String   @default("general") // teacher | school_admin | proprietor | parent | general
  status         String   @default("planned") // planned | assigned | published | ranking
  priority       Int      @default(0)
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  posts          BlogPost[]

  @@index([status])
}

model BlogCategory {
  id    String @id @default(cuid())
  name  String
  slug  String @unique
  posts BlogPost[]
}

model BlogPost {
  id                    String   @id @default(cuid())
  title                 String
  subtitle              String?
  slug                  String   @unique
  excerpt               String?
  body                  String   @db.Text // markdown / rich text
  status                String   @default("draft") // draft | pending_review | published | archived
  primaryKeywordId      String?
  secondaryKeywordIds   Json? // string[]
  tags                  Json? // string[]
  categoryId            String?
  metaTitle             String?
  metaDescription       String?
  canonicalUrl          String?
  featuredImageUrl      String?
  featuredImageAltText  String?
  schemaType            String   @default("BlogPosting") // BlogPosting | Article | FAQPage
  source                String   @default("manual") // manual | ai_generated
  author                String?
  publishedAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  primaryKeyword        Keyword? @relation(fields: [primaryKeywordId], references: [id])
  category              BlogCategory? @relation(fields: [categoryId], references: [id])

  @@index([status])
  @@index([publishedAt])
}

model AiBlogDraftRequest {
  id                       String   @id @default(cuid())
  keywordId                String?
  topicText                String?
  targetAudience           String?
  requestedBy              String?
  status                   String   @default("pending") // pending | completed | failed
  generatedTitleOptions   Json? // string[]
  generatedSubtitle        String?
  generatedExcerpt         String?
  generatedBody            String? @db.Text
  generatedMetaTitle       String?
  generatedMetaDescription String?
  generatedTags            Json? // string[]
  generatedImagePrompt     String?
  createdAt                DateTime @default(now())

  @@index([status])
}

// ---- PRD 22: Google Analytics (platform-owned config) ----
model AnalyticsConfig {
  id                 String   @id @default(cuid())
  ga4MeasurementId   String?
  consentModeEnabled Boolean  @default(true)
  isActive           Boolean  @default(false)
  updatedAt          DateTime @updatedAt
}

model ConversionEventDefinition {
  id              String   @id @default(cuid())
  eventName       String   @unique // e.g. demo_request_submitted
  ga4EventMapping String
  isActive        Boolean  @default(true)
}
```

- [ ] **Step 2: Validate and migrate**

Run: `npx prisma validate && npx prisma migrate dev --name add_blog_and_analytics`
Expected: schema validates; migration created; tables exist.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(blog): add Keyword, BlogCategory, BlogPost, AiBlogDraftRequest, AnalyticsConfig, ConversionEventDefinition models"
```

---

## Task 2: Extend AI Gateway with `blog_generation` task type

**Files:**
- Modify: `src/lib/ai/gateway.ts`
- Test: `src/lib/ai/gateway.test.ts` (add a mock-return assertion for blog_generation)

**Interfaces:**
- Consumes: existing `createCompletion(opts: AiCompletionOptions): Promise<AiCompletionResult>`.
- Produces: `AiTaskType` now includes `"blog_generation"` so `generateBlogDraft` (Task 4) can call `createCompletion({ taskType: "blog_generation", ... })`.

- [ ] **Step 1: Add the union member**

In `src/lib/ai/gateway.ts` change:
```ts
export type AiTaskType =
  | "lesson_note_generation"
  | "question_generation"
  | "essay_grading"
  | "comment_drafting"
  | "curriculum_parsing"
  | "quiz_generation"
  | "blog_generation";
```

- [ ] **Step 2: Add a mock branch in `mockCompletion`**

Inside `mockCompletion`, before the generic fallback, add:
```ts
if (task === "blog_generation") {
  return {
    content: JSON.stringify({
      titleOptions: ["Sample SEO Title Under 60", "Another Angle On The Topic", "A Practical Guide For Schools"],
      subtitle: "A clear subtitle that sets reader expectations.",
      excerpt: "A 150-char excerpt answering the core question up front for search and AI engines.",
      body: "# Sample SEO Title Under 60\n\nThe direct answer paragraph goes here within the first two sentences.\n\n## Section Two\nMore detail with an internal link to /features and an external citation.",
      metaTitle: "Sample SEO Title Under 60",
      metaDescription: "A 150-char excerpt answering the core question up front for search and AI engines.",
      tags: ["seo", "nigerian schools"],
      imagePrompt: "Editorial photo, Nigerian secondary school classroom, warm natural light, brand colors #002046 and #1e3a5f, clean composition, no text.",
    }),
    model: "mock",
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 0,
    mocked: true,
  };
}
```
Note: the real model is expected to return a JSON object; `generateBlogDraft` (Task 4) parses it. The mock returns valid JSON so tests pass without a provider.

- [ ] **Step 3: Add a test asserting the mock path**

In `src/lib/ai/gateway.test.ts` add:
```ts
import { createCompletion } from "@/lib/ai/gateway";

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
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/lib/ai/gateway.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/gateway.ts src/lib/ai/gateway.test.ts
git commit -m "feat(ai): add blog_generation task type with mock draft package"
```

---

## Task 3: SEO validation + slug utilities (pure, tested)

**Files:**
- Create: `src/lib/blog/types.ts`, `src/lib/blog/seo.ts`, `src/lib/blog/seo.test.ts`

**Interfaces:**
- Produces: `validateBlogSeo(post): SeoWarning[]`, `slugify(input): string`, `isUrlSafeSlug(s): boolean`, and the `BlogPostSeoInput` type consumed by the editor (Task 7) and the publish action.

- [ ] **Step 1: Write the failing tests**

`src/lib/blog/seo.test.ts`:
```ts
import { validateBlogSeo, slugify, isUrlSafeSlug } from "@/lib/blog/seo";

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("WAEC Registration: A Guide for 2026!")).toBe("waec-registration-a-guide-for-2026");
  });
});
describe("isUrlSafeSlug", () => {
  it("rejects spaces and uppercase", () => {
    expect(isUrlSafeSlug("Bad Slug")).toBe(false);
    expect(isUrlSafeSlug("good-slug-2026")).toBe(true);
  });
});
describe("validateBlogSeo", () => {
  const base = {
    title: "WAEC Registration Guide",
    slug: "waec-registration-guide",
    metaTitle: "WAEC Registration Guide",
    metaDescription: "x".repeat(155),
    excerpt: "answer up front",
    body: "# WAEC Registration Guide\n\nDirect answer here.\n\n## H2",
    featuredImageAltText: "alt",
    internalLinkCount: 2,
    primaryKeyword: "waec registration",
  };
  it("returns no warnings for a clean post", () => {
    expect(validateBlogSeo(base)).toEqual([]);
  });
  it("warns on meta title > 60 chars", () => {
    const w = validateBlogSeo({ ...base, metaTitle: "x".repeat(61) });
    expect(w.some((x) => x.code === "META_TITLE_LONG")).toBe(true);
  });
  it("warns on missing image alt", () => {
    const w = validateBlogSeo({ ...base, featuredImageAltText: "" });
    expect(w.some((x) => x.code === "MISSING_IMG_ALT")).toBe(true);
  });
  it("warns on zero internal links", () => {
    const w = validateBlogSeo({ ...base, internalLinkCount: 0 });
    expect(w.some((x) => x.code === "NO_INTERNAL_LINKS")).toBe(true);
  });
  it("warns when keyword absent from title/H1/opening", () => {
    const w = validateBlogSeo({ ...base, title: "Other Title", body: "# Other Title\n\nDifferent opening.", primaryKeyword: "waec registration" });
    expect(w.some((x) => x.code === "KEYWORD_MISSING")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run src/lib/blog/seo.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`src/lib/blog/types.ts`:
```ts
export interface BlogPostSeoInput {
  title: string;
  slug: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  excerpt?: string | null;
  body: string;
  featuredImageAltText?: string | null;
  internalLinkCount: number;
  primaryKeyword?: string | null;
}

export interface SeoWarning {
  code: string;
  message: string;
  severity: "warning";
}
```

`src/lib/blog/seo.ts`:
```ts
import type { BlogPostSeoInput, SeoWarning } from "./types";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function isUrlSafeSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

function firstParagraph(text: string): string {
  const md = text.replace(/^#.*$/m, ""); // drop H1 line
  const para = md.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p.length > 0);
  return para ?? "";
}

function countInternalLinks(body: string): number {
  const matches = body.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g) ?? [];
  return matches.filter((m) => !/^\[[^\]]+\]\((https?:\/\/(?:www\.)?(?:waec|neco|gov)\.)/i.test(m)).length;
}

export function validateBlogSeo(p: BlogPostSeoInput): SeoWarning[] {
  const warnings: SeoWarning[] = [];
  const metaTitle = p.metaTitle ?? p.title;
  if (metaTitle.length > 60) warnings.push({ code: "META_TITLE_LONG", message: `Meta title is ${metaTitle.length} chars (>60).`, severity: "warning" });
  const metaDesc = p.metaDescription ?? p.excerpt ?? "";
  if (metaDesc.length > 160) warnings.push({ code: "META_DESC_LONG", message: `Meta description is ${metaDesc.length} chars (>160).`, severity: "warning" });
  if (!p.featuredImageAltText) warnings.push({ code: "MISSING_IMG_ALT", message: "Featured image alt text is missing.", severity: "warning" });
  if (p.internalLinkCount === 0) warnings.push({ code: "NO_INTERNAL_LINKS", message: "No internal links detected in body.", severity: "warning" });
  if (!isUrlSafeSlug(p.slug)) warnings.push({ code: "SLUG_UNSAFE", message: "Slug is not URL-safe.", severity: "warning" });
  if (p.primaryKeyword) {
    const kw = p.primaryKeyword.toLowerCase();
    const h1 = (p.body.match(/^#\s+(.+)$/m)?.[1] ?? "").toLowerCase();
    const opening = firstParagraph(p.body).toLowerCase();
    const inTitle = p.title.toLowerCase().includes(kw);
    const inH1 = h1.includes(kw);
    const inOpening = opening.includes(kw);
    if (!inTitle && !inH1 && !inOpening) warnings.push({ code: "KEYWORD_MISSING", message: "Primary keyword not found in title, H1, or opening paragraph.", severity: "warning" });
  }
  return warnings;
}
```
Note: `countInternalLinks` is a helper exported separately if needed; the editor computes `internalLinkCount` from the body before calling `validateBlogSeo`. (Keep the count derivation in the editor to keep this pure.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/blog/seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/types.ts src/lib/blog/seo.ts src/lib/blog/seo.test.ts
git commit -m "feat(blog): add SEO validation + slug utilities with tests"
```

---

## Task 4: AI draft generation service

**Files:**
- Create: `src/lib/blog/generate.ts`, `src/lib/blog/generate.test.ts`

**Interfaces:**
- Consumes: `createCompletion({ taskType: "blog_generation", messages, schoolId? })`.
- Produces: `generateBlogDraft(input: BlogDraftInput): Promise<BlogDraftPackage>` used by the console draft action (Task 6).

- [ ] **Step 1: Write the test (mock createCompletion)**

`src/lib/blog/generate.test.ts`:
```ts
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
```
Run: `npx vitest run src/lib/blog/generate.test.ts` → FAIL (not implemented).

- [ ] **Step 2: Implement `generate.ts`**

```ts
import { createCompletion } from "@/lib/ai/gateway";

export interface BlogDraftInput {
  keyword?: string;
  topic?: string;
  targetAudience: string;
}

export interface BlogDraftPackage {
  titleOptions: string[];
  subtitle: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  imagePrompt: string;
}

const SYSTEM = `You are an SEO and GEO (generative-engine-optimization) copywriter for Marksheet, a Nigerian secondary school syllabus/exam/result platform. Produce a JSON object ONLY (no prose) with keys: titleOptions (array of 3-5 strings, each <60 chars, primary keyword placed naturally), subtitle (string), excerpt (string 150-160 chars, also usable as meta description), body (markdown: exactly one H1 matching the chosen title, H2/H3 hierarchy, natural keyword use, 2-3 internal links to real existing site pages like /features, /pricing, /result-verification written as [label](/path), external citations to authoritative sources like WAEC/NECO/government where factual claims are made, and a clear self-contained direct-answer paragraph within the first 2-3 sentences), metaTitle (string <60 chars), metaDescription (string 150-160 chars), tags (array of strings), imagePrompt (a complete structured image-generation prompt: subject, composition, style, brand colors #002046 and #1e3a5f — not vague).`;

function extractJson(content: string): any {
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : content;
  try { return JSON.parse(raw.trim()); } catch { return {}; }
}

export async function generateBlogDraft(input: BlogDraftInput): Promise<BlogDraftPackage> {
  const focus = input.keyword ? `keyword "${input.keyword}"` : `topic "${input.topic ?? ""}"`;
  const user = `Target audience: ${input.targetAudience}. Write about ${focus}. Return ONLY the JSON object.`;
  const res = await createCompletion({
    taskType: "blog_generation",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });
  const j = extractJson(res.content);
  return {
    titleOptions: Array.isArray(j.titleOptions) ? j.titleOptions : [],
    subtitle: j.subtitle ?? "",
    excerpt: j.excerpt ?? "",
    body: j.body ?? "",
    metaTitle: j.metaTitle ?? "",
    metaDescription: j.metaDescription ?? "",
    tags: Array.isArray(j.tags) ? j.tags : [],
    imagePrompt: j.imagePrompt ?? "",
  };
}
```

- [ ] **Step 3: Run test**

Run: `npx vitest run src/lib/blog/generate.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/blog/generate.ts src/lib/blog/generate.test.ts
git commit -m "feat(blog): AI draft generation service via gateway"
```

---

## Task 5: Console keyword bank + categories (CRUD)

**Files:**
- Create: `src/app/console/(main)/blog/keywords/actions.ts`
- Create: `src/app/console/(main)/blog/page.tsx`, `src/app/console/(main)/blog/blog-client.tsx`
- Modify: `src/app/console/(main)/sidebar.tsx`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`; `canManageSchool`/owner guard from `@/lib/auth/permissions` (use the existing console owner guard pattern — see `src/app/console/(main)/schools/actions.ts` for the auth idiom).
- Produces: keyword/category rows rendered by `blog-client.tsx`.

- [ ] **Step 1: Keyword + category server actions**

`src/app/console/(main)/blog/keywords/actions.ts`:
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function upsertKeywordAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = formData.get("id") as string | null;
  const data = {
    keywordText: String(formData.get("keywordText") ?? ""),
    type: String(formData.get("type") ?? "short_tail"),
    searchIntent: String(formData.get("searchIntent") ?? "informational"),
    targetAudience: String(formData.get("targetAudience") ?? "general"),
    status: String(formData.get("status") ?? "planned"),
    priority: Number(formData.get("priority") ?? 0),
    notes: formData.get("notes") ? String(formData.get("notes")) : null,
  };
  if (!data.keywordText) return { ok: false, error: "keywordText required" };
  await prisma.keyword.upsert({
    where: { id: id ?? "___new___" },
    create: data,
    update: data,
  });
  revalidatePath("/console/blog");
  return { ok: true };
}

export async function deleteKeywordAction(formData: FormData): Promise<{ ok: boolean }> {
  await prisma.keyword.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/console/blog");
  return { ok: true };
}

export async function upsertCategoryAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = formData.get("id") as string | null;
  const name = String(formData.get("name") ?? "");
  if (!name) return { ok: false, error: "name required" };
  await prisma.blogCategory.upsert({
    where: { id: id ?? "___new___" },
    create: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
    update: { name },
  });
  revalidatePath("/console/blog");
  return { ok: true };
}
```

- [ ] **Step 2: Console page + client**

`src/app/console/(main)/blog/page.tsx` (server component) loads keywords + categories + post pipeline counts and passes to client:
```tsx
import { prisma } from "@/lib/prisma";
import { BlogClient } from "./blog-client";

export default async function BlogPage() {
  const [keywords, categories, posts] = await Promise.all([
    prisma.keyword.findMany({ orderBy: [{ priority: "desc" }, { keywordText: "asc" }] }),
    prisma.blogCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" }, include: { primaryKeyword: true, category: true } }),
  ]);
  return <BlogClient keywords={keywords} categories={categories} posts={posts} />;
}
```
`blog-client.tsx`: render a keyword table (text, type, intent, audience, status badge, priority), an "Add keyword" form posting to `upsertKeywordAction`, category manager posting to `upsertCategoryAction`, and a pipeline summary (counts of draft/pending_review/published). Keep it a single client component using `useActionState`/plain `fetch` to the server actions. Mirror the styling of `src/app/console/(main)/schools/client.tsx`.

- [ ] **Step 3: Add nav item**

In `src/app/console/(main)/sidebar.tsx` `navItems` add:
```ts
{ label: "Blog", href: "/console/blog", icon: "article" },
```

- [ ] **Step 4: Typecheck + manual smoke**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. Manually: visit `/console/blog`, add a keyword, see it in the table.

- [ ] **Step 5: Commit**

```bash
git add src/app/console/\(main\)/blog
git commit -m "feat(blog): console keyword bank + category management"
```

---

## Task 6: Console draft generation + publish pipeline actions

**Files:**
- Create: `src/app/console/(main)/blog/drafts/actions.ts`

**Interfaces:**
- Consumes: `generateBlogDraft` (Task 4), `prisma`, `slugify` (Task 3).
- Produces: `requestBlogDraftAction` (creates `AiBlogDraftRequest`, calls generation, returns the package for the editor), `saveBlogPostAction` (upsert `BlogPost`, status `draft`), `submitForReviewAction` (status `pending_review`), `publishBlogPostAction` (status `published`, sets `publishedAt`), `archiveBlogPostAction`.

- [ ] **Step 1: Implement actions**

`src/app/console/(main)/blog/drafts/actions.ts`:
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateBlogDraft } from "@/lib/blog/generate";
import { slugify } from "@/lib/blog/seo";

export async function requestBlogDraftAction(formData: FormData): Promise<{ ok: boolean; pkg?: any; error?: string }> {
  const keyword = formData.get("keyword") ? String(formData.get("keyword")) : undefined;
  const topic = formData.get("topic") ? String(formData.get("topic")) : undefined;
  const targetAudience = String(formData.get("targetAudience") ?? "general");
  if (!keyword && !topic) return { ok: false, error: "keyword or topic required" };
  try {
    const pkg = await generateBlogDraft({ keyword, topic, targetAudience });
    const req = await prisma.aiBlogDraftRequest.create({
      data: {
        keywordId: formData.get("keywordId") ? String(formData.get("keywordId")) : null,
        topicText: topic,
        targetAudience,
        status: "completed",
        generatedTitleOptions: pkg.titleOptions,
        generatedSubtitle: pkg.subtitle,
        generatedExcerpt: pkg.excerpt,
        generatedBody: pkg.body,
        generatedMetaTitle: pkg.metaTitle,
        generatedMetaDescription: pkg.metaDescription,
        generatedTags: pkg.tags,
        generatedImagePrompt: pkg.imagePrompt,
      },
    });
    return { ok: true, pkg: { ...pkg, requestId: req.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveBlogPostAction(formData: FormData): Promise<{ ok: boolean; id?: string; error?: string }> {
  const id = formData.get("id") as string | null;
  const title = String(formData.get("title") ?? "");
  if (!title) return { ok: false, error: "title required" };
  const slug = slugify(formData.get("slug") ? String(formData.get("slug")) : title);
  const data = {
    title,
    subtitle: formData.get("subtitle") ? String(formData.get("subtitle")) : null,
    slug,
    excerpt: formData.get("excerpt") ? String(formData.get("excerpt")) : null,
    body: String(formData.get("body") ?? ""),
    status: String(formData.get("status") ?? "draft"),
    primaryKeywordId: formData.get("primaryKeywordId") ? String(formData.get("primaryKeywordId")) : null,
    categoryId: formData.get("categoryId") ? String(formData.get("categoryId")) : null,
    metaTitle: formData.get("metaTitle") ? String(formData.get("metaTitle")) : null,
    metaDescription: formData.get("metaDescription") ? String(formData.get("metaDescription")) : null,
    featuredImageUrl: formData.get("featuredImageUrl") ? String(formData.get("featuredImageUrl")) : null,
    featuredImageAltText: formData.get("featuredImageAltText") ? String(formData.get("featuredImageAltText")) : null,
    tags: formData.get("tags") ? JSON.parse(String(formData.get("tags"))) : null,
    schemaType: String(formData.get("schemaType") ?? "BlogPosting"),
    source: String(formData.get("source") ?? "manual"),
    author: formData.get("author") ? String(formData.get("author")) : null,
  };
  const post = await prisma.blogPost.upsert({
    where: { id: id ?? "___new___" },
    create: { ...data, publishedAt: data.status === "published" ? new Date() : null },
    update: { ...data, publishedAt: data.status === "published" ? new Date() : undefined },
  });
  revalidatePath("/console/blog");
  revalidatePath(`/console/blog/${post.id}`);
  return { ok: true, id: post.id };
}

export async function setPostStatusAction(formData: FormData): Promise<{ ok: boolean }> {
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const update: any = { status };
  if (status === "published") update.publishedAt = new Date();
  await prisma.blogPost.update({ where: { id }, data: update });
  revalidatePath("/console/blog");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/console/\(main\)/blog/drafts/actions.ts
git commit -m "feat(blog): console draft generation + post save/status actions"
```

---

## Task 7: Console post editor with SEO warnings

**Files:**
- Create: `src/app/console/(main)/blog/[id]/page.tsx`, `src/app/console/(main)/blog/[id]/editor-client.tsx`

**Interfaces:**
- Consumes: `saveBlogPostAction`, `setPostStatusAction`, `requestBlogDraftAction` (Tasks 4,6); `validateBlogSeo` (Task 3); keywords + categories loaded server-side.
- Produces: a publishable `BlogPost`.

- [ ] **Step 1: Editor page (server)**

```tsx
import { prisma } from "@/lib/prisma";
import { EditorClient } from "./editor-client";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
  if (!post) return <p>Not found</p>;
  const [keywords, categories] = await Promise.all([
    prisma.keyword.findMany({ orderBy: { keywordText: "asc" } }),
    prisma.blogCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  return <EditorClient post={post} keywords={keywords} categories={categories} />;
}
```

- [ ] **Step 2: Editor client**

`editor-client.tsx` (client) holds form state for all `BlogPost` fields, an "Generate AI draft" button calling `requestBlogDraftAction` and populating title/subtitle/body/meta/tags/imagePrompt, a live "SEO check" panel calling `validateBlogSeo` on the current values and listing warnings, a status selector (draft / pending_review / published / archived) and Save/Submit/Publish buttons. Render SEO warnings as non-blocking alerts. Mirror form styling from `src/app/console/(main)/schools/school-actions.tsx` or an existing console form.

- [ ] **Step 3: Typecheck + manual**

Run: `npx tsc --noEmit -p tsconfig.json`. Manually: open a post, click Generate, confirm fields populate and SEO warnings show.

- [ ] **Step 4: Commit**

```bash
git add "src/app/console/(main)/blog/[id]"
git commit -m "feat(blog): console post editor with live SEO warnings and publish pipeline"
```

---

## Task 8: Public blog list + post page with structured data

**Files:**
- Create: `src/app/(marketing)/blog/page.tsx`, `src/app/(marketing)/blog/[slug]/page.tsx`
- Modify: `src/app/(marketing)/layout.tsx` (Task 14 mounts analytics)

**Interfaces:**
- Consumes: `prisma.blogPost.findMany({ where: { status: "published" } })`, `validateBlogSeo` optionally for debugging.
- Produces: public-facing blog; the `[slug]` page emits schema.org JSON-LD.

- [ ] **Step 1: List page**

`src/app/(marketing)/blog/page.tsx` (server):
```tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function BlogList() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    include: { category: true },
  });
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Marksheet Blog</h1>
      <ul className="mt-6 space-y-4">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/blog/${p.slug}`} className="text-xl font-semibold hover:underline">{p.title}</Link>
            {p.excerpt && <p className="text-sm text-slate-500">{p.excerpt}</p>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Post page with JSON-LD**

`src/app/(marketing)/blog/[slug]/page.tsx` (server):
```tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post || post.status !== "published") notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": post.schemaType === "FAQPage" ? "FAQPage" : post.schemaType === "Article" ? "Article" : "BlogPosting",
    headline: post.title,
    ...(post.subtitle ? { alternativeHeadline: post.subtitle } : {}),
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(post.featuredImageUrl ? { image: post.featuredImageUrl } : {}),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
    ...(post.canonicalUrl ? { mainEntityOfPage: post.canonicalUrl } : {}),
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-3xl font-bold">{post.title}</h1>
      {post.subtitle && <p className="text-lg text-slate-500">{post.subtitle}</p>}
      {post.featuredImageUrl && <img src={post.featuredImageUrl} alt={post.featuredImageAltText ?? ""} className="my-4 rounded-lg" />}
      <article className="prose mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
    </main>
  );
}
```
Add a minimal `renderMarkdown` (or reuse an existing markdown renderer if the repo has one — search `markdown`/`react-markdown` in `package.json`; if present, use it instead of a hand-rolled function). For v1 a tiny markdown-to-HTML for headings/paragraphs/links is acceptable, but prefer an existing library to avoid XSS. If none exists, add `react-markdown` and use it.

- [ ] **Step 3: Typecheck + manual**

Run: `npx tsc --noEmit -p tsconfig.json`. Manually: publish a post in console, visit `/blog` and `/blog/<slug>`, view source for `application/ld+json`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/blog"
git commit -m "feat(blog): public blog list + post page with schema.org JSON-LD"
```

---

## Task 9: GEO files — robots.txt, llms.txt, sitemap.xml

**Files:**
- Create: `src/app/(marketing)/robots.txt/route.ts`
- Create: `src/app/(marketing)/llms.txt/route.ts`
- Create/Modify: `src/app/(marketing)/sitemap.xml/route.ts`

**Interfaces:**
- Produces: publicly served `https://<site>/robots.txt`, `/llms.txt`, `/sitemap.xml`.

- [ ] **Step 1: robots.txt (training vs search/retrieval crawlers)**

`src/app/(marketing)/robots.txt/route.ts`:
```ts
import { NextResponse } from "next/server";

const TRAINING = ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended"];
const SEARCH = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "ChatGPT-User", "Perplexity-User", "Claude-User"];

export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [];
  // Search/retrieval crawlers: explicitly allowed on public content.
  for (const b of SEARCH) {
    lines.push(`User-agent: ${b}`);
    lines.push(`Allow: /`);
    lines.push(``);
  }
  // Training crawlers: opt-in/opt-out is an explicit owner choice; default to disallow.
  for (const b of TRAINING) {
    lines.push(`User-agent: ${b}`);
    lines.push(`Disallow: /`);
    lines.push(``);
  }
  lines.push(`User-agent: *`);
  lines.push(`Allow: /`);
  lines.push(`Sitemap: ${process.env.NEXT_PUBLIC_SITE_URL ?? "https://marksheet.dev"}/sitemap.xml`);
  return new NextResponse(lines.join("\n"), { headers: { "Content-Type": "text/plain" } });
}
```

- [ ] **Step 2: llms.txt (curated, not auto-dumped)**

`src/app/(marketing)/llms.txt/route.ts`:
```ts
import { NextResponse } from "next/server";

export const dynamic = "force-static";

const LINKS = [
  { url: "/", desc: "Marksheet — syllabus, exam and result platform for Nigerian secondary schools." },
  { url: "/features", desc: "Explains our AI grading rubric system and exam delivery." },
  { url: "/result-verification", desc: "Public portal to verify the authenticity of a student result." },
  { url: "/blog", desc: "Guides for teachers, school owners and parents on exams, results and compliance." },
];

export function GET() {
  const body = [
    "# Marksheet",
    "",
    "Marksheet is a Nigerian secondary school syllabus, lesson-note, examination and result portal.",
    "",
    "## High-value pages",
    ...LINKS.map((l) => `- [${l.url}](${process.env.NEXT_PUBLIC_SITE_URL ?? "https://marksheet.dev"}${l.url}): ${l.desc}`),
    "",
    "Note: this file is curated by hand for AI answer engines; it is not an auto-dumped sitemap.",
  ].join("\n");
  return new NextResponse(body, { headers: { "Content-Type": "text/plain" } });
}
```
(Extend `LINKS` with top published posts at runtime later; for v1 a curated constant satisfies PRD 21 §3.4. A future task can make it console-editable.)

- [ ] **Step 3: sitemap.xml**

Create `src/app/(marketing)/sitemap.xml/route.ts` (or merge into an existing sitemap if `src/app/sitemap.ts`/similar exists — check first; if it exists, add blog entries there instead):
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marksheet.dev";
  const posts = await prisma.blogPost.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true } });
  const urls = [
    `<url><loc>${base}/</loc></url>`,
    `<url><loc>${base}/blog</loc></url>`,
    ...posts.map((p) => `<url><loc>${base}/blog/${p.slug}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`),
  ].join("");
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { "Content-Type": "application/xml" },
  });
}
```

- [ ] **Step 4: Verify routes**

Run `npm run build` (or start dev and curl): `curl /robots.txt` shows separate training/search blocks; `curl /llms.txt` shows curated list; `curl /sitemap.xml` shows posts.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(marketing)/robots.txt" "src/app/(marketing)/llms.txt" "src/app/(marketing)/sitemap.xml"
git commit -m "feat(blog): GEO files robots.txt (training vs search), curated llms.txt, sitemap.xml"
```

---

## Task 10: GA4 config + console UI (PRD 22)

**Files:**
- Create: `src/app/console/(main)/analytics/actions.ts`, `src/app/console/(main)/analytics/page.tsx`, `src/app/console/(main)/analytics/analytics-client.tsx`
- Modify: `src/app/console/(main)/sidebar.tsx` (add "Analytics" nav)

**Interfaces:**
- Consumes: `prisma` `AnalyticsConfig` (single row, upsert by a known id or first()), `ConversionEventDefinition`.
- Produces: console-editable GA config; the saved `ga4MeasurementId`/`consentModeEnabled`/`isActive` is read by `PublicAnalytics` (Task 11).

- [ ] **Step 1: Config actions**

`src/app/console/(main)/analytics/actions.ts`:
```ts
"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const CONFIG_ID = "platform-analytics";

export async function saveAnalyticsConfigAction(formData: FormData): Promise<{ ok: boolean }> {
  const ga4MeasurementId = formData.get("ga4MeasurementId") ? String(formData.get("ga4MeasurementId")) : null;
  const consentModeEnabled = formData.get("consentModeEnabled") === "on";
  const isActive = formData.get("isActive") === "on";
  await prisma.analyticsConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ga4MeasurementId, consentModeEnabled, isActive },
    update: { ga4MeasurementId, consentModeEnabled, isActive },
  });
  revalidatePath("/console/analytics");
  return { ok: true };
}

export async function saveConversionEventAction(formData: FormData): Promise<{ ok: boolean }> {
  const eventName = String(formData.get("eventName") ?? "");
  const ga4EventMapping = String(formData.get("ga4EventMapping") ?? "");
  if (!eventName) return { ok: false, error: "eventName required" } as any;
  const isActive = formData.get("isActive") === "on";
  await prisma.conversionEventDefinition.upsert({
    where: { eventName },
    create: { eventName, ga4EventMapping, isActive },
    update: { ga4EventMapping, isActive },
  });
  revalidatePath("/console/analytics");
  return { ok: true };
}
```

- [ ] **Step 2: Console page + client**

`src/app/console/(main)/analytics/page.tsx` (server) loads the single `AnalyticsConfig` + `ConversionEventDefinition` list and renders `AnalyticsClient`. `analytics-client.tsx` provides a form for measurement ID, consent-mode toggle, active toggle (posts to `saveAnalyticsConfigAction`), and a table to manage conversion events (seed defaults: `demo_request_submitted`, `blog_read_75_percent`, `verification_lookup_performed`). Add nav item `{ label: "Analytics", href: "/console/analytics", icon: "insights" }` to the sidebar.

- [ ] **Step 3: Typecheck + manual**

Run: `npx tsc --noEmit -p tsconfig.json`. Manually: set a measurement ID + active, save, confirm row persists.

- [ ] **Step 4: Commit**

```bash
git add src/app/console/\(main\)/analytics
git commit -m "feat(analytics): console-editable GA4 config + conversion event definitions"
```

---

## Task 11: Public GA4 script + Consent Mode (structural scope enforcement)

**Files:**
- Create: `src/components/analytics/PublicAnalytics.tsx`, `src/lib/analytics/events.ts`
- Modify: `src/app/(marketing)/layout.tsx` (fetch `AnalyticsConfig`, render `<PublicAnalytics />`)

**Interfaces:**
- Consumes: `AnalyticsConfig` (from DB via the marketing layout server component).
- Produces: GA script loads ONLY in marketing/public pages; `trackEvent` helpers used by marketing/verification.

CRITICAL (PRD 22 §2, §4.1): this component is imported **only** by `src/app/(marketing)/layout.tsx` (and the public blog + verification portal layouts if separate). It is NEVER imported by the authenticated app or the console layout. This structural boundary is the enforcement.

- [ ] **Step 1: Events helper**

`src/lib/analytics/events.ts`:
```ts
"use client";
import { CONVERSION_EVENTS } from "./events-config";

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !(window as any).gtag) return;
  (window as any).gtag("event", name, params);
}

// NDPR-safe: NO student/school/score/verification-code values allowed.
export function trackDemoRequest() {
  trackEvent("demo_request_submitted");
}
export function trackBlogRead(slug: string) {
  trackEvent("blog_read_75_percent", { post: slug });
}
export function trackVerificationLookup(success: boolean) {
  // Only aggregate success flag — never the code, name, school, or score.
  trackEvent("verification_lookup_performed", { success });
}
```

- [ ] **Step 2: PublicAnalytics component (consent mode)**

`src/components/analytics/PublicAnalytics.tsx`:
```tsx
"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/events";

export function PublicAnalytics({ measurementId, consentModeEnabled, isActive }: {
  measurementId: string | null;
  consentModeEnabled: boolean;
  isActive: boolean;
}) {
  useEffect(() => {
    if (!isActive || !measurementId) return;
    // Consent Mode default: denied until/unless the visitor accepts.
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).gtag = function () { (window as any).dataLayer.push(arguments); };
    (window as any).gtag("consent", "default", {
      analytics_storage: consentModeEnabled ? "denied" : "denied",
      ad_storage: "denied",
    });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(s);
    (window as any).gtag("js", new Date());
    (window as any).gtag("config", measurementId);
    // If consent disabled entirely, do not grant storage.
    if (!consentModeEnabled) {
      (window as any).gtag("consent", "update", { analytics_storage: "denied" });
    }
  }, [measurementId, consentModeEnabled, isActive]);

  if (!isActive || !measurementId) return null;

  return (
    <div aria-hidden>
      {/* Consent banner: on accept -> gtag('consent','update',{analytics_storage:'granted'}) */}
      <ConsentBanner consentModeEnabled={consentModeEnabled} />
    </div>
  );
}

function ConsentBanner({ consentModeEnabled }: { consentModeEnabled: boolean }) {
  if (!consentModeEnabled) return null;
  // Minimal banner: Accept / Decline. Decline keeps analytics_storage denied (no gtag event fires).
  // On Accept: window.gtag('consent','update',{analytics_storage:'granted'}).
  // (Implement with local state + a cookie flag; site stays fully usable either way.)
  return <div className="fixed bottom-4 left-4 z-50 rounded bg-white p-3 text-sm shadow">…consent UI…</div>;
}
```
Ensure the consent banner's "Decline" path leaves `analytics_storage` denied and that no `gtag` network request fires — verified in Task 12.

- [ ] **Step 3: Mount in marketing layout only**

In `src/app/(marketing)/layout.tsx` (server component), load config and render:
```tsx
import { prisma } from "@/lib/prisma";
import { PublicAnalytics } from "@/components/analytics/PublicAnalytics";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const cfg = await prisma.analyticsConfig.findFirst();
  return (
    <html lang="en">
      <body>
        {children}
        <PublicAnalytics
          measurementId={cfg?.ga4MeasurementId ?? null}
          consentModeEnabled={cfg?.consentModeEnabled ?? false}
          isActive={cfg?.isActive ?? false}
        />
      </body>
    </html>
  );
}
```
Do NOT add `<PublicAnalytics />` to the authenticated app layout or the console layout.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`.
Expected: builds; `<PublicAnalytics />` appears only in marketing bundle.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics src/lib/analytics "src/app/(marketing)/layout.tsx"
git commit -m "feat(analytics): public-only GA4 with Consent Mode; structural scope enforcement"
```

---

## Task 12: Wire conversion events + final verification

**Files:**
- Modify: `src/app/(marketing)/landing-page.tsx` (demo request), `src/app/(marketing)/blog/[slug]/page.tsx` (read-depth), and the Result Verification Portal (PRD 09) lookup handler.

**Interfaces:**
- Consumes: `trackDemoRequest`, `trackBlogRead`, `trackVerificationLookup` (Task 11).

- [ ] **Step 1: Demo request event**

In the marketing demo-request form submit handler (client), after a successful submission call `trackDemoRequest()`.

- [ ] **Step 2: Blog read-depth event**

In `src/app/(marketing)/blog/[slug]/page.tsx`, add a client wrapper that fires `trackBlogRead(slug)` when the user scrolls past 75% of the article (IntersectionObserver or scroll listener). Keep it a small client component; the server page renders it.

- [ ] **Step 3: Verification lookup event (NDPR-safe)**

In the verification portal lookup action/handler, on completion call `trackVerificationLookup(success)` — passing ONLY the boolean success, never the code/name/school/score (PRD 22 §4.1). If the verification portal is not yet built (PRD 09), add the call as a clearly-commented TODO hook in the lookup route so it is wired the moment PRD 09 lands; do not pass any PII.

- [ ] **Step 4: Final verification (acceptance criteria)**

- [ ] GA4 never loads on authenticated routes (grep: `<PublicAnalytics` appears only in marketing/blog/verification layouts, not app/(app) or console).
- [ ] Declining consent → no `googletagmanager.com` request in devtools Network tab.
- [ ] Published post includes `application/ld+json`.
- [ ] `/robots.txt` has separate training + search/retrieval blocks.
- [ ] `/llms.txt` is curated (hand-written, not from sitemap).
- [ ] Creating a blog post via AI stays in `draft`; publishing requires explicit status change.
- [ ] SEO warnings surface in the editor.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(blog+analytics): wire conversion events; verify acceptance criteria"
```

---

## Self-Review Notes (applied)

- PRD 21 §3.1 keyword status progression + cannibalization warning: status enum + pipeline view implemented (Tasks 5,7); cannibalization warning is informational — add a lightweight check in the editor (warn if another published/post-in-progress post shares the same `primaryKeywordId`) as a follow-up if not covered by the pipeline view.
- PRD 21 §3.4 quarterly audit task: a console reminder item is suggested; implement as a simple static "Quarterly GEO audit checklist" panel in `/console/analytics` if time permits (not blocking).
- PRD 22 §4.4 reporting visibility: console links out to GA4 dashboard (add an external link in `/console/analytics`) — include in Task 10 client.
- All AI calls go through `createCompletion` (Task 2/4) — no hardcoded providers.
- GA scope enforced structurally (Task 11) — never imported into authenticated/console layouts.
