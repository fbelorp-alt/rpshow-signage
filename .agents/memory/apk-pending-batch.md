---
name: APK pending batch
description: Fixes already in code waiting to be bundled into next EAS APK build; current EAS build status
---

# Current APK State

## Completed builds (most recent first)

### TB10 (ARM64) — versionCode 25 — IN PROGRESS
- Build ID: 260e24f0-6709-4606-87bd-5bc9a8cdf92f
- Logs: https://expo.dev/accounts/rpshow-onsign/projects/player-app/builds/260e24f0-6709-4606-87bd-5bc9a8cdf92f
- Has: transition effects (cut/fade/slide/zoom), user blocking check, video crossfade optimized (350ms)

### TB1 (ARM32) — versionCode 25 — IN PROGRESS
- Build ID: 34d7484f-9324-4f80-be1b-bec9b8abce02
- Logs: https://expo.dev/accounts/rpshow-onsign/projects/player-app/builds/34d7484f-9324-4f80-be1b-bec9b8abce02
- Has: same as TB10

### TB10 (ARM64) — versionCode 24 — LAST COMPLETED
- Build ID: 5bce63e9-11c6-49ee-b959-f375638785d4
- Has: dual-slot crossfade, video preloading, Range Request fix, full serial display

### TB10 (ARM64) — versionCode 23
- Build ID: d00b11b3-7629-4e71-88bf-984bf124cb0d
- Download: https://expo.dev/artifacts/eas/B-zrDpZF1qU8G8hb4-K1p6ZD8AsQHxZJsoTNV8RLHeU.apk

### TB1 (ARM32) — versionCode 22
- Build ID: 56c2c36f-8167-4133-8a92-e70d3adaa84b
- Download: https://expo.dev/artifacts/eas/u4VUIDpLaZfpzikk-ZEjIB5FuaLiXwzHeIXbP5YcUd4.apk

## Build command
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile <tb1|tb10> --non-interactive --no-wait`
Run from: `artifacts/player-app/`

## Known issues
- EAS project archive is ~579MB (root node_modules not excluded by .easignore ../../ paths); functional but slow upload
- **TB50 (Novastar Taurus)** rejects newer APKs — installed older version manually via ViPlex. Next build should lower minSdkVersion. TB50 installs via ViPlex require ADB toggle ON in ViPlex Express User Software tab.

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first. Next version: 1.14.4 / versionCode 26 (bump both in app.config.js). Must test TB50 compatibility.
