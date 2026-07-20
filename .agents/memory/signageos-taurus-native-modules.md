---
name: Taurus Android — native module incompatibility
description: expo-brightness e expo-network crasham antes do JS carregar; New Architecture (Fabric) também causa tela preta em todos os perfis Taurus — SEMPRE desabilitada.
---

## Regra 1 — Módulos nativos crashando antes do JS
Nunca adicionar `expo-brightness`, `expo-network` ou outros módulos nativos Expo ao APK sem confirmar funcionamento em Taurus físico.

**Por quê:** Taurus usa Android customizado. Módulos que requerem APIs de sistema falham durante a inicialização — ANTES de qualquer JS rodar — causando tela preta imediata (sem crash visível).

**Solução:** Brightness → NovaStar HTTP API porta 7788 (loopback `127.0.0.1`). Não precisa de módulo nativo.

## Regra 2 — New Architecture (newArchEnabled) SEMPRE false
`newArchEnabled: false` em todos os perfis de build, incluindo arm64 (tb50, tb10, tb60).

**Por quê (diagnosticado em campo):** APK tb50 fat (arm64+arm32) com `newArchEnabled: true` causa tela preta após o "OK" de pareamento. Raiz: react-native-view-shot e react-native-safe-area-context crasham no Fabric renderer do Android Taurus. O ErrorFallback também crasha (usa useColors + useSafeAreaInsets), gerando cascata → tela preta pura.

**Perfis afetados:** tb50 usa `TARGET_ABIS` (não `TARGET_ABI`) → `isArm32 = false` → antes do fix, New Arch ficava habilitada acidentalmente. Agora fixado com `newArchEnabled: false` hardcoded.

## Regra 4 — expo-video plugin causa rejeição do APK no TB50
Nunca adicionar `"expo-video"` como plugin no `app.config.js` para builds Taurus.

**Por quê:** O plugin expo-video instala módulo nativo que faz o Android do TB50 rejeitar o APK inteiro durante instalação via ViPlex — fica "rodando" indefinidamente sem instalar. O TB10 Plus (t10plus) também é afetado a partir do v1.15.25 (quando expo-video foi adicionado ao plugin). Diagnosticado em jul/2026: v143 instalava, v153+ não instalava — única diferença era o plugin expo-video.

**Solução:** Remover o bloco `["expo-video", {...}]` do array `plugins` em `app.config.js`. O pacote pode permanecer em `package.json` sem ser declarado como plugin.

## Regra 3 — toLocaleTimeString com timeZone
Pode lançar exceção em Hermes/Android. Sempre envolver em try/catch com fallback manual (padStart de horas/minutos/segundos).
