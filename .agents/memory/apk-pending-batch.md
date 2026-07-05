---
name: APK pending batch
description: Fixes já no código aguardando próximo build EAS; status de builds em andamento
---

# Current APK State

## Builds in progress

### TB10 (ARM64) — versionCode 33 — v1.14.11 — IN PROGRESS ⏳ ← INSTALAR ESSA
- Build ID: 60acf5e5-971a-4eae-9325-8cfd4ec72542
- Monitor: https://expo.dev/accounts/rpshowonsigns-team/projects/player-app/builds/60acf5e5-971a-4eae-9325-8cfd4ec72542
- Fix: cache local de vídeos (expo-file-system v57 OOP API: File/Directory/Paths)
  - initVideoCache() no app start: cria dir, valida manifest vs disco
  - prefetchVideo() em background: baixa mp4 para Paths.document/vcache/
  - getCachedUri() síncrono: retorna URI local ou null
  - Player usa URI local se disponível, senão streaming

## Builds anteriores instalados
- versionCode 32 — v1.14.10 — INSTALADO NO TV ← ainda em uso
  - Fix: stable pool + pre-buffer correto (play+pause SEM seekBy) + sem seek na primeira ativação
- versionCode 31 — v1.14.9 — NÃO INSTALAR ❌ removeu pre-buffer inteiro
- versionCode 30 — v1.14.8 — NÃO INSTALAR ❌ stable pool mas double seekBy
- versionCode 29 — v1.14.7 — tela preta 5s (bug original)

## expo-file-system v57 — nova API OOP (IMPORTANTE)
- Legacy API (documentDirectory, downloadAsync) JOGA EXCEÇÃO em runtime em v57
- Usar: `File`, `Directory`, `Paths` importados de `expo-file-system`
- Paths.document → document directory (Directory instance, persistente)
- new Directory(Paths.document, "vcache") → subdir instance
- dir.exists → boolean; dir.create({ intermediates: true }) → cria
- new File(dir, "nome.mp4") → file instance
- File.downloadFileAsync(url, fileInstance, { idempotent: true }) → Promise<File>
- file.exists → boolean; file.uri → string URI local; file.delete() → void

## Build command (SOMENTE TB10)
`EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait`
Run from: `artifacts/player-app/`
Next versionCode: 34, version 1.14.12

## Known issues
- EAS project archive ~588MB; upload lento (~10s) mas funcional
- **TB50 (Novastar Taurus)** rejeita APKs mais novos — instalar via ViPlex manualmente
- NÃO usar --clear-cache no EAS build — cria .git/index.lock que bloqueia tudo
- EAS CLI pode retornar exit -1 sem output na primeira tentativa; aguardar 10s e repetir

**Why:** Usuário quer batch de fixes em um APK só. NÃO sugerir build APK sem o usuário pedir.
