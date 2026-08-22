# Design: Android APK (Capacitor) + FCM Push Notifications

**Date:** 2026-08-22
**Status:** Approved
**Scope:** Add an installable Android app for the existing marksheet web platform. The app shares the platform's database and infrastructure (no backend rewrite). Real-time push notifications replace reliance on SMS/WhatsApp/email notifications.

---

## 1. Goals & Non-Goals

### Goals
1. One installable APK serving **all roles** (staff, students, parents, admins) — the app is a thin native shell around the existing hosted Next.js site.
2. Same database, same sessions, same features — zero changes to how the web app works.
3. FCM push notifications delivered when in-app notifications are created, with deep-link routing on tap.
4. Cloud (GitHub Actions) build producing a downloadable APK artifact.
5. Per-school white-label builds possible later via config only.

### Non-Goals
- No React Native/Flutter rewrite; no offline exam-taking on phones (offline LAN exams remain PC-based per PRD 06).
- No Play Store publishing in this phase (direct APK distribution).
- No iOS app.
- No change to the existing SMS/WhatsApp/email template pipeline.

## 2. Architecture

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│  Android APK        │  HTTPS  │  Existing Next.js server         │
│  (Capacitor shell)  │────────▶│  schoolname.myportal.sch.ng      │
│                     │         │                                  │
│  WebView loads the  │         │  Same code, same Prisma client   │
│  live site; login,  │         │  ┌────────────────┐              │
│  roles, exams,      │         │  │ PostgreSQL     │  unchanged   │
│  results unchanged  │         │  └────────────────┘              │
│                     │         │                                  │
│  FCM token ────────▶│         │  NEW: /api/push/register         │
│                     │         │  NEW: push fan-out on events     │
└─────────┬───────────┘         └────────────────┬─────────────────┘
          │            ▲                         │
          │   push     │                         ▼
          └────────────┴──────────── Google FCM servers
