# PRD 20: Marketing Homepage

**Depends on:** 00, 09, 15, 16
**Depended on by:** none

---

## 1. Purpose

A public marketing site whose primary job is earning enough trust from a school
proprietor/admin to book a demo — not self-serve signup or checkout, since the
platform's licensing model (PRD 15) is manual and sales-led. Secondary purpose: give
parents/employers a clear path to the public Result Verification Portal (PRD 09).

## 2. Design principle — no self-serve account creation

Every primary call to action on this site is **"Book a Demo"** or **"Contact Us."**
There is no "Sign Up Free," no "Start Trial," and no in-page checkout — this is a
deliberate consequence of PRD 15's manual licensing model, not an oversight. Do not add
account-creation flows to this site; onboarding a new school remains a Platform Owner
Console action (PRD 15).

## 3. Entities

### Demo Request
- `id`, `contact_name`, `school_name`, `phone`, `email`, `student_count_range`
  (informational, e.g. "100-300"), `message` (optional, free text), `status` (`new` /
  `contacted` / `qualified` / `converted` / `closed`), `source` (which page/section the
  form was submitted from, for your own tracking), `created_at`

### Homepage Content Block (CMS-lite)
- `id`, `section_key` (e.g. `hero_headline`, `hero_subheadline`, `pricing_monthly`,
  `pricing_termly`, `faq_item_1`), `content` (text/rich text), `display_order`,
  `is_visible`
- Purpose: let Platform Owner edit headline copy, pricing figures, FAQ content, and
  similar homepage text from the Platform Owner Console (PRD 15) without a code
  deployment. Not every homepage element needs to be a Content Block — structural
  layout and design stay in code — but anything that changes based on business
  decisions (pricing, FAQ answers, headline wording) should be editable data, not a
  hardcoded string in the template.

## 4. Functional requirements

### 4.1 Page sections
Implement in this order: Header/Nav → Hero → Problem framing → Three core feature
pillars (Syllabus & Lesson Notes / Exams & AI Grading / Results & Verification) →
Differentiators (offline exam-hall capability, result verification codes) → Addon
marketplace teaser → Pricing → FAQ → Final lead-capture CTA → Footer.

### 4.2 Hero and core content — editable, not hardcoded
- Hero headline, subheadline, problem-framing copy, and pillar descriptions are
  Homepage Content Blocks (Section 3), editable from the Platform Owner Console.
- Hero visual should be an actual product screenshot (e.g. a report card or exam
  interface), not stock photography — this can be a manually-uploaded image reference,
  swappable as the product's UI evolves, not something requiring a redeploy to update.

### 4.3 Addon marketplace teaser — pulled live, not hand-maintained
- The addon teaser section queries PRD 16's Addon catalog for entries where
  `is_active = true` and renders them automatically — name and short description only.
- Do not hardcode the addon list on this page. When a new addon is added to the
  catalog (or an existing one is deactivated), this section must reflect that without
  any change to the marketing page itself.

### 4.4 Pricing section
- Displays Monthly vs Termly pricing as Homepage Content Blocks — editable figures, not
  hardcoded — ending in a "Book a Demo" button, never a checkout or payment flow,
  consistent with PRD 15's manual licensing model.

### 4.5 FAQ
- FAQ questions and answers are Homepage Content Blocks, editable without a code
  deployment, since these answers should stay accurate as the product evolves (e.g. if
  offline exam-hall behavior changes, the FAQ answer describing it needs to be updated
  independently of a release cycle).
- At minimum, include answers addressing: internet reliability during exams (PRD 06),
  data migration from a previous system (PRD 10), what happens if a license lapses
  (PRD 15's soft-lock behavior — reassure that data is not deleted), and a brief note on
  data privacy/NDPR handling (PRD 11).

### 4.6 Demo request / lead capture
- A simple form (name, school name, phone/email, student count range, optional
  message) creates a Demo Request record on submission.
- On submission, notify the Platform Owner (at minimum, email) — this is the actual
  sales-lead mechanism the whole page is built to feed.
- No account is created and no part of the platform is unlocked by submitting this
  form — it is purely a contact-request action.
- Include basic spam protection (e.g. honeypot field or CAPTCHA) since this is a public,
  unauthenticated form.
- Demo Requests should be viewable/manageable (status updates: contacted, qualified,
  etc.) from the Platform Owner Console, functioning as a lightweight lead inbox rather
  than requiring a separate external CRM for v1.

### 4.7 Result Verification link
- A clearly separate, prominent link/button (footer and/or nav) to the public Result
  Verification Portal (PRD 09) — this page serves two distinct audiences (schools
  evaluating the platform, and parents/employers verifying a result), and the second
  audience's path must not be buried inside sales-focused navigation.

### 4.8 Performance and access
- Mobile-first, lightweight page weight — no autoplay video, minimal heavy animation —
  since a meaningful share of visitors will be on phones with inconsistent connectivity,
  matching the platform's own offline-first design philosophy (PRD 06).
- Standard SEO fundamentals (meta tags, semantic headings, reasonable load performance)
  since organic discovery is a plausible lead source alongside direct sales outreach.

### 4.9 Visual consistency with the product
- Reuse the same design system (colors, typography, restrained accent color) used for
  the in-app screens designed earlier — a visually mismatched marketing site creates a
  trust gap when a prospect who was sold on a calm, professional-looking homepage logs
  into a differently-styled product.

## 5. Edge cases to handle

- Duplicate Demo Request submissions from the same school (e.g. filled out twice, or by
  two different staff members) — do not block or deduplicate silently; surface both to
  the Platform Owner as separate entries, since repeat interest is itself a useful
  signal, not noise to suppress.
- An addon is deactivated (`is_active = false`) in the catalog while a prospect has the
  homepage open — the teaser section should reflect current catalog state on next load,
  not require a manual homepage content edit to stay in sync.
- Homepage Content Block missing/empty for a given `section_key` — render a sensible
  fallback or hide that specific element gracefully, rather than showing a broken/blank
  section if content hasn't been set yet.

## 6. Explicitly out of scope

- Self-serve account creation, signup, or checkout of any kind.
- A full CMS/page-builder — Homepage Content Blocks cover specific, pre-defined
  editable fields (headlines, pricing, FAQ), not arbitrary drag-and-drop page editing.
- Multi-language support (English only, consistent with the platform's British English
  standard elsewhere in the spec).

## 7. Acceptance criteria

- [ ] Every primary CTA on the page is "Book a Demo" or equivalent contact action —
      no signup or checkout flow exists anywhere on this page.
- [ ] Hero copy, pricing figures, and FAQ content are editable via Platform Owner
      Console without a code deployment.
- [ ] Addon teaser section renders live from PRD 16's Addon catalog (`is_active` only)
      — never a hardcoded list.
- [ ] Demo Request submissions notify the Platform Owner and are visible/manageable as
      a lead inbox within the Platform Owner Console.
- [ ] The Result Verification Portal link is clearly separate and prominent, not
      buried within sales-focused navigation.
- [ ] Page is mobile-first and lightweight, with no autoplay media or heavy animation.
- [ ] Visual design is consistent with the in-app product's own design system.
