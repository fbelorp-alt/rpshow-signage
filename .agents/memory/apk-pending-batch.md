---
name: APK pending batch
description: Fixes already in code that are waiting to be bundled into the next EAS APK build
---

# Pending APK batch (do NOT build yet — accumulating fixes)

## Fixes already merged into source (not yet in APK)

*(empty — all fixes are in the APK currently building: 34090a05-7fef-4615-8b7c-6ba26281ef95)*

## Last APK info
- Name: RPSHOW TV V7 (building)
- EAS build ID: 34090a05-7fef-4615-8b7c-6ba26281ef95
- Profile: production, owner: rpshow
- Command: `EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive`

## What's in this APK
1. **WeatherForecastWidget** — novo widget de previsão do tempo (5 dias) via Open-Meteo
2. **metaJson parsing corrigido** — JSON.parse() antes de acessar campos (city, days, feedUrl, displayMode)
3. **isRssTickerItem metaJson fix** — mesmo fix de parsing
4. **objectFit support** — contentFit dinâmico para Image e VideoView (contain/cover/fill)

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first, implement any PENDING items, then trigger EAS build.
