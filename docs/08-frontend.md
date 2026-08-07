# 08 — Frontend / Routing

## 1. Framework

- **Next.js 16 App Router** with React 19 server components.
- Pages are server components by default; forms are client components using `useActionState`.
- No middleware file. Guarding happens in layouts (see [03-authentication.md](./03-authentication.md)).

## 2. Route tree

```
/
├── page.tsx                  Landing (role-based redirect when logged in)
├── layout.tsx                Root layout: globals.css, fonts, metadata, favicon
├── not-found.tsx             Custom 404
├── global-error.tsx          Sentry-wired error boundary
│
├── login/                    School login (search) → login/[shortcode] (branded school form)
├── register/                 Public school onboarding (SchoolRegistrationForm)
├── verify/                   Public result verification (enter code)
├── [shortcode]/verify/       School-scoped verification
├── maintenance/              Maintenance-mode placeholder
├── sentry-example-page/      Deliberate-throw test page
│
├── (app)/                    AUTHENTICATED SCHOOL APP  ← guard layout
│   ├── dashboard/
│   ├── sessions/  classes/  subjects/  class-subjects/
│   ├── curriculum/  curriculum-tracker/  syllabus/
│   ├── timetable/  timetable/wizard/  my-timetable/
│   ├── staff/  staff/[id]/  students/  students/register/  students/import/
│   │       students/transfer/  students/[id]/
│   ├── parents/  parents/[id]/
│   ├── period-tracker/  lesson-notes/
│   ├── questions/  assessment-weightings/
│   ├── exams/  exams/[id]/  exams/take/[id]/  exams/review/  my-exams/
│   ├── essay-grading/
│   ├── attendance/  attendance/spreadsheet/  attendance/qr-cards/
│   ├── results/  results/[studentId]/  results/report-card-settings/
│   │       results/psychomotor/  results/attendance/  results/remarks/
│   ├── broadsheet/  grading-scale/
│   ├── fee-status/  billing/  promotion/  addons/
│   ├── settings/  settings/school/  settings/profile/  change-password/
│   ├── announcements/  audit-log/  notifications/
│   ├── messages/  messages/compose/  messages/[id]/
│   ├── tickets/  tickets/[id]/
│   ├── schools/                          (super_admin / platform_owner)
│   ├── my-classes/  my-results/          (teacher / student)
│   └── parent/  parent/ward/[studentId]/  parent/settings/
│
├── (marketing)/
│   └── legal/  terms/ privacy/ refund/ cookies/ acceptable-use/
│       └── layout.tsx        legal page chrome
│
├── console/                  PLATFORM OWNER CONSOLE
│   ├── login/                console login
│   └── (main)/               ← guard layout (platform_owner only)
│       ├── page.tsx          platform KPIs
│       ├── schools/  schools/[id]/  schools/[id]/backup/
│       ├── licenses/  payments/  payment-methods/
│       ├── referrals/  referral-settings/
│       ├── groups/  tickets/  tickets/[id]/
│       ├── notifications/  landing-stats/
│       ├── addons/  nerdc-upload/  curriculum/
│       ├── audit/  demo-requests/
│       └── ai/  ai/call-log/
│
├── proprietor/               PROPRIETOR (GROUP) CONSOLE
│   ├── login/  change-password/
│   └── (console)/            ← guard layout (proprietor + forced pw change)
│       ├── page.tsx          multi-branch dashboard (addon-gated)
│       ├── analytics/  billing/  branches/  branches/[id]/
│       ├── transfers/  settings/
│
└── referral/                 REFERRAL PORTAL
    ├── page.tsx              public program page + signup
    ├── login/  logout/
    └── dashboard/            agent dashboard (referrals, commissions, payouts)
```

## 3. Route groups & their layouts

| Group | Purpose | Guard |
|---|---|---|
| `(app)` | The core authenticated school app | `(app)/layout.tsx`: unauthenticated → `/login`; `proprietor` → `/proprietor`; maintenance mode → `/maintenance`; builds role nav |
| `(marketing)` | Public marketing/legal | none; `legal/layout.tsx` provides chrome |
| `console/(main)` | Platform Owner area | `(main)/layout.tsx`: `platform_owner` only |
| `proprietor/(console)` | Group owner area | `(console)/layout.tsx`: `proprietor` only + forced password change |

## 4. Root layout

`src/app/layout.tsx`:
- Loads `globals.css` and Google Fonts: **IBM Plex Sans**, **Space Grotesk**, **DM Sans**, **Material Symbols Outlined**.
- Metadata: title "Marksheet", description about Nigerian secondary-school portal.
- `<html lang="en" className="light h-full antialiased">`, `<body className="min-h-full flex flex-col">`.
- No global React providers.

## 5. The school app shell — `(app)/layout.tsx`

The authenticated shell provides:
- Sidebar navigation built by `buildNav` (`src/lib/nav.ts`) — items differ by role/permissions.
- Top nav with notification bell, user dropdown, logout form.
- Announcement banner (from `announcements`, sticky flag).
- `generateMetadata()` — swaps the school logo into the favicon.

## 6. UI conventions

### 6.1 Styling
- Tailwind CSS 4 utilities + custom `mk-*` design tokens (defined in the main Tailwind entry — e.g. `mk-ink-fg`, `mk-accent`, `font-mk-display`). These come from `globals.css`/@theme.
- Common patterns: `bg-white border border-gray-200 rounded-xl`, `focus:outline-none focus:ring-2 focus:ring-blue-500`.
- Print styles exist for report cards and broadsheets (the CSP allows inline styles for this reason).

### 6.2 Components
Shared components in `src/components/`:
- `announcement-banner.tsx` — school announcements strip.
- `export-buttons.tsx` — CSV/PDF/print export buttons.
- `image-uploader.tsx` — file/image upload (uses `/api/upload`).
- `rich-text-editor.tsx` — rich text editing.
- `school-license-banner.tsx` — license-expiry banner.

Most feature UI is colocated in the page folders as `*-form.tsx`, `*-client.tsx`, etc.

### 6.3 Client / server boundary
- `"use client"` only where interactive (forms, tabs, modals, toggles).
- Server components render data from Prisma; client components receive serializable props.
- Forms use `useActionState` + Server Actions (see [06-server-actions.md](./06-server-actions.md)).

## 7. Dynamic routes & conventions

| Pattern | Meaning |
|---|---|
| `[shortcode]` | A school's unique shortcode (e.g. `UMS`) — used in `login/[shortcode]` and `[shortcode]/verify` |
| `[id]` | Entity detail pages |
| `[studentId]`, `[examId]`, `[userId]` | Named params for specific domains |
| `score-entry.tsx` in `exams/[id]/` | Client component for entering per-student scores |

## 8. SEO / metadata

- Root metadata in `layout.tsx`.
- `(app)/layout.tsx` overrides favicon per school via `generateMetadata`.
- Legal pages and landing have their own metadata.

## 9. Fonts & assets

- Google Fonts via `<link>` in the root layout (not `next/font`).
- Static assets in `public/`; uploaded files go to `public/uploads` in local dev.

## 10. Adding a new feature page — checklist

1. Add the route under the right group (authenticated → `(app)`, console → `console/(main)`, etc.).
2. Server page loads data with Prisma (scoped to `schoolId`).
3. Client form calls a Server Action via `useActionState`.
4. Add the nav item in `src/lib/nav.ts` (respect permissions).
5. Audit + revalidate in the action.
6. Verify with `npx tsc --noEmit` and `npm run lint`.