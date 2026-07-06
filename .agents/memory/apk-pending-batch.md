---
name: APK pending batch
description: Status atual dos builds EAS e lições aprendidas
---

# Estado atual

## APK em uso (TV box / Taurus)
- **v1.14.10 / versionCode 32** — última versão confirmada funcionando
- Conta: rpshowonsigns-team
- Créditos resetam em **01/08/2026** → só então buildar de novo

## Código no repo = v1.14.15 pronto para build
- owner: rpshowonsigns-team, projectId: 6d02b8e5-b4b4-4447-b965-c7d9096e4d68
- versionCode: 37
- Fix: playToEnd como disparo PRIMÁRIO (não timer) → elimina preto entre vídeos
- Timer de fallback em fallbackSeconds + 2s (caso playToEnd não dispare)
- SEM código de cache

## REGRA CRÍTICA: NÃO usar conta rpshowsignagerp
- Builds da conta nova (rpshowsignagerp) NÃO abrem em Taurus nem TB50
- Testado com v1.14.11, 12, 13 (com cache) e v1.14.14, 1.14.15 (sem cache)
- Confirmado: não é o código — é a conta EAS incompatível com NovaStar Taurus
- Causa provável: keystore diferente ou configuração de signing scheme

## Build command (quando créditos resetarem em 01/08)
```bash
cd artifacts/player-app
EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli build --platform android --profile tb10 --non-interactive --no-wait > /tmp/eas_build.log 2>&1 && grep -E "expo.dev|Error" /tmp/eas_build.log | tail -5
```
- Root .easignore agora exclui .git/.local/node_modules/attached_assets → arquivo ~70MB (antes 671MB)
- NÃO usar pipe | tail — mata o processo; usar > redirect

## Workaround para vídeos cortando (sem novo APK)
- No dashboard, setar duração de cada vídeo para 600s (10 min)
- O evento playToEnd nativo avança quando o vídeo termina de verdade
- Válido para v1.14.10 que está instalado nas TVs

## Lições
1. expo-file-system v57 (OOP e /legacy) = crash no Taurus. Nunca usar.
2. Conta rpshowsignagerp = builds que não abrem no Taurus/TB50. Nunca usar.
3. NÃO usar --clear-cache no EAS — cria .git/index.lock
4. Root .easignore resolveu o problema de 671MB → 70MB de upload
