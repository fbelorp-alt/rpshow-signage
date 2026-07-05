---
name: APK pending batch
description: Status atual dos builds EAS e lições aprendidas
---

# Estado atual

## APK em produção (instalado na TV)
- **v1.14.10 / versionCode 32** — FUNCIONA ← usar este
- Download: https://expo.dev/accounts/rpshowonsigns-team/projects/player-app/builds/6c682dd5-9aac-4160-b946-0a30029d6817
- Conta: rpshowonsigns-team / projectId: 6d02b8e5-b4b4-4447-b965-c7d9096e4d68
- Fix: stable pool + pre-buffer (play+pause SEM seekBy) + sem seek na primeira ativação

## Código atual no repo = v1.14.10 EXATO
- Sem cache, sem timer fix — idêntico ao APK que funciona na TV
- owner/projectId revertidos para rpshowonsigns-team

## Créditos EAS
- **rpshowonsigns-team**: esgotados — resetam em **01/08/2026**
- **rpshowsignagerp** (nova conta criada pelo usuário): builds NÃO funcionam nas TVs
  - TB10 e TB50: app instala mas não abre (causa desconhecida — provavelmente configuração de build da nova conta)
  - NÃO usar mais esta conta para builds

## Próximos builds: usar SEMPRE a rpshowonsigns-team após 01/08
- Build command: `EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait > /tmp/eas_build.log 2>&1 && grep -E "expo.dev|Error" /tmp/eas_build.log | tail -5`
- Run from: artifacts/player-app/
- Usar redirect para arquivo (> /tmp/eas_build.log) — pipe com | tail mata upload de 589MB
- Próximo: versionCode 33, version 1.14.11

## Lições aprendidas (NÃO repetir)
1. expo-file-system v57 OOP API (File/Directory/Paths) = crash no Android TV. Não usar.
2. expo-file-system/legacy = compila mas também crasha em produção nessas TVs
3. Conta rpshowsignagerp = builds que não abrem. Não usar para este app.
4. NÃO usar --clear-cache no EAS — cria .git/index.lock
5. | tail fecha pipe antes de upload 589MB terminar → usar > /tmp/eas_build.log

## Workaround para vídeos cortando (sem novo APK)
- No dashboard, setar duração de cada vídeo para 600s (10 min)
- O evento playToEnd nativo avança quando o vídeo termina de verdade
- O timer grande (600s - 0.8s) nunca dispara antes do vídeo acabar

**Why:** Usuário quer batch de fixes em um APK só. NÃO sugerir build APK sem o usuário pedir.
