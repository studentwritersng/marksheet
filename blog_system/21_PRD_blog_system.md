# PRD 21: Blog System (AI-Assisted SEO & AI-Crawler Content Engine)

**Depends on:** 00, 14, 15, 20
**Depended on by:** 22

---

## 1. Purpose

An AI-assisted blog authoring tool, hosted in the Platform Owner Console, that
generates full SEO-optimized blog post drafts from a target keyword — title options,
subtitle, brief, full body, tags, meta content, and a ready-to-use featured-image
prompt — while also making the resulting content genuinely readable and citable by AI
answer engines (ChatGPT, Perplexity, Google AI Overviews), not just traditional search
crawlers. Optimizing for one without the other is an incomplete strategy in 2026.

## 2. Entities

### Keyword
- `id`, `keyword_text`, `type` (`short_tail` / `long_tail`), `search_intent`
  (`informational` / `commercial` / `comparison`), `target_audience` (`teacher` /
  `school_admin` / `proprietor` / `parent` / `general`), `status` (`planned` /
  `assigned` / `published` / `ranking`), `priority`, `notes`

### Blog Post
- `id`, `title`, `subtitle`, `slug` (unique, URL-safe), `excerpt`, `body` (rich
  text/markdown), `status` (`draft` / `pending_review` / `published` / `archived`),
  `primary_keyword_id`, `secondary_keyword_ids[]`, `tags[]`, `category_id`,
  `meta_title`, `meta_description`, `canonical_url`, `featured_image_url`,
  `featured_image_alt_text`, `schema_type` (`BlogPosting` / `Article` / `FAQPage`),
  `source` (`manual` / `ai_generated`), `author`, `published_at`, `updated_at`,
  `word_count`, `estimated_read_time`

### Blog Category
- `id`, `name` (e.g. "For Teachers," "For School Owners," "For Parents," "Product
  Updates" — mirroring the same audience segmentation used in the YouTube tutorial
  series, keeping cross-channel content strategy consistent), `slug`

### AI Blog Draft Request
- `id`, `keyword_id` (or free-text topic if not keyword-driven), `target_audience`,
  `requested_by`, `status`, `generated_title_options[]`, `generated_subtitle`,
  `generated_excerpt`, `generated_body`, `generated_meta_title`,
  `generated_meta_description`, `generated_tags[]`, `generated_image_prompt`
  (a complete, ready-to-use image-generation prompt — not a vague description),
  `created_at`

## 3. Functional requirements

### 3.1 Keyword bank management
- Store and manage the keyword list (Section "Keyword Bank" above is the initial seed
  set), each tagged with intent and target audience.
- Warn (do not hard-block) if a keyword is already assigned to a published or
  in-progress post before letting a second post target the same primary keyword —
  cannibalization is sometimes intentional (a second angle on a strong topic), so this
  should inform, not prevent.
- Status progression (`planned` → `assigned` → `published` → `ranking`) gives a
  Platform Owner a clear view of content pipeline coverage against the full keyword
  list at a glance.

### 3.2 AI-assisted blog post generation ("the SEO blog maker")
Given a keyword (or a free-text topic) and target audience, generate through the AI
Gateway Service (PRD 14) a complete draft package:
- **3-5 title options**, primary keyword naturally placed, each under ~60 characters
  (SEO title-tag length limit).
- **Subtitle.**
- **Excerpt/brief** (150-160 characters — meta-description length, dual-purpose).
- **Full body**, structured with exactly one H1 (matching the chosen title), proper
  H2/H3 hierarchy, natural (non-stuffed) keyword usage, at least 2-3 internal links to
  real, existing product/feature pages (resolved against the actual site structure —
  never an invented URL), external citations to authoritative sources where factual
  claims are made (e.g. WAEC/NECO official information), and — critically — **a clear,
  self-contained, factually dense answer paragraph within the first 2-3 sentences**
  that directly answers the implied question a searcher or an AI answer engine would
  be looking for. This is what makes a paragraph quotable/extractable by an AI
  Overview or a chat assistant's answer, rather than requiring a click-through to
  understand.
- **Suggested tags.**
- **Meta title and meta description**, character-limit validated.
- **A ready-to-use featured-image generation prompt** — following the same structured
  prompt format used elsewhere for Marksheet's visual assets (subject, composition,
  style, brand colors) — not a one-line vague description a human still has to expand.

