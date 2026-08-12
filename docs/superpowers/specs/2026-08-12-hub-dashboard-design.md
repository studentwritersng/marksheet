# Hub Student Dashboard + Styling Fix — Design

**Date:** 2026-08-12
**Status:** Implemented
**Author:** AI pair (session `teta-exam`)

## Context

The hub SPA (offline exam client) had two problems after the exam-taking flow shipped:

1. **The exam screen rendered with no styling** — the Tailwind classes from the shared
   `shared/exam-rendering/exam-taking-view.tsx` were missing from the built CSS.
2. **No real student dashboard** — after sign-in, students saw a bare list of sessions
   in a centered card ("very poor", not "a full standard dashboard with school name,
   term, current date, student info").

Both the student and invigilator (admin) UIs were restyled in the same pass.

## Root cause of the styling gap

Tailwind 4's automatic content detection only scans files under the Vite root
(`hub/spa`). The shared exam view lives outside it at `marksheet/shared/exam-rendering/`,
so none of its utility classes were ever generated. The JS ran correctly — the page
just had no CSS for the exam view.

## Changes

### 1. CSS scan fix (`hub/spa/src/styles.css`)

```css
@source "../../../shared/exam-rendering";
```

Added after the existing imports. One line; the shared view's classes
(`sticky`, `whitespace-pre-wrap`, `animate-pulse`, `bg-primary-fixed`,
`bg-error-container`, `grid-cols-5`, `bg-secondary-container`, …) are now present in
the built stylesheet (11.52 kB → 20.92 kB). The online app is untouched.

### 2. Self-hosted fonts (hub runs offline)

Google Fonts cannot be relied on — the whole point of the hub is to keep working
when the internet is down. Downloaded and vendored:

- `spa/public/fonts/ibm-plex-sans-{400,500,600,700}.woff2` (~45 KB each)
- `spa/public/fonts/material-symbols-outlined.woff2` (~3.9 MB variable font)
- `spa/public/fonts/fonts.css` — `@font-face` rules pointing at `/fonts/...`, plus the
  `.material-symbols-outlined` base class (font-family etc.) which previously only ever
  came from Google's stylesheet.

`spa/index.html` no longer links `fonts.googleapis.com`; it links `/fonts/fonts.css`.
Everything is served locally by the hub.

### 3. Shared dashboard shell (`hub/spa/src/HubShell.tsx`)

A full-page shell used by both the student dashboard and the invigilator console:

- Fixed dark sidebar (`bg-primary`): school logo + name, signed-in profile block
  (avatar or initials, name, subline), nav items, and a badge label at the bottom
  ("Student portal" / "Invigilator console").
- Scrollable content column.

### 4. Student dashboard (`hub/spa/src/student/StudentApp.tsx`)

After sign-in the student lands here instead of the plain card. Contains:

- Greeting ("Good morning, {firstName}") + full current date.
- Term chip (from the first session's `termLabel`, "No active term" fallback).
- Three stat cards: Admission No., Class, Exams Available.
- "Available Exams" grid: one card per open session showing subject, classes, term
  chip, question count, duration, and a Start Exam button. Empty state explains the
  invigilator hasn't opened a session yet.
- Sign-out is in the sidebar; selecting an exam goes through the existing
  `signIn` → `ExamScreen` flow unchanged.

The login page itself is unchanged.

### 5. Invigilator console (`hub/spa/src/admin/AdminApp.tsx`)

Same `HubShell`. Content column shows:

- Three stat cards: Bundles on hub, Open sessions, Pending sync.
- "Sync now" button (duplicated into the sidebar nav for convenience, since the hub
  model requires the invigilator to pull bundles when a connection is available).
- Session list with open/closed badge, View PINs (existing modal unchanged), and
  Open/Close actions. Empty state explains how to pull bundles.

## What was deliberately not changed

- No server code, no API shapes, no `shared/exam-rendering/*` logic, no DB schema.
- The existing PIN-download modal (txt/csv/docx) is untouched.

## Verification

- `npm test` (hub): 19/19 pass — behaviour unchanged, as intended.
- `tsc --noEmit` server + SPA: clean.
- `npm run build:spa`: builds.
- Headless-Chrome walkthrough (screenshots `01–06` in
  `%TEMP%\opencode\shots`): login → student dashboard → exam start → exam question
  view → admin login → admin dashboard — all render with fonts/icons/styles,
  no console errors beyond the known favicon 404.
