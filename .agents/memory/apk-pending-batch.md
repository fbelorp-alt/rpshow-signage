---
name: APK pending batch
description: Fixes already in code waiting to be bundled into next EAS APK build; current EAS build status
---

# Current APK State

## Completed builds (most recent first)

### TB10 (ARM64) — versionCode 23 — LATEST
- Build ID: d00b11b3-7629-4e71-88bf-984bf124cb0d
- Download: https://expo.dev/artifacts/eas/B-zrDpZF1qU8G8hb4-K1p6ZD8AsQHxZJsoTNV8RLHeU.apk
- Has: compact LED pairing screen top-left, new logo, serial registration

### TB10 (ARM64) — versionCode 22
- Build ID: 27ce2cd1-0a36-4b16-b01f-f8b79d50b333
- Download: https://expo.dev/artifacts/eas/vlmrLJiQnjZTmyaTOebxWntjh9xoIeLch7wTgek4j1Q.apk

### TB1 (ARM32) — versionCode 22
- Build ID: 56c2c36f-8167-4133-8a92-e70d3adaa84b
- Download: https://expo.dev/artifacts/eas/u4VUIDpLaZfpzikk-ZEjIB5FuaLiXwzHeIXbP5YcUd4.apk

## Build command
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile <tb1|tb10> --non-interactive --no-wait`
Run from: `artifacts/player-app/`

## What's in the code (all deployed)
1. **New logo** — RPShow onSign branding (icon.png + logo.png in assets/images/, 2.2MB each)
2. **Serial registration** — reads Build.SERIAL → getAndroidId → getUniqueId → UUID fallback
3. **Compact LED pairing screen** — top-left corner, maxWidth 200px, black background (versionCode 23)
4. **Serial suffix-match in check endpoint** — "2872" resolves to "25616A000002872"

## Known issues
- EAS project archive is ~540MB (root node_modules not excluded by .easignore ../../ paths); functional but slow upload
- Novastar TB devices may report different serial formats (full hardware ID vs short device name suffix)
- **TB50 (Novastar Taurus)** rejects versionCode 23 APK — installed older version manually via ViPlex. Next build must lower minSdkVersion to maintain TB50 compatibility. TB50 installs via ViPlex require ADB toggle ON in ViPlex Express User Software tab.

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first. Next version: 1.14.1 / versionCode 24 (bump versionCode in app.config.js). Must test TB50 compatibility.
