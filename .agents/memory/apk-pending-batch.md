---
name: APK pending batch
description: Fixes já no código aguardando próximo build EAS; status de builds em andamento
---

# Current APK State

## Builds in progress

### TB10 (ARM64) — versionCode 34 — v1.14.12 — IN PROGRESS ⏳ ← INSTALAR ESSA
- Build ID: 123be871-5281-47ee-a1b0-470b27d3144e
- Monitor: https://expo.dev/accounts/rpshowonsigns-team/projects/player-app/builds/123be871-5281-47ee-a1b0-470b27d3144e
- Fix 1: cache local (expo-file-system v57 OOP)
- Fix 2: vídeos não cortam mais cedo — timer usa player.duration real via polling, fallbackSeconds é último recurso
  - Poll de 300ms, repete a cada 500ms até 6s, se não achar usa fallbackSeconds
  - Hard fallback: max(fallbackSeconds, player.duration) + 30s

### TB10 (ARM64) — versionCode 33 — v1.14.11 — IGNORAR ❌
- Build ID: 60acf5e5-971a-4eae-9325-8cfd4ec72542
- Só tem o fix de cache, NÃO tem o fix do timer de duração

## Builds anteriores instalados
- versionCode 32 — v1.14.10 — INSTALADO NO TV ← ainda em uso
  - Fix: stable pool + pre-buffer correto (play+pause SEM seekBy)
  - BUG: timer usa fallbackSeconds como corte fixo → corta vídeos longos cedo
- versionCode 31/30/29 — NÃO instalar

## expo-file-system v57 — nova API OOP (IMPORTANTE)
- Legacy API (documentDirectory, downloadAsync) JOGA EXCEÇÃO em runtime em v57
- Usar: File, Directory, Paths importados de expo-file-system
- Paths.document → document directory (persistente); dir.exists, dir.create({intermediates:true})
- new File(dir, "nome.mp4") → file.exists, file.uri, file.delete()
- File.downloadFileAsync(url, fileInstance, {idempotent:true}) → Promise<File>

## Build command (SOMENTE TB10)
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait`
Run from: artifacts/player-app/
Next versionCode: 35, version 1.14.13

## Known issues
- EAS CLI retorna exit -1 sem output nas primeiras tentativas; aguardar 15-20s e repetir
- EAS project archive ~588MB; upload lento (~10s) mas funcional
- TB50 (Novastar Taurus): instalar via ViPlex manualmente
- NÃO usar --clear-cache no EAS build — cria .git/index.lock que bloqueia tudo

**Why:** Usuário quer batch de fixes em um APK só. NÃO sugerir build APK sem o usuário pedir.