```

- The APK contains almost no UI: it opens the configured URL in the system WebView and adds native capabilities (push, back-button handling, status-bar styling).
- Sessions persist via cookies inside the WebView; all role-scoped behaviour comes from the server as today.
- Entry flow (v1): app opens the main domain; school discovery uses the existing redirect behaviour. A dedicated multi-school picker page is future work, not part of this build.

## 3. Mobile App Structure (`mobile-app/`, sibling of `marksheet/`)

```
mobile-app/
├── app.config.ts          # single source of truth: appName, packageId,
│                          # defaultUrl, themeColor, icon/splash paths
├── capacitor.config.ts    # generated from app.config.ts values
├── android/               # native project — committed to git so CI builds are reproducible
├── src/
│   ├── index.html         # loader screen → WebView navigates to APP_URL
│   └── push-listener.js   # foreground message handling + tap deep-link routing
├── package.json           # @capacitor/core, @capacitor/android,
│                          # @capacitor/push-notifications
└── README.md              # branding/rebuild instructions
```

Decisions:
- **Package ID**: `com.myportal.marksheet` (permanent identity; changing later = reinstall).
- **Icons/splash**: placeholder assets wired via config; replacing logo = drop files in one folder.
- **Push permission** requested after first successful login, not at first launch.
- The `android/` folder is committed rather than generated in CI for reproducibility.

## 4. Push Notification System (server side)

### 4.1 Database — new model `PushDevice`

```prisma
model PushDevice {
  id        String   @id @default(cuid())
  userId    String
  fcmToken  String   @unique
  schoolId  String?
  platform  String   @default("android")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_devices")
}
```

One row per device; a user may have many. Logout deletes the caller's rows.

### 4.2 Registration API

- `POST /api/push/register` — body `{ fcmToken, platform }`. Server resolves the user **from the session cookie** (never from the body). Upserts by token; stamps userId/schoolId.
- `POST /api/push/unregister` — deletes rows for that token (called on logout).

Client bridge — two halves:
1. **Web side** (`marksheet/src/components/CapacitorBridge.tsx`, mounted once in the root layout):
   Detects Capacitor native environment (`Capacitor.isNativePlatform()`); no-op in normal browsers.
   On authenticated route load → requests permission once → listens for the `registration`
   event → POSTs the token to `/api/push/register`. Handles foreground message presentation.
   (Works because Capacator injects its JS bridge into every page the WebView loads.)
2. **Native side** (mobile-app): on cold-start from a notification tap, reads `data.url`
   and points the WebView at it before first render.

### 4.3 Sending — `src/lib/notifications/push.ts`

- Talks to **FCM HTTP v1 API** using OAuth2 service-account credentials signed with Node's built-in `crypto` (RS256 JWT → access token). **Zero new npm dependencies.**
- Env vars (server `.env`): `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`.
- Public helper: `sendPushToUser(userId, { title, body, url?, data? })`
  - Looks up devices for the user, sends to each.
  - Prunes tokens that return `UNREGISTERED` / `INVALID_ARGUMENT`.
  - Fire-and-forget with logged failures; never blocks or fails the triggering web request.
- Access-token caching to avoid minting a JWT per send.

### 4.4 Integration point — one choke point

Wire into `createNotification` in `src/lib/notifications/actions.ts`:
> Every time an in-app Notification row is created for a recipient → also call `sendPushToUser(recipientId, …)`.

Consequences:
- All existing and future events (results published, student sign-in/out, announcements, fee flags…) gain push automatically; no edits to the 20+ call sites or to `event-hooks.ts`.
- SMS/WhatsApp pipeline (templates, addon gating, queueing) remains untouched.
- Tapping routes via an eventType→URL map (e.g. `result_published` → parent result page); unknown events open the app home.

### 4.5 User control

- Parent Settings screen gains a **push toggle** alongside the existing SMS/WhatsApp toggles (`pushActive`, default true), persisted in the existing `notificationPreferences` JSON field.
- School-level config untouched: push is not metered/billed, so no addon gate.

## 5. Build Pipeline

`.github/workflows/build-apk.yml`:
- Triggers: `workflow_dispatch` + tags `v*`.
- Steps: checkout → Node 20 → JDK 17 → `npm ci` in `mobile-app/` → Gradle `assembleDebug` → upload APK artifact.
- Debug-signed APK is immediately sideloadable. Release signing added later via repo secrets (`KEYSTORE_BASE64`, passwords) without workflow redesign.

## 6. One-time Firebase setup (documented in README)

1. Create free Firebase project.
2. Add Android app with package id `com.myportal.marksheet` → download `google-services.json` → place in `mobile-app/android/app/`.
3. Generate a service account key → set `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` in the server `.env`.

## 7. Error Handling

| Failure | Behaviour |
|---|---|
| FCM unreachable / rate-limited | Failure logged; in-app Notification row already exists; request path unaffected |
| Stale/expired device token | Token pruned on next send; other devices unaffected |
| App offline | WebView error screen with Retry; push delivery unaffected (Google-side) |
| User logs out | Device rows unregistered; no notifications to stale sessions |
| Another user logs in on same device | Old token unregistered before re-register |

## 8. Testing

1. **Unit (vitest)**: push sender against mocked FCM responses — success, invalid token (prune path), auth failure, partial failure.
2. **Integration**: `/api/push/register` with valid session cookie → row created; without cookie → 401; duplicate token → upsert not duplicate.
3. **Manual checklist**: install APK → login each core role (staff, student, parent) → publish a result → receive push on parent device → tap opens correct page → logout stops pushes.

## 9. Rollout Order (summary)

1. Prisma model + migration (`db:push:both`)
2. Push sender lib + unit tests
3. Register/unregister API + session wiring
4. Hook into `createNotification` + parent settings toggle
5. `mobile-app/` Capacitor scaffold + push bridge
6. GitHub Actions workflow + README (Firebase setup, branding)
