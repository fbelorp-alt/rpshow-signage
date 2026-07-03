---
name: APK pending batch
description: Fixes already in code waiting to be bundled into next EAS APK build; current EAS build status
---

# Current APK State

## Completed builds (most recent first)

### TB10 (ARM64) — versionCode 22
- Build ID: 27ce2cd1-0a36-4b16-b01f-f8b79d50b333
- Download: https://expo.dev/artifacts/eas/vlmrLJiQnjZTmyaTOebxWntjh9xoIeLch7wTgek4j1Q.apk
- Finished: 2026-07-03 08:00 AM
- Has: new logo (RPShow onSign), serial registration + QR code, polling check

### TB1 (ARM32) — versionCode 22
- Build ID: 56c2c36f-8167-4133-8a92-e70d3adaa84b
- Download: https://expo.dev/artifacts/eas/u4VUIDpLaZfpzikk-ZEjIB5FuaLiXwzHeIXbP5YcUd4.apk
- Finished: 2026-07-03

## In Queue

### TB10 versionCode 23 (LED compact layout) — MOST RECENT CODE
- Build ID: d00b11b3-7629-4e71-88bf-984bf124cb0d
- Track: https://expo.dev/accounts/rpshow-onsign/projects/player-app/builds/d00b11b3-7629-4e71-88bf-984bf124cb0d
- Change: Pairing screen now shows compact box top-left (fits first LED module, 200px wide, 80px QR)

### TB10 versionCode 22 (earlier today)
- Build ID: c96064bf-b3a0-41d1-b87a-4f160fe7fd94 (also in queue, superseded by d00b11b3)

## Build command
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile <tb1|tb10> --non-interactive --no-wait`
Run from: `artifacts/player-app/`

## What's in the code (all deployed)
1. **New logo** — RPShow onSign branding (icon.png + logo.png in assets/images/, 2.2MB each)
2. **Serial registration** — reads Build.SERIAL → getAndroidId → getUniqueId → UUID fallback
3. **Compact LED pairing screen** — top-left corner, maxWidth 200px, black background (versionCode 23)
4. **Serial suffix-match in check endpoint** — "2872" resolves to "25616A000002872" (in API server code, needs redeploy to go live on vnnox-tracker.replit.app)

## Known issues
- EAS project archive is ~540MB (root node_modules not excluded by .easignore ../../ paths); functional but slow upload
- Novastar TB devices may report different serial formats (full hardware ID vs short device name suffix)

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first. Next version: 1.14.1 / versionCode 24 (bump versionCode in app.config.js).
