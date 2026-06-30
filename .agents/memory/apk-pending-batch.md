---
name: APK pending batch
description: Fixes already in code that are waiting to be bundled into the next EAS APK build
---

# Pending APK batch (do NOT build yet — accumulating fixes)

## Fixes already merged into source (not yet in APK)

1. **Auto-reinício após crash** — ErrorFallback conta 5s e chama `reloadAppAsync()` automaticamente em produção. Botão "Reiniciar agora" em português.
2. **DateWidget** — widget de data (dia da semana + número grande + mês/ano em pt-BR)
3. **QRCodeWidget** — gera QR Code nativo a partir de URL usando react-native-qrcode-svg

## Last APK info
- Name: RPSHOW TV V8 (última build)
- EAS build ID: 34090a05-7fef-4615-8b7c-6ba26281ef95
- Profile: production, owner: rpshow_on
- Command: `EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive`

## What's in last APK (V8)
1. **WeatherForecastWidget** — widget de previsão do tempo (5 dias) via Open-Meteo
2. **metaJson parsing corrigido** — JSON.parse() antes de acessar campos
3. **isRssTickerItem metaJson fix** — mesmo fix de parsing
4. **objectFit support** — contentFit dinâmico para Image e VideoView

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first, implement any PENDING items, then trigger EAS build.
