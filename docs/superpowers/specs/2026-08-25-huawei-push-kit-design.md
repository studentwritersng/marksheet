# Huawei Push Kit (HMS) Integration — Design

**Status:** Design only. Implementation pending Huawei AppGallery Connect credentials.

## Why
Our push is FCM-only. FCM requires Google Mobile Services (GMS). Most Huawei-branded
phones (Mate/P series, post-2019) ship without GMS, so they never get an FCM token
and receive **no system push** — though the in-app bell/inbox still updates via the
30s poll. Honor global devices usually have GMS and are unaffected. To cover Huawei
users we add **Huawei Push Kit (HMS)** as a parallel provider.

## Current state
- Android app: Capacitor PushNotifications → FCM. `build.gradle` applies `com.google.gms.google-services`.
- `push.ts` sends via FCM v1 API using `pushDevice.fcmToken`.
- `PushDevice` model: `fcmToken String @unique` is the device key (`prisma/schema.prisma:1453`).
- In-app unread badge + `/my-notifications` inbox already work without FCM (client poll).

## Approach
Add a second provider, selected per device by which token it has:

1. **Schema** — add `hmsToken String? @unique` to `PushDevice` (keep `fcmToken`).
   A Huawei-without-GMS device has `hmsToken` set and `fcmToken` null.
2. **Register route** (`src/app/api/push/register/route.ts`) — accept optional
   `hmsToken`. If present, upsert `where: { hmsToken }`; else the existing
   `where: { fcmToken }`. Honour the shared signing keystore (ties to the
   per-school APK design — the AppGallery Connect cert fingerprint must match it).
3. **Huawei provider** — new `src/lib/notifications/huawei-push.ts`:
   - Mint access token: `POST https://oauth-login.cloud.huawei.com/oauth2/v3/token`
     with `grant_type=client_credentials`, `client_id=HUAWEI_APP_ID`,
     `client_secret=HUAWEI_APP_SECRET`.
   - Send: `POST https://push-api.cloud.huawei.com/v1/{APP_ID}/messages:send`
     with `deviceTokens: [hmsToken]`, `message.notification: { title, body }`,
     `message.android.notification: { channel_id: "marksheet_notifications", sound: "marksheet_notification" }`
     (same channel/sound as FCM so the custom sound plays).
   - Entirely **env-guarded**: if `HUAWEI_APP_ID`/`HUAWEI_APP_SECRET` are unset it is a no-op.
4. **Delivery branching** (`push.ts` `deliverPushForNotification`) — for each device:
   if `fcmToken` present → FCM; if `hmsToken` present → Huawei. A device typically
   has exactly one; sending to whichever exists is harmless.
5. **Android app (mobile-app)** — integrate the HMS Push SDK + `agconnect-services.json`
   and, on Huawei devices, obtain the HMS token and POST it to `/api/push/register`
   (the `CapacitorBridge` already registers FCM; add the HMS branch there).

## Required from operator (blockers)
- A Huawei **AppGallery Connect** project/app with **Push Kit enabled**.
- **App ID** (`client_id`) and **Client Secret** (`APP_SECRET`).
- The app **signing certificate SHA-256** registered in AppGallery Connect — must
  match the keystore used to build the APK (the shared keystore from the per-school
  APK design).
- `agconnect-services.json` placed in the Android app.

## Files touched
- `prisma/schema.prisma` — `PushDevice.hmsToken`.
- `src/app/api/push/register/route.ts` — accept + upsert `hmsToken`.
- `src/lib/notifications/huawei-push.ts` — new provider (env-guarded).
- `src/lib/notifications/push.ts` — per-device FCM/Huawei branching.
- `mobile-app` `CapacitorBridge.tsx` + `android` HMS SDK wiring.

## Testing
- With `HUAWEI_APP_ID`/`SECRET` set and a Huawei test device: verify `hmsToken`
  stored, push delivered, custom sound plays.
- GMS devices keep using FCM — no regression.

## Out of scope
- Web Push (service worker) — not used; this is native push.
- Other OEM push (Xiaomi, OPPO, vivo) — future.
