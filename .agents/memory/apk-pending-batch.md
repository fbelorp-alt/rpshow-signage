---
name: APK pending batch
description: Fixes already in code that are waiting to be bundled into the next EAS APK build
---

# Pending APK batch (do NOT build yet — accumulating fixes)

## Fixes already merged into source (not yet in APK)

1. **Tela preta com RSS ticker** — `displayItems` filtro remove RSS ticker da rotação de slides; só fica como overlay. Arquivo: `artifacts/player-app/app/player/[code].tsx`

2. **Detecção de divergência de horário** — PENDENTE DE IMPLEMENTAR. Comparar `new Date()` do dispositivo com timestamp do servidor (vem via API). Se diferença > 2 min, exibir banner vermelho. Mostrar timezone + horário do aparelho + horário do servidor no painel de admin (overlay ao tocar a tela). Instrução: "Ajuste em: Configurações > Data e Hora > Sincronizar via NTP".

## Last APK info
- Name: RPSHOW TV V6
- Version: 1.2.0, versionCode: 3
- EAS build ID: 0392d5a6-8c0f-4dc9-99a1-4ab3b790cf8f
- Profile: production, owner: rpshow
- Command: `EAS_NO_VCS=1 eas build --platform android --profile production --non-interactive`

**Why:** User wants to batch multiple player fixes into one APK build to avoid multiple installs on TV devices.

**How to apply:** When user says "build APK" or "gerar APK", check this file first, implement any PENDING items, then trigger EAS build.
