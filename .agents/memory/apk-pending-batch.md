---
name: APK pending batch
description: Fixes já no código aguardando próximo build EAS; status de builds em andamento
---

# Current APK State

## Builds in progress

### TB10 (ARM64) — versionCode 35 — v1.14.13 — IN PROGRESS ⏳ ← INSTALAR ESSA
- Build ID: d420b471-7fc8-4b5f-af5e-ddb628cda945
- Monitor: https://expo.dev/accounts/rpshowsignagerp/projects/player-app/builds/d420b471-7fc8-4b5f-af5e-ddb628cda945
- Fix 1: cache local via expo-file-system/LEGACY (não OOP que crashava)
- Fix 2: timer usa player.duration real (poll 300ms, 12 tentativas), sem corte por durationSeconds
- Conta: rpshowsignagerp (nova conta — créditos zerados na rpshowonsigns-team)
- Project ID: c05e7cc5-37c6-4cd6-96b4-5bf6b42b3906

## Conta EAS — MUDANÇA IMPORTANTE
- Conta velha: rpshowonsigns-team — créditos gratuitos esgotados (resetam 01/08/2026)
- Conta nova: rpshowsignagerp — owner e projectId já atualizados no app.config.js
- EXPO_TOKEN no Replit Secrets = token da conta rpshowsignagerp

## Build command (SOMENTE TB10)
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait > /tmp/eas_build.log 2>&1 && grep -E "expo.dev|Error" /tmp/eas_build.log | tail -5`
Run from: artifacts/player-app/
IMPORTANTE: usar redirect para arquivo (> /tmp/eas_build.log) — pipe com | tail mata o upload de 589MB
Next versionCode: 36, version 1.14.14

## expo-file-system v57 — nova API OOP NÃO FUNCIONA NO ANDROID TV
- Legacy API (documentDirectory, downloadAsync) JOGA EXCEÇÃO via re-exports do módulo principal
- MAS expo-file-system/LEGACY funciona: documentDirectory, makeDirectoryAsync, downloadAsync, getInfoAsync, deleteAsync
- Sempre importar de "expo-file-system/legacy", NUNCA de "expo-file-system" direto para essas funções

## Versões anteriores
- versionCode 34 (v1.14.12): crashava — usava OOP nova (File/Directory/Paths) ❌
- versionCode 33 (v1.14.11): crashava — mesma OOP nova ❌
- versionCode 32 (v1.14.10): instalado no TV; vídeos cortam pelo durationSeconds
- versionCode 31/30/29: não instalar

## Known issues
- EAS CLI com | tail fecha pipe antes de upload 589MB terminar → exit -1 sem output
- Sempre redirecionar para arquivo: > /tmp/eas_build.log 2>&1
- EAS CLI pode precisar de 12-15s de espera entre tentativas (git lock do checkpoint)
- NÃO usar --clear-cache
- TB50 (Novastar Taurus): instalar via ViPlex manualmente

**Why:** Usuário quer batch de fixes em um APK só. NÃO sugerir build APK sem o usuário pedir.
