---
name: APK pending batch
description: Fixes already in code that are waiting to be bundled into the next EAS APK build
---

# APK V14 — PENDING BUILD (code ready, Expo credits exhausted)

## What's ready in code for V14
1. **New logo** — "RPShow onSign" branding replaces old "Painéis de LED" logo
   - `assets/images/icon.png` → new logo (app icon + splash screen)
   - `assets/images/logo.png` → new logo (login screen)
2. Version bumped: 1.9.0 / versionCode 14
3. App name: "RPSHOW TV V14"

## Why build is blocked
Expo account `rpshow_on` ran out of build credits for the billing period.
To unblock: upgrade at https://expo.dev/accounts/rpshow_on/settings/billing

## Last completed APK (V13)
- Build ID: 3f9fa3ff-f384-4bd4-a284-7f08f491e43a
- Download: https://expo.dev/artifacts/eas/f01OGwpMHlUJixwbfy37a4vt4fR-hSPyaKVmyvT2uvc.apk
- Version: 1.8.0 / versionCode 12
- Expires: 2026-07-31

## Build command (when credits are available)
`EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive --no-wait`
Run from: `artifacts/player-app/`

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first, implement any PENDING items, then trigger EAS build. Next version after V14: bump to 1.10.0 / versionCode 15.
