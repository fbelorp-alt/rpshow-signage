---
name: YouTube no Taurus TB10 Plus
description: Regras e fixes para YouTube funcionar no Taurus TB10 Plus sem travar/reiniciar
---

## Regra
O HTML wrapper do YouTube (buildYouTubeHtml) deve ser **minimalista, sem JS**.

**Why:** JS complexo no wrapper (postMessage IFrame API, addEventListener, múltiplos setTimeouts)
trava o Chromium WebView do Taurus TB10 Plus antes do vídeo iniciar → onRenderProcessGone em loop
→ reinicializa o sistema.

**How to apply:**
- `buildYouTubeHtml` = só HTML + iframe puro, sem nenhum `<script>` no wrapper
- `mute=1` já está no embedUrl → autoplay funciona sem JS adicional
- Delay antes de montar o WebView: **1500ms** (não 450ms)
- Delay de retry após crash: **2500ms** (não 800ms)
- NUNCA usar `Linking.openURL` como fallback de crash → reinicia o SO Taurus
- Após 2 crashes: `advance("yt-crash-skip")` diretamente

## Fix aplicado em v1.15.54
- Removido todo JS do buildYouTubeHtml
- Delays aumentados: mount=1500ms, retry=2500ms
- Linking.openURL removido (v1.15.53)
