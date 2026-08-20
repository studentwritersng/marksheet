# Platform Definition Document
## Nigerian Secondary School Syllabus & Examination Platform

**Document purpose:** This is the top-level definition for the platform. It exists to give
full context to anyone (human or AI) implementing any individual PRD. Every PRD in this
document set inherits the scope, roles, and terminology defined here. Read this before
any individual PRD.

---

## 1. Vision

A web platform for Nigerian secondary schools that is, at its core, **a syllabus, lesson
note, examination, and result portal.** It replaces the manual/paper-based (or loosely
digitized, e.g. spreadsheet-based) process schools currently use to:

- Set up academic sessions and terms
- Register and manage students and staff
- Upload syllabi and generate lesson notes from them
- Set, deliver, and grade exams (objective and essay, with AI-assisted essay grading)
- Compute results and publish report cards
- Let parents/third parties verify the authenticity of a result

The platform is **not** a general school ERP. It deliberately excludes fee payment
processing, boarding/hostel management, admissions/entrance exam workflows, and general
calendar/event management. See Section 5, Non-Goals.

---

## 2. Core academic model

### 2.1 Session → Term structure
- A **Session** represents one academic year (e.g. "2025/2026").
- Every Session has exactly **three Terms** (First, Second, Third) — this is fixed to
  match the Nigerian secondary school calendar, but term start/end dates are configurable
  per session.
- A school can have multiple Sessions in the system (current + historical).

### 2.2 Classes
- Classes are created per school (e.g. JSS1A, JSS1B, JSS2A, SS3 Science) and are
  associated with a Session (a class "exists" within a given session's structure, though
  the same class name persists year over year).
- **Promotion**: an explicit, auditable action that moves a cohort of students from one
  class to another, typically at session end. Must support bulk promotion (whole class at
  once) and individual overrides (e.g. one student repeats).

### 2.3 Assessments (non-hardcoded)
- A Term contains one or more **Assessment types**, defined per school, per subject (or
  applied school-wide as a default): e.g. CA1, CA2, CA3, Main Exam — but these labels,
  counts, and weightings must be fully configurable, not hardcoded into the system.
- Each Assessment type has a max score and a weight contributing to the term's overall
  subject score.
- See PRD 08 (Results, Grading & Report Cards) for computation detail.

---

## 3. User roles

Roles are **assignment-based, not fixed labels on a user account.** A single staff member
can hold multiple assignments simultaneously. See PRD 02 for full detail.

| Role | Granted by | Scope |
|---|---|---|
| Platform Owner | Platform-level, defined in PRD 15 | Not scoped to any school. Manages licensing/subscription status per school and AI provider configuration (PRD 14), via a separate console entirely inaccessible to any school's staff. This is the only truly platform-wide role — see PRD 15. |
| Proprietor | Group-level, defined in PRD 19 (addon) | Scoped to one School Group (multiple specific branches), never the whole platform. Oversight/comparison role, not operational — does not edit individual branch data. See PRD 19. |
| School Admin | School-level | Full access within their school: sessions, classes, staff, students, fee-check, templates |
| Exam Officer | Assignment | Cross-subject exam scheduling and oversight |
| HOD (Head of Department) | Assignment: subject + whole school | Approves question bank content and lesson notes across all classes for their subject |
| Subject Teacher | Assignment: subject + specific class(es) | Lesson notes, question setting, grading — only for assigned subject/class combinations |
| Class Teacher | Assignment: specific class | Attendance, affective ratings, class-wide result oversight, promotion recommendation — for their class only, regardless of subject |
| Student | Account | Takes exams, views own results |
| Parent/Guardian | Account (linked to student) | Views own ward's results, receives notifications |
| Public (unauthenticated) | None | Result verification portal only |

Assignments (subject-teacher, class-teacher, HOD) are **versioned per session/term** —
not permanent — so historical records accurately reflect who taught/graded what, when.

---

## 4. Module map (maps to individual PRDs)

| # | PRD | Summary |
|---|---|---|
| 01 | School, Session & Term Management | Session/term setup, class creation, promotion |
| 02 | Staff, Roles & Permissions | Assignment model, scoped access |
| 03 | Student Management | Registration (manual + CSV), bio-data, guardian/parent info |
| 04 | Syllabus, Lesson Notes & AI Generation | Syllabus upload, AI/manual lesson note creation |
| 05 | Question Bank & Exam Setup | MCQ/essay authoring via manual, CSV, AI; question groups; moderation |
| 06 | Exam Delivery & Offline Sync | Online/offline exam taking, shuffling, kiosk mode, resit |
| 07 | AI Essay Grading | Rubric-based AI grading grounded in model answers + lesson notes |
| 08 | Results, Grading & Report Cards | Weighted computation, customizable report card templates |
| 09 | Result Verification Portal | Public code-based result verification |
| 10 | Bulk Data Migration & CSV Import | Template-based import of legacy school data |
| 11 | Audit Logging & NDPR Compliance | Change tracking, consent, data access control |
| 12 | Fee Status Check | Admin-set fee-cleared flag gating exam/result access |
| 13 | Parent Portal & Notifications | Parent-facing views, SMS/push notifications |
| 14 | AI Provider Configuration | Centralized, swappable AI gateway (dev endpoint → OpenRouter in production) |
| 15 | Platform Licensing & Owner Console | Platform-owner-only control plane: license enforcement, cross-school monitoring, hosts PRD 14's AI config screens |
| 16 | Addon Marketplace & Feature Flags | Manual, per-school activation of optional paid features on top of the base license |
| 17 | Timetable Generator (Addon) | First addon: CSP/optimization-based timetabling, gated by PRD 16 |
| 18 | SMS & WhatsApp Notification Addons | Second/third addons: independently-activatable messaging channels with credit-based cost control |
| 19 | Multi-Branch / Group of Schools Management (Addon) | New Proprietor role tier; cross-branch dashboard and student transfer for schools under one owner, without breaking tenant isolation |
| 20 | Marketing Homepage | Public site: demo-request lead capture (no self-serve signup), CMS-lite editable content, links to the public Result Verification Portal |
| 21 | Blog System | AI-assisted, SEO- and AI-crawler-optimized content engine: keyword bank, draft generation, publishing pipeline |
| 22 | Google Analytics Integration | GA4 on public marketing/blog pages only — never the authenticated app, per NDPR scope boundary |

