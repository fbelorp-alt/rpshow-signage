---
name: APK pending batch
description: Status atual dos builds EAS e lições aprendidas
---

# Estado atual

## APK em uso (TV box / Taurus)
- **v1.14.10 / versionCode 32** — última versão confirmada funcionando
- Keystore vinculada à conta original **rpshowonsigns-team** (acesso perdido)

## Código no repo = v1.14.15 pronto para build
- owner: **rpshow-vnnox-on**, projectId: **b114afb8-b7ac-4b6e-b1e7-1e7335cf0b92**
- versionCode: 37
- Fix: playToEnd como disparo PRIMÁRIO (não timer) → elimina preto entre vídeos
- Timer de fallback em fallbackSeconds + 2s (caso playToEnd não dispare)
- SEM código de cache

## Situação das contas EAS (julho/2026)
- **rpshowonsigns-team** — conta original dona do projeto; ACESSO PERDIDO (nenhuma credencial funciona)
- **rpshow-vnnox-on** — conta atual no app.config.js; projeto criado, mas build ficou preso >1h na fila (nova conta gratuita sem billing ativado)
- **rpshowsignagerp** — NUNCA USAR: builds não abrem em Taurus/TB50 (keystore incompatível)
- Contas davidbelo / aquipao / rpshow_on / rpshow_sytem / rpshowsytem — testadas, sem acesso ao projeto original

## BLOQUEIO ATUAL: conta gratuita nova não processa builds
- Causa provável: Expo exige cadastro de cartão de crédito para liberar a fila de builds, mesmo no plano gratuito
- Solução planejada: criar conta nova no Expo com e-mail verificado + método de pagamento cadastrado (sem cobrança no free tier) e então buildar

## Build command (quando conta estiver desbloqueada)
```bash
cd artifacts/player-app
EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait 2>&1 | tee /tmp/eas_build.log
```
- Perfil tb10 = arm64-v8a, TARGET_ABI env setado pelo eas.json
- NÃO usar pipe | tail — usa > redirect ou tee
- Após submeter, monitorar com: `npx eas-cli build:view <ID>`

## Workaround para vídeos cortando (sem novo APK)
- No dashboard, setar duração de cada vídeo para 600s (10 min)
- O evento playToEnd nativo avança quando o vídeo termina de verdade
- Válido para v1.14.10 que está instalado nas TVs

## Lições
1. expo-file-system v57 (OOP e /legacy) = crash no Taurus. Nunca usar.
2. Conta rpshowsignagerp = builds que não abrem no Taurus/TB50. Nunca usar.
3. NÃO usar --clear-cache no EAS — cria .git/index.lock
4. Root .easignore resolveu o problema de 671MB → 70MB de upload
5. Contas Expo novas gratuitas ficam presas na fila — precisam de cartão cadastrado para builds processarem
6. `eas project:init --non-interactive --force` cria projeto novo; projectId precisa ser adicionado manualmente ao app.config.js (config dinâmico não é auto-editado)
