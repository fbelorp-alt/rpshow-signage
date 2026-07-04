---
name: APK pending batch
description: Fixes already in code waiting to be bundled into next EAS APK build; current EAS build status
---

# Current APK State

## Completed builds (most recent first)

### TB10 (ARM64) — versionCode 25 — LATEST INSTALLED ✅
- Build ID: 260e24f0-6709-4606-87bd-5bc9a8cdf92f
- Download: https://expo.dev/artifacts/eas/lcN1NTzb4ixDlHyr6CVajTG2QLGR1FFfAua_jNASCyE.apk
- Has: transition effects (cut/fade/slide/zoom), video crossfade optimized (350ms)

### TB1 (ARM32) — versionCode 25 — LATEST INSTALLED ✅
- Build ID: 34d7484f-9324-4f80-be1b-bec9b8abce02
- Download: https://expo.dev/artifacts/eas/h18BdVMRk40gKVlKI2-dvXO_2UVy7qJ3n8RJ46bLkVo.apk

## Pending fixes (in code, not yet in APK)

1. **Tela preta entre transições (fade/zoom)** — `advance()` now sets `nextOpacity=1` immediately before animating, so background never bleeds through. Previous code animated both opacities simultaneously causing mid-point transparency → black flash.
2. **Imagem timer compensado** — image advance timer now fires 350ms early (same as video 800ms early) so next item appears at exactly `durationSeconds`.

## Build command
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile <tb1|tb10> --non-interactive --no-wait`
Run from: `artifacts/player-app/`
Next version: bump versionCode 25→26, version "1.14.6"→"1.14.7" in `app.config.js`

## Known issues
- EAS project archive is ~579MB (root node_modules not excluded by .easignore ../../ paths); functional but slow upload
- **TB50 (Novastar Taurus)** rejects newer APKs — installed older version manually via ViPlex. Next build should lower minSdkVersion. TB50 installs via ViPlex require ADB toggle ON in ViPlex Express User Software tab.

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices. Do NOT suggest building APK unless user explicitly asks.

**How to apply:** When user says "build APK" or "gerar APK", check this file first. Bump version in `artifacts/player-app/app.config.js`.