---

## 5. Non-goals (explicitly out of scope)

Do not build these. If a feature request seems to require one of these, flag it rather
than silently implementing it:

- **Fee payment processing** — no payment gateway integration. Only a manual admin-set
  status flag (see PRD 12).
- **Admissions / entrance exam workflow** — students are registered directly by admin
  (manual or CSV), not through an application/screening pipeline.
- **Boarding/hostel management** — no dormitory, house system, or matron/housemaster
  roles.
- **General academic calendar / event management** — no PTA meetings, sports day
  scheduling, or general event features.
- **Certificate generation beyond report cards** — no testimonials, transfer
  certificates, or leaving certificates in v1.
- **CA cross-teacher moderation/fairness statistics** — no automated grading-distribution
  comparison across teachers.
- **Plagiarism detection** — exams are computer-based but hall-invigilated; no
  AI-content-detection is needed.
- **Behavioral anti-cheat analytics** (tab-switch detection, webcam monitoring, etc.) —
  physical invigilation covers this. Kiosk/lockdown mode is for stability/containment
  only, not surveillance.
- **Vendor-specific migration importers** — migration is template-based only (school
  reformats their old data into our CSV templates); no automatic parsing of specific
  competitor export formats.

---

## 6. Cross-cutting technical requirements

These apply across all PRDs and should be treated as platform-wide constraints:

1. **Multi-tenancy**: the platform serves multiple schools. All data must be scoped by
   `school_id`. Grading scales, report card templates, assessment structures, and class
   naming conventions are configurable per school, not global.
2. **CSV import everywhere**: every feature that supports CSV import must ship with a
   downloadable, pre-filled sample template matching the exact expected column format.
   No CSV import should commit directly to live data — always stage, validate, and show
   errors before commit.
3. **Audit logging**: all mutations to scores, question bank content, lesson notes,
   student records, promotions, and result approvals must be logged (who, what changed,
   before/after value, when). See PRD 11.
4. **Role-scoped visibility**: UI must hide, not just disable, content outside a staff
   member's assignment scope (e.g. a Biology teacher should not see Chemistry classes in
   navigation at all).
5. **Offline-first exam delivery**: exam-taking and MCQ grading must function on a school
   LAN with no internet. AI grading and sync are online-only operations. See PRD 06.
6. **NDPR compliance**: student/guardian personal data (bio-data, contact info, passport
   photos) requires consent capture and role-restricted access. See PRD 11.
7. **AI provider abstraction**: every module that calls AI (lesson note generation,
   question generation, essay grading, comment drafting) must call through the single
   internal AI Gateway Service defined in PRD 14 — never hardcode a provider SDK, base
   URL, or model name inside feature code. This is what allows development to point at
   any OpenAI-compatible endpoint and production to switch to OpenRouter through
   configuration alone.

---

## 7. How to use this document set

Each PRD (01–13) is self-contained but assumes the roles, structure, and terminology
defined here. When implementing a PRD, cross-reference the Module Map (Section 4) for
dependencies — e.g. PRD 06 (Exam Delivery) depends on PRD 05 (Question Bank) being in
place; PRD 08 (Results) depends on PRD 01 (Assessments) and PRD 02 (Roles) for who can
enter/approve scores.

Suggested build order: 01 → 02 → 03 → 15 → 14 → 04 → 05 → 06 → 07 → 08 → 09, with 10,
11, 12, 13 integrated in parallel once their dependencies exist. PRD 15 (Platform
Licensing & Owner Console) should be built early, ahead of PRD 14, since PRD 14's
configuration screens are a module hosted inside PRD 15's console rather than a
standalone admin page — building PRD 14 first risks bolting its settings screen onto
the wrong (school-facing) surface. Note that PRD 14 should still be built before 04,
05, and 07, since all three consume it — do not implement direct AI provider calls
inside any of those modules ahead of PRD 14 existing; that creates exactly the
hardcoding problem PRD 14 exists to prevent. PRDs 16 and 17 (Addon Marketplace and the
Timetable Generator) are independent of the core 01–13 build and can be built any time
after PRD 15 exists, since addons are additive, gated modules, not part of the core
platform's critical path.
