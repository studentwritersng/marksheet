# Blog & Analytics — Console Usage Guide

This guide covers the Blog System (PRD 21) and Google Analytics integration (PRD 22)
as implemented in the Marksheet console. All blog/analytics data is **platform-owned**
(global) — it is not scoped to individual schools.

---

## 1. Who can use it

The **Blog** and **Analytics** console sections require the **platform owner**
(`role = platform_owner`). Every mutating action is guarded by `requireOwner()` and
written to the audit log.

## 2. Console navigation

The sidebar contains two entries:

- **Blog** → `/console/blog` — keyword bank, categories, and posts.
- **Analytics** → `/console/analytics` — GA4 configuration and conversion events.

## 3. Keyword bank (`/console/blog`)

The keyword bank drives AI draft generation and topic clustering.

| Field            | Notes                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `keywordText`    | **Required.** The target search phrase.                            |
| `type`           | `short_tail` or `long_tail`.                                       |
| `searchIntent`   | `informational`, `commercial`, or `comparison`.                    |
| `targetAudience` | Free text (e.g. "SSS2 students", "parents").                       |
| `status`         | `planned`, `assigned`, `published`, or `ranking`.                  |
| `priority`       | Integer (0 = lowest). Used to order the backlog.                  |
| `notes`          | Free text.                                                         |

Create / edit / delete keywords from the blog page. Slug-style uniqueness is not
required for keywords; duplicates are allowed but discouraged.

## 4. Blog categories (`/console/blog`)

A category has a **name** that is automatically **slugified** (`slugify`) into a
URL-safe slug (lowercase `a–z`, `0–9`, hyphens). Slugs must be **unique** — creating
or renaming to an existing slug returns an error. There is no separate slug field in
the UI; it is derived from the name.

## 5. Writing a post (editor)

From `/console/blog`, use **New Blog Post** (or open an existing post) to reach the
editor at `/console/blog/[id]`.

### 5.1 Post fields

| Field                     | Notes                                                          |
| ------------------------- | -------------------------------------------------------------- |
| Title                    | Required.                                                      |
| Slug                     | Auto-derived from the title; editable. Must be URL-safe & unique. |
| Subtitle                 | Optional.                                                      |
| Category                 | Links the post to a `BlogCategory`.                            |
| Primary keyword          | Links the post to a `Keyword` (used for SEO checks).          |
| Excerpt                  | Short summary.                                                 |
| Body                     | **Markdown.** Rendered with `react-markdown` on the public page. |
| Meta title               | SEO `<title>` override.                                        |
| Meta description         | SEO meta description.                                          |
| Tags                     | Comma-separated list.                                          |
| Canonical URL            | Optional canonical link.                                       |
| Featured image URL       | Image shown on the public post.                               |
| Featured image alt text  | **Important for SEO/accessibility** — see §5.3.               |

Status selector (editable any time): `draft`, `pending_review`, `archived`.

### 5.2 AI draft generation

In the editor's **Generate AI draft** panel:

1. Choose a **Primary keyword** (or type a **Topic / angle**), then click
   **Generate AI draft**.
2. The request is sent through the centralized **AI gateway** (`createCompletion`,
   task `blog_generation`) — the same provider routing used everywhere in the app.
3. On success the editor is populated with: title options (first used as Title),
   subtitle, excerpt, body, meta title, meta description, tags, and a **suggested
   image prompt** (shown read-only — the image is not auto-fetched).
4. Each generation is logged as an `AiBlogDraftRequest` for traceability.

> Notes:
> - An **AI provider must be configured** (Console → AI) for generation to work.
> - With `AI_MOCK=true`, the gateway returns a deterministic sample draft (used by tests).
> - Generation only creates draft *content*; you still review, save, and publish.

### 5.3 Live SEO check (non-blocking)

As you edit, `validateBlogSeo` runs on the current fields and shows **warnings**
(amber cards). These are **informational only — they never block saving or
publishing**, so reviewers can intentionally override them.

Warning codes you may see:

| Code                | Meaning                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `META_TITLE_LONG`   | Meta title exceeds 60 characters.                                |
| `MISSING_IMG_ALT`   | A featured image is set but has no alt text.                     |
| `NO_INTERNAL_LINKS` | Body contains 0 internal links (link to `/blog/...` to add some).|
| `SLUG_UNSAFE`       | Slug is not URL-safe (use lowercase letters, numbers, hyphens).  |
| `KEYWORD_MISSING`   | The primary keyword is not present in the title/body.            |

The internal-link count is derived live from the body, so adding `/blog/...` links
clears `NO_INTERNAL_LINKS` immediately.

## 6. Save vs Publish

- **Save** — persists the post. Status may be `draft`, `pending_review`, or `archived`.
  Saving does **not** make the post public.
- **Publish** — available only after the post has been **saved at least once**. It sets
  `status = published` and `publishedAt = now()`. The post appears immediately at
  `/blog/[slug]` and in the public sitemap.

A brand-new post shows **Publish disabled** until you Save it first.

## 7. Analytics (`/console/analytics`)

Platform-wide Google Analytics 4 configuration.

### 7.1 GA4 configuration

| Field                 | Notes                                                              |
| --------------------- | ------------------------------------------------------------------ |
| GA4 Measurement ID    | `G-XXXXXXXXXX`. **Leave blank to disable tracking.**              |
| Consent mode enabled  | Enables Google Consent Mode v2. Default consent is **denied** until the visitor accepts (NDPR). |
| Analytics active      | Master switch for the whole platform.                             |

Saving upserts the **single global** `AnalyticsConfig` row.

### 7.2 Conversion events

- Click **Seed defaults** to create the standard events in one click (only shown when
  none exist), or **+ Add event** to create one manually.
- Each event has:
  - **Event name** (unique, e.g. `demo_request_submitted`)
  - **GA4 event mapping** (the GA4 event name actually emitted, e.g. `generate_lead`)
  - **Event active** toggle.
- Edit / delete via the table row actions.

Wired events (fired on the public site):

| Event                          | Trigger                                  | Data sent (NDPR-safe)        |
| ------------------------------ | ---------------------------------------- | ---------------------------- |
| `demo_request_submitted`       | Marketing demo form submitted            | none                        |
| `blog_read_75_percent`         | Reader scrolls past 75% of a post        | `post` slug only            |
| `verification_lookup_performed`| Result verification lookup completes     | `success` boolean **only**  |

**No student PII** (names, codes, schools, scores) is ever sent to GA — only a
boolean success flag and the post slug.

## 8. Public-facing behavior (for context)

- `/blog` lists **published** posts (newest first); `/blog/[slug]` renders the markdown
  body and emits `BlogPosting` JSON-LD for search engines / LLMs.
- `robots.txt` **blocks AI training crawlers** (GPTBot, CCBot, anthropic-ai, ClaudeBot,
  Google-Extended, Applebot-Extended, Bytespider, …) while allowing search/retrieval
  crawlers; `sitemap.xml` and `llms.txt` list only published content.
- GA4 loads **only on public (marketing) pages** via a Consent Mode banner; it is
  structurally excluded from console and app routes.

## 9. Notes & caveats

- Blog content is **platform-owned** — there is intentionally no school selector.
- AI generation always routes through the central AI gateway; configure a provider first.
- The blog/analytics Prisma models were added in this work; the schema migration was
  applied directly because a **pre-existing broken migration** in the repo
  (`20260719200000`, referencing a non-existent `addons` table) prevents
  `prisma migrate dev` from running. This is a repo-level issue, not specific to this feature.