All AI-generated content lands as `status = draft`, requiring explicit human review and
approval before `published` — consistent with every other AI-generated content type
across this platform (lesson notes, questions, grading, report comments). Never
auto-publish.

### 3.3 On-page SEO validation (before publish)
Surface as **warnings**, not hard blocks, on: missing/duplicate H1, meta title over 60
characters, meta description over ~160 characters, missing image alt text, zero
internal links, non-unique or non-URL-safe slug, primary keyword absent from
title/H1/opening paragraph. A human reviewer should always be able to override with a
reason, but should never publish unaware of a gap.

### 3.4 AI-crawler / GEO (generative engine optimization)
- **Structured data**: every published Blog Post renders appropriate schema.org
  markup (`BlogPosting`/`Article`, plus `FAQPage` where the post includes a Q&A
  section) so both traditional search and AI answer engines parse it accurately.
- **`llms.txt`**: maintain a curated file at the site root — hand-curated by the
  Platform Owner, not auto-dumped from the sitemap. Keep it to roughly 20-50 truly
  high-value links (homepage, top feature pages, best-performing posts), with short
  descriptions written for context ("explains our AI grading rubric system"), not
  SEO-style keyword stuffing. Auto-generated, comprehensive llms.txt files are a
  documented common failure mode — noisy and lower-value than a curated one.
- **`robots.txt`**: configure explicit, deliberate rules distinguishing **training
  crawlers** (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended) from **search
  and retrieval crawlers** (OAI-SearchBot, Claude-SearchBot, PerplexityBot,
  ChatGPT-User, Perplexity-User, Claude-User). Default recommendation: allow all
  search/retrieval bots on public marketing and blog content — this is exactly the
  visibility Marksheet wants — while leaving the training-crawler opt-in/opt-out
  decision as an explicit, documented Platform Owner choice rather than an
  accidental default nobody consciously set.
- **CDN/robots.txt agreement check**: confirm the hosting/CDN layer's own bot-access
  rules don't silently contradict `robots.txt` — a documented common failure mode is
  a CDN blocking AI crawlers at the edge while robots.txt says "allow."
- **Content structure discipline**: clean semantic HTML, fast page load, up-to-date
  `sitemap.xml`, and — as covered in 3.2 — clear extractable direct-answer paragraphs
  near the top of every post.
- **Quarterly technical audit task** (a recurring reminder in the Platform Owner
  Console): re-check `robots.txt` against the current major AI-crawler list (this
  list changes — new bots appear, existing ones get renamed), confirm `llms.txt`
  links aren't stale or pointing at removed content, and verify `sitemap.xml` is
  current.

### 3.5 Publishing workflow and editorial pipeline
`draft` → `pending_review` → `published` → (optionally) `archived`. Platform Owner
Console shows a simple pipeline view: keywords planned, drafts in progress, posts
pending review, published posts — visible content-production status at a glance.

## 4. Edge cases to handle

- AI-generated body content that unintentionally closely mirrors existing published
  web content on the same topic — human review is the primary safeguard in v1;
  automated plagiarism/originality detection is not included here and should be
  scoped separately if it becomes a real concern.
- A blog post's internal links break because a linked feature page gets restructured
  — treat as routine content maintenance for v1; automated link-checking is a
  reasonable future addition, not required now.
- No major AI provider has publicly confirmed that `llms.txt` measurably affects
  citation frequency, and at least one independent SEO analysis found no correlation
  with ranking. Treat it as a low-cost, low-risk signal worth doing properly (per
  Section 3.4), not a guaranteed traffic lever — don't oversell its expected impact
  internally.

## 5. Acceptance criteria

- [ ] AI-generated draft packages include all elements in Section 3.2, including a
      genuinely usable featured-image prompt, not a placeholder description.
- [ ] No AI-generated blog content reaches `published` without explicit human review
      and approval.
- [ ] Every published post includes appropriate schema.org structured data.
- [ ] `robots.txt` explicitly and deliberately addresses both training and
      search/retrieval AI crawlers as separate categories, not a single blanket rule.
- [ ] `llms.txt` is curated (not auto-dumped), capped at a sensible high-value link
      count, with context-focused descriptions.
- [ ] On-page SEO checks surface as reviewable warnings before publish, never silent
      or blocking.
- [ ] Keyword bank tracks status per keyword and warns (without blocking) on
      cannibalization.
