# Platform Ad Popup — Design Spec

**Date:** 2026-08-27
**Status:** Approved (design)

## Goal

Allow the **platform owner** (console, `platform_owner` role) to push full-page
HTML "ads" to the dashboards of selected roles across all schools. When a
matching user logs in and lands on their dashboard, they see the ad as a wide
modal popup with a close button. Closing dismisses it for the current session
only — it reappears on the next login. The owner can set an expiry date and
delete each ad.

## Scope

- Platform-wide (global), **not** per-school. Distinct from the existing
  school-scoped `Announcement` model.
- Audience is configurable per ad via role checkboxes (all available roles).
- Content is an **uploaded `.html` file** rendered in a sandboxed iframe.
- Popup appears **on the admin dashboard only**.
- Default behavior when multiple active ads match a role: show the **single
  latest** active ad. (Queueing multiple sequentially is out of scope unless
  requested later.)

## Roles (target options)

From `SessionPayload.role` in `src/lib/auth/session.ts`:
`super_admin`, `platform_owner`, `proprietor`, `staff`, `student`, `parent`,
`referral`.

The console owner selects any subset via checkboxes. A user sees the ad only if
their session `role` is in the ad's `targetRoles`. (`platform_owner` uses the
console, not the `(app)` dashboard, so they won't see popups there — that is
expected.)

## Data Model

New Prisma model `PlatformAd` (global — no `schoolId` relation):

```prisma
model PlatformAd {
  id          String   @id @default(cuid())
  title       String
  blobUrl     String // public Vercel Blob URL of the uploaded .html
  targetRoles String[] // subset of SessionPayload.role values
  expiresAt   DateTime? // null = never expires
  active      Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([active, expiresAt])
  @@map("platform_ads")
}
```

## Components & Files

### 1. Upload endpoint — `src/app/api/console/ads/upload/route.ts`
- `POST`, restricted to `platform_owner` (use `getCurrentUser` + role check;
  reuse `isOriginAllowed` / CSRF defence from `src/app/api/upload/route.ts`).
- Validates: extension `.html`, MIME `text/html`, size cap **2 MB**.
- Stores to Vercel Blob (`access: "public"`) when `BLOB_READ_WRITE_TOKEN` is
  set; otherwise to `public/uploads` locally.
- Returns `{ url }`.

### 2. Server actions — `src/app/console/(main)/ads/actions.ts`
- `createPlatformAd({ title, blobUrl, targetRoles, expiresAt, active })` —
  requires `platform_owner`.
- `deletePlatformAd(id)` — requires `platform_owner`.
- `updatePlatformAd(id, { expiresAt?, active? })` — requires `platform_owner`.
- All validate input with `zod`; return `{ error }` on failure.

### 3. Console management UI — `src/app/console/(main)/ads/`
- `page.tsx` — server component; lists ads via Prisma; renders client.
- `client.tsx` — upload form (title, HTML file input, role checkboxes, expiry
  date input, active toggle) + table of existing ads with status
  (Active / Scheduled / Expired), target roles, expiry, **Delete** and
  edit-expiry controls. On delete, confirm then call action and refresh.

### 4. Public fetch endpoint — `src/app/api/platform-ads/route.ts`
- `GET ?role=...` — returns active, non-expired ads whose `targetRoles`
  include the role, ordered by `createdAt desc`. No auth required beyond the
  role param (data is public marketing content); filters server-side:
  `active = true AND (expiresAt IS NULL OR expiresAt > now())`.

### 5. Dashboard popup — `src/components/platform-ad-popup.tsx` (client)
- Mounted on `src/app/(app)/dashboard/page.tsx`.
- On mount, fetch `GET /api/platform-ads?role=<sessionRole>`.
- Pick the first (latest) ad. If `sessionStorage["ad-dismissed:<id>"]` is set,
  skip.
- Render a centered wide modal (~`90vw` × `85vh`, max ~`1100px`×`800px`) with a
  dimmed backdrop and an **X close button** top-right.
- Iframe: `<iframe src={blobUrl} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />`
  — sandboxed so uploaded scripts run in the isolated Blob origin, isolated
  from the app's cookies/session.
- Close → set `sessionStorage["ad-dismissed:<id>"] = "1"`; backdrop click also
  closes. Reappears on the next session/login (new `sessionStorage`).

### 6. Console nav entry
- Add the new "Ads" page to the console sidebar (`src/app/console/(main)/sidebar.tsx`)
  so the owner can reach it.

## Behavior Details

- **Dismissal:** per-ad, per-session via `sessionStorage`. Survives page
  navigation within the session; cleared on new login → ad shows again.
- **Expiry:** server-side filter; expired ads never returned. Owner can also
  deactivate (`active=false`) or delete.
- **Role matching:** exact match on `SessionPayload.role`.

## Security

- Management and upload endpoints gated to `platform_owner`.
- Upload validates file type and size.
- Rendered in a sandboxed iframe pointing at the Blob (separate) origin so
  uploaded scripts cannot access the app's session/cookies.
- Reuse existing `isOriginAllowed` CSRF check on the upload route.

## Testing

- Unit/integration (vitest):
  - `createPlatformAd` rejects non-owner; accepts owner; persists row.
  - `deletePlatformAd` removes row; non-owner rejected.
  - `/api/platform-ads` filters by role, expiry, and active correctly
    (active+future returned; expired/active=false/invalid-role excluded).
- Manual:
  - Owner uploads an HTML file with a script; admin of a targeted role sees the
    popup on dashboard; close hides it for the session; new login shows it
    again; non-targeted role never sees it; expired ad disappears.
