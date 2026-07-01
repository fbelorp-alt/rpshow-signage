---
name: APK pending batch
description: Fixes already in code that are waiting to be bundled into the next EAS APK build
---

# APK V13 — COMPLETED ✅

## EAS Build info
- Build ID: 3f9fa3ff-f384-4bd4-a284-7f08f491e43a
- Download: https://expo.dev/artifacts/eas/f01OGwpMHlUJixwbfy37a4vt4fR-hSPyaKVmyvT2uvc.apk
- Version: 1.8.0 / versionCode 13
- Built: 2026-07-01, completed at 2026-07-01T05:27:01Z
- Expires: 2026-07-31
- Profile: production, owner: rpshow_on

## Features included in V13
1. Resolution float fix — Math.round() on screenW/screenH
2. ClockWidget, WeatherWidget (Open-Meteo), RssTicker
3. Play tracking (POST /api/player/:code/play)
4. App Gallery (WebView for external apps)
5. Emergency alert fullscreen overlay
6. Screenshot monitoring (react-native-view-shot, every 2 min)
7. Multi-tenant auth (Replit OIDC)

## Last APK before V13 (V12)
- Build ID: 98f2890f-ac51-4d3e-b377-a23c97c2d398
- Download: https://expo.dev/artifacts/eas/uV54-5Q73MhEZ4VY-NMR0hQreog13X3yQZIgn9Ou5Is.apk
- Version: 1.7.0 / versionCode 12

## Pending for V14
- (nothing pending yet)

## Build command
`EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive`

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first, implement any PENDING items, then trigger EAS build. Bump versionCode to 14 and version to 1.9.0 for next build.
