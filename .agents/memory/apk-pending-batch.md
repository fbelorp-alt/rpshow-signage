---
name: APK build history and account notes
description: Como fazer builds APK via GitHub Actions, perfis por device, lições e histórico
---

# Build pipeline

- **Repo:** fbelorp-alt/rpshow-signage
- **Secret:** GITHUB_PAT (no Replit secrets)
- **Dispatch via:** GitHub API PUT /contents + POST /dispatches — nunca EAS direto (créditos esgotados)
- **Conta EAS:** rpshow-vnnox-on — NUNCA usar rpshowsignagerp (keystore incompatível com Taurus/TB50)

# Perfis e ABIs

| Perfil | Env var | ABIs | Device | Tamanho | Install via ViPlex |
|---|---|---|---|---|---|
| t10plus | TARGET_ABI=armeabi-v7a | armeabi-v7a | T10 Plus | ~30MB | ✅ |
| tb1 | TARGET_ABI=armeabi-v7a | armeabi-v7a | TB1 | ~30MB | ✅ |
| tb10 | TARGET_ABI=arm64-v8a | arm64-v8a | TB10 | ~26MB | ✅ |
| tb10plus | TARGET_ABI=arm64-v8a | arm64-v8a | TB10 Plus | ~26MB | ✅ |
| tb60 | TARGET_ABI=arm64-v8a | arm64-v8a | TB60 | ~26MB | ✅ |
| **tb50** | TARGET_ABIS=arm64-v8a,armeabi-v7a | **fat ARM ambos** | TB50 | ~43MB | ✅ CONFIRMADO |
| preview | (nenhum) | universal | emulador | - | - |

**Regra do tb50:** usa TARGET_ABIS (plural, comma-separated) em vez de TARGET_ABI (singular).
app.config.js lê TARGET_ABIS → `abiFilters: ["arm64-v8a","armeabi-v7a"]` sem exclusão de packaging (fat APK).
withAbiFilter só aplica exclusão quando TARGET_ABI (singular) está setado.

# Versão atual no GitHub main

- **v1.14.91 / versionCode 109** (julho/2026)
- Inclui: URL padrão corrigida para app.rpshow.com.br, rotação LED, PixelRatio fix, todos os widgets.

# Histórico de builds relevantes

- **#51 (10/jul):** fat ARM ~43MB — instalou no TB50 via ViPlex sem ADB ✅
- **#88 (13/jul):** slim arm64-v8a 26MB — falhou no ViPlex por conflito de assinatura; funcionou via ADB
- **#89 (13/jul):** tb50 fat ARM ~43MB — **INSTALOU VIA VIPLEX CONFIRMADO** ✅

# Lições

1. TB50 via ViPlex exige **fat ARM** (arm64+armeabi-v7a). Slim arm64 falha se houver app antigo.
2. ADB consegue instalar slim arm64 mesmo com app antigo, desde que remova o anterior primeiro.
3. Keystore rpshowsignagerp → NUNCA USAR (builds não abrem em Taurus/TB50).
4. expo-file-system v57 (OOP / /legacy) → crash no Taurus. Nunca usar.
5. NÃO usar --clear-cache no EAS — cria .git/index.lock.
6. Contas Expo novas gratuitas ficam presas na fila (precisam de cartão cadastrado).
7. withV1Signing plugin: forçar V1+V2 signing em todos os signingConfigs — necessário para ViPlex.
