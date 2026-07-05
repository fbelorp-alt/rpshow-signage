---
name: APK pending batch
description: Fixes already in code waiting to be bundled into next EAS APK build; current EAS build status
---

# Current APK State

## Completed builds (most recent first)

### TB10 (ARM64) — versionCode 30 — v1.14.8 — IN PROGRESS ⏳
- Build ID: a8661294-3942-42e0-9280-4f20bf79a7f5
- Monitor: https://expo.dev/accounts/rpshowonsigns-team/projects/player-app/builds/a8661294-3942-42e0-9280-4f20bf79a7f5
- Fix: stable video pool (eliminates 5s black screen between videos)

### TB10 (ARM64) — versionCode 29 — v1.14.7 — PREVIOUSLY INSTALLED
- Had: per-element entrance animations, video background per scene, 16 gradient presets

## Pending fixes (in code, not yet in APK)
- None — all fixes included in v1.14.8 build above.

## Build command (SOMENTE TB10 — usuário não quer TB1)
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait`
Run from: `artifacts/player-app/`
Next version: bump versionCode e version em `app.config.js` (currently versionCode=30, version=1.14.8)

## Known issues
- EAS project archive is ~588MB (root node_modules not excluded by .easignore ../../ paths); functional but slow upload
- **TB50 (Novastar Taurus)** rejects newer APKs — installed older version manually via ViPlex. Next build should lower minSdkVersion. TB50 installs via ViPlex require ADB toggle ON in ViPlex Express User Software tab.

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices. Do NOT suggest building APK unless user explicitly asks.

**How to apply:** When user says "build APK" or "gerar APK", check this file first. Bump version in `artifacts/player-app/app.config.js`.
