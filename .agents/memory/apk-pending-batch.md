---
name: APK pending batch
description: Fixes already in code that are waiting to be bundled into the next EAS APK build
---

# APK V13 — building (in progress)

## EAS Build info
- Build ID: 3f9fa3ff-f384-4bd4-a284-7f08f491e43a
- Logs: https://expo.dev/accounts/rpshow_on/projects/player-app/builds/3f9fa3ff-f384-4bd4-a284-7f08f491e43a
- Version: 1.8.0 / versionCode 13
- Profile: production, owner: rpshow_on
- Command: `EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive`

## Fixes included in V13
1. **Resolution float fix** — Math.round() on screenW/screenH so resolution is always "962x541" not "961.502x540.845"

## Last completed APK (V12)
- Build ID: 98f2890f-ac51-4d3e-b377-a23c97c2d398
- Download: https://expo.dev/artifacts/eas/uV54-5Q73MhEZ4VY-NMR0hQreog13X3yQZIgn9Ou5Is.apk
- Version: 1.7.0 / versionCode 12

## Build command
`EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive`

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first, implement any PENDING items, then trigger EAS build.
