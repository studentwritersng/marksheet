# Marksheet Mobile Shell

Thin Capacitor wrapper around the hosted Marksheet portal.
All features come from the website; this app adds push notifications
and an installable APK.

## Change branding (one place)

Edit `app.config.ts`: app name, package id, target URL.
After changing the package id you must regenerate: delete `android/`,
run `npx cap add android`, redo the two Google Services plugin edits
(see git history of this README's companion commit).

## Prerequisites

- **Node.js** 20 (local builds) — matches the CI runner.
- **Java 17** (JDK 17, e.g. Eclipse Temurin) — required by the Android Gradle build.
- **Android SDK** (command-line tools or Android Studio) with a platform & build-tools
  installed — only needed for **local** builds. The CI runner sets this up automatically.
- **Capacitor CLI** is a dev dependency of `mobile-app/`; no global install needed.

## Firebase setup (once)

The Google Services Gradle plugin (added in the previous task) **requires**
`mobile-app/android/app/google-services.json` to exist, or the build fails.

1. https://console.firebase.google.com → Create project (free Spark plan).
2. Project settings → Your apps → Add Android app → package id
   `com.marksheet.app` (must match `app.config.ts`).
3. Download `google-services.json` → save to `android/app/google-services.json`
   (i.e. `mobile-app/android/app/google-services.json`).
   - For local builds, keep this file on disk.
   - For the CI build you may instead store it as a base64 repo secret
     `GOOGLE_SERVICES_JSON` (the workflow decodes it into place). If you don't,
     the workflow expects a committed `google-services.json` in that path.
4. Project settings → Service accounts → Generate new private key →
   download the JSON. From it, set these on the WEB SERVER's `.env`:
   - `FCM_PROJECT_ID` = `project_id`
   - `FCM_CLIENT_EMAIL` = `client_email`
   - `FCM_PRIVATE_KEY` = `private_key` (keep `\n` escapes, keep quotes)

## Build an APK

### Cloud (recommended)
Repo → Actions → "Build Android APK" → Run workflow → download the
`app-debug-apk` artifact. The workflow also fires automatically on any `v*` tag.
The build runs `npx cap sync android` then `./gradlew assembleDebug` from
`mobile-app/android`.

### Local
From the `mobile-app/` directory:

```bash
npm install            # or: npm ci
npx cap sync android   # regenerate the native Android project from web assets/config
cd android
./gradlew assembleDebug # on Windows use: gradlew.bat assembleDebug
```

The convenience script `npm run apk:debug` does the sync + assemble for you.
Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Install on a device

- Cloud build: download `app-debug-apk`, copy `app-debug.apk` to a phone, open it,
  and allow "Install unknown apps".
- Local build: connect a device with USB debugging and run:

  ```bash
  adb install android/app/build/outputs/apk/debug/app-debug.apk
  ```

## Parent push opt-out

Parents can mute push notifications from inside the app at
`/parent/settings` via the **"App notifications (push)"** toggle. When off,
the device's push token is ignored for new events. Log out stops delivery
to that device; other devices/users are unaffected.

## Target portal URL

The WebView opens the URL hardcoded in `mobile-app/app.config.ts`
(`defaultUrl`, currently `https://myportal.sch.ng`). **Confirm the actual
production portal URL** before shipping and update `app.config.ts` if needed,
then re-run `npx cap sync android`. This value is mirrored into
`capacitor.config.ts` (`server.url`).

## Deploy reminder (database migration)

The push feature adds a `PushDevice` table to the Prisma schema. Before or at
deploy time you must apply the schema to the **production** database:

```bash
npm run db:push:online   # targets the production Neon connection (DATABASE_URL)
```

Run this against production Neon so the `PushDevice` migration lands alongside
the new server code that reads/writes it.

## Release signing (when going to Play Store)

Generate a keystore, base64 it into repo secrets
(`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`),
then switch the workflow's gradle task to `assembleRelease` with a
signing step — see Capacitor docs, "Deploying to Google Play".
