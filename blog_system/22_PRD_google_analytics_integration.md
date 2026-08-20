# PRD 22: Google Analytics Integration

**Depends on:** 00, 11, 20, 21
**Depended on by:** none

---

## 1. Purpose

Add Google Analytics 4 tracking to measure marketing site and blog performance —
scoped strictly to public, unauthenticated pages, and explicitly never to the
authenticated in-app product where student personal data lives.

## 2. Critical design principle — the scope boundary is non-negotiable

**GA4 must load only on:** the marketing homepage (PRD 20), the blog (PRD 21), and the
public Result Verification Portal (PRD 09) — the last one for aggregate pageview/lookup
tracking only, never with any identifying data attached (see Section 4.1).

**GA4 must never load inside the authenticated application** — not the School Admin,
Teacher, Student, or Parent portals, and not the Platform Owner Console. This isn't a
performance or preference decision; it follows directly from PRD 11's NDPR
access-control principles. Introducing a third-party analytics script into pages that
handle student personal data creates a data-sharing relationship with Google that
hasn't been consented to for that purpose and isn't necessary for what this PRD is
actually trying to measure (marketing effectiveness, not in-app product usage). If
in-app product analytics is ever wanted, that should be a separate, deliberately
privacy-reviewed decision — not something that arrives bundled into this PRD by
default.

## 3. Entities

### Analytics Config
- `id`, `ga4_measurement_id`, `consent_mode_enabled`, `is_active` — stored as
  Platform Owner Console-editable configuration (consistent with the platform's
  existing pattern of database-backed, console-editable settings rather than
  environment variables — see PRD 14/15), not hardcoded.

### Conversion Event Definition
- `id`, `event_name` (e.g. `demo_request_submitted`, `blog_read_75_percent`,
  `verification_lookup_performed`), `ga4_event_mapping`, `is_active`

## 4. Functional requirements

### 4.1 Scope enforcement
- GA4's tracking script is conditionally loaded only on the specific public route
  groups listed in Section 2 — this should be enforced structurally (e.g. the
  authenticated app's layout/shell never includes the GA script at all, rather than a
  runtime check that could be bypassed by a future page added in the wrong place).
- On the Result Verification Portal specifically: track that a lookup occurred and
  whether it succeeded or failed — **never** pass student name, school name, result
  scores, or the verification code itself as a GA event parameter, custom dimension,
  or page-URL query string that GA would capture. This is the single most likely
  accidental-NDPR-violation vector in this PRD and should be called out explicitly in
  code review whenever this tracking code is touched.

### 4.2 GA4 setup and consent
- Standard GA4 property and measurement ID, configured via the Analytics Config
  entity (Platform Owner Console), not an environment variable.
- Implement a consent banner on first visit to any GA-tracked public page, using
  Google's Consent Mode so tracking correctly reduces or stops if a visitor declines —
  consistent with NDPR's expectation of clear notice for non-essential tracking.
- The site must remain fully functional for a visitor who declines analytics consent
  — no feature should require accepting tracking.

### 4.3 Conversion and event tracking
- Track key business-relevant events: Demo Request submitted (PRD 20), blog post
  scroll-depth/read-completion, outbound clicks to YouTube/social channels, and
  aggregate (non-PII) verification portal lookups.
- Establish and document consistent UTM parameter conventions across YouTube video
  descriptions, blog posts, and any future paid or social campaigns, so traffic-source
  attribution reliably ties back to the specific content that drove it — this is what
  lets you actually see which blog posts, keywords, or videos produce real demo
  requests, not just raw traffic volume.

### 4.4 Reporting visibility
- Platform Owner Console links out to the real GA4 dashboard rather than rebuilding
  GA's own reporting UI internally — duplicating Google's own analytics interface
  inside the console is not a good use of engineering effort for the value it adds.

## 5. Edge cases to handle

- A visitor declines consent — confirm via testing that no GA network request fires
  at all in that state, not just that the UI hides a banner while a script still loads
  silently in the background.
- A future code change accidentally adds student-identifying data to a GA event
  (e.g. a developer adds a student's name to an event "for debugging" and forgets to
  remove it) — flag this explicitly as a standing code-review checklist item for
  anyone touching verification-portal or analytics code.
- GA script load affecting page performance/Core Web Vitals — use the official async
  GA4 snippet, never a blocking synchronous script, consistent with PRD 20's
  mobile-first, lightweight-page-weight requirement.

## 6. Acceptance criteria

- [ ] GA4 never loads on any authenticated application route — verified structurally,
      not just by convention.
- [ ] Result Verification Portal tracking never includes student name, school name,
      scores, or verification codes in any GA event, parameter, or captured URL.
- [ ] Consent Mode is implemented; declining consent measurably stops tracking
      requests, and the site remains fully usable regardless of consent choice.
- [ ] Analytics configuration (measurement ID, consent settings) lives in the Platform
      Owner Console, not hardcoded or environment-variable-only.
- [ ] Demo Request submissions and blog engagement are tracked as defined conversion
      events, with consistent UTM conventions applied across YouTube and blog content.
