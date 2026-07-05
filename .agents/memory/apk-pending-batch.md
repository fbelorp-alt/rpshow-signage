---
name: APK pending batch
description: Fixes already in code waiting to be bundled into next EAS APK build; current EAS build status
---

# Current APK State

## Builds in progress

### TB10 (ARM64) — versionCode 32 — v1.14.10 — IN PROGRESS ⏳ ← INSTALAR ESSA
- Build ID: 6c682dd5-9aac-4160-b946-0a30029d6817
- Monitor: https://expo.dev/accounts/rpshowonsigns-team/projects/player-app/builds/6c682dd5-9aac-4160-b946-0a30029d6817
- Fix: stable pool + pre-buffer correto (play+pause SEM seekBy) + sem seek na primeira ativação

### TB10 (ARM64) — versionCode 31 — v1.14.9 — NÃO INSTALAR ❌
- Build ID: 75ce92fa-a9c7-4e60-9635-3868d400e0b3
- Fix incompleto: removeu pre-buffer inteiro (ExoPlayer não bufferia sem play()) → pior

### TB10 (ARM64) — versionCode 30 — v1.14.8 — NÃO INSTALAR ❌
- Build ID: a8661294-3942-42e0-9280-4f20bf79a7f5
- Fix parcial: stable pool mas ainda tinha double seekBy

## Completed builds (reference)
- versionCode 29 — v1.14.7 — tinha tela preta 5s (bug original reportado pelo usuário)

## O que v1.14.10 faz diferente

**Raiz do problema:** dois `seekBy(-9999)` em sequência destruíam o buffer do ExoPlayer:
1. Pre-buffer (mount): play 80ms → pause → `seekBy(-9999)` ← flush do buffer!
2. Ativação: `seekBy(-9999)` de novo → play() ← ExoPlayer recomeça do zero → 5s

**Fix v1.14.10 (três partes):**
1. **Stable pool** (vídeos em parent estável, React não desmonta/remonta)
2. **Pre-buffer correto:** play() → pause() após 150ms — SEM seekBy. Pausa preserva o buffer do ExoPlayer; seek jogaria fora.
3. **Primeira ativação:** só play(), sem seek. Vídeo começa em ~150ms (imperceptível). Só no replay (segunda volta do loop) faz seekBy, que aí é seguro (buffer consumido).

## Build command (SOMENTE TB10)
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait`
Run from: `artifacts/player-app/`
Next: bump versionCode 32 → 33, version 1.14.10 → 1.14.11

## Known issues
- EAS project archive ~588MB; upload lento mas funcional
- **TB50 (Novastar Taurus)** rejeita APKs mais novos — instalar via ViPlex manualmente. ADB toggle ON no ViPlex Express.
- NÃO usar --clear-cache no EAS build — cria .git/index.lock que bloqueia tudo

**Why:** Usuário quer batch de fixes em um APK só. NÃO sugerir build APK sem o usuário pedir explicitamente.
