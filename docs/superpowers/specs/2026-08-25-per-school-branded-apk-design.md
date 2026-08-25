# Per-School Branded APK — Design

**Status:** Spec only. Implementation deferred.

## Goal
One command, `node scripts/brand.mjs`, reads `schools.json` and emits a signed, installable `dist/<slug>.apk` per school with:
- the school's logo as the launcher icon (legacy `mipmap-*` + adaptive foreground/background),
- a monochrome status-bar notification icon (so push alerts render correctly),
- the school's name as the app label,
- the school's login URL as the WebView `server.url`.

Shared `packageId` (`com.marksheet.app`) and one shared signing keystore → the existing FCM push keeps working unchanged.

## Approach
A single **Node script** (`mobile-app/scripts/brand.mjs`) orchestrates the whole pipeline. Chosen over a bash script because it parses the JSON manifest, edits `app.config.ts`, and shells out to `keytool`/`gradle` via `child_process`. Node is already in the toolchain.

## Per-school flow
1. **Patch config** — write `mobile-app/app.config.ts` with `appName`, `defaultUrl`, `backgroundColor`. `packageId` is intentionally left unchanged.
2. **Icon source** — copy the school `logo.png` → `mobile-app/assets/icon.png` (resized to ≥1024×1024 via `sharp` if smaller).
3. **Generate icons** — `npx capacitor-assets generate` (new `@capacitor/assets` devDependency) regenerates `android/app/src/main/res/mipmap-*` + adaptive `ic_launcher_foreground` / `ic_launcher_background` + splash from the logo and brand color.
4. **Monochrome notif icon** — a small `sharp` step emits `android/app/src/main/res/drawable-*/ic_stat_marksheet.png` (white silhouette on transparent) and wires it into the push notification config so the status-bar icon is correct.
5. **Sync** — `npx cap sync android` propagates `appName` → `strings.xml` and `server.url` → native config.
6. **Sign + build** — `android/app/build.gradle` gets a one-time `signingConfigs.release` reading env vars (`MARKSHEET_KEYSTORE`, `MARKSHEET_KEY_ALIAS`, `MARKSHEET_KEY_PASSWORD`, `MARKSHEET_STORE_PASSWORD`); the keystore is auto-created via `keytool` on first run if the env is absent. Then `./gradlew assembleRelease`.
7. **Output** — copy `android/app/build/outputs/apk/release/app-release.apk` → `mobile-app/dist/<slug>.apk` (gitignored).

## Keeping the repo clean
The script backs up and restores `app.config.ts` + `assets/` after each run, so the repo never ends up carrying one school's branding. `dist/`, the keystore, and the generated `assets/icon.png` are gitignored.

## Manifest schema (`mobile-app/schools.json`)
```json
[
  {
    "slug": "greenfield",
    "name": "Greenfield Academy",
    "url": "https://greenfield.marksheet.top/login",
    "logo": "logos/greenfield.png",
    "bgColor": "#0b6e4f"
  }
]
```
- `slug` — filesystem-safe id, used for the output filename `dist/<slug>.apk`; must be unique.
- `name` — app label (non-empty).
- `url` — HTTPS landing/login URL the WebView opens; must already resolve to that school's login on the portal.
- `logo` — path to a ≥1024×1024 PNG.
- `bgColor` — optional brand color for the adaptive background and splash.

## Files touched
- **New:** `mobile-app/scripts/brand.mjs`, `mobile-app/schools.json` (sample), `.gitignore` updates.
- **Edit:** `mobile-app/package.json` (add `@capacitor/assets` devDep + `brand` / `apk:release` scripts), `mobile-app/android/app/build.gradle` (add `signingConfigs.release`).

## Error handling
- Validate each manifest entry: unique slug, logo file exists, URL is `https`, name non-empty.
- If one school's build fails, continue the rest and exit non-zero with a summary of failures.
- If `keytool`/`gradle` is missing, fail with a clear message.

## Testing
- Build a sample school from a sample manifest → install APK on emulator/device → verify icon, app name, that it opens the school login URL, and that a push arrives with the correct status-bar icon.
- Verify `app.config.ts` is restored to generic Marksheet after the run (no school state committed).
- Verify `dist/` contains `<slug>.apk` for every school.

## Prerequisites (assumptions)
- The web portal already serves each school's login at its `defaultUrl` (multi-tenant by subdomain or slug). The script only *points* at that URL.
- Operator has Android SDK / gradle + Java (same as current debug builds).

## Out of scope (YAGNI)
- Unique `packageId` per school / per-school FCM (would need a separate `google-services.json`).
- Play Store upload (manual / MDM / sideload only).
- Per-school web app rebuilds (`server.url` is remote).
- Runtime school selection (the universal-APK option).
