---
name: YouTube no Taurus TB10 Plus
description: Regras e fixes para YouTube funcionar no Taurus TB10 Plus sem travar/reiniciar
---

## v1.15.65 — ExoPlayer, não WebView
Chromium WebView no T10 Plus mata o processo (volta pro login). `androidLayerType=software` impede o vídeo de aparecer. Skip de playlist faz o YouTube nunca tocar.

**Caminho principal:** `resolveYouTubeStream` (InnerTube no aparelho, URL é IP-bound) → item vira `video` → expo-av/ExoPlayer (já funciona no Taurus).

**Fallback:** só se o stream falhar E o canário `rpshow_yt_mounting` não estiver ativo. HTML zero-JS + `androidLayerType=hardware`. Sem remount em crash.

NUNCA:
- `androidLayerType=software` no YouTube (vídeo some)
- filtrar youtube da playlist no boot (o vídeo não toca)
- JS extra no wrapper (postMessage/setTimeout)
- `Linking.openURL` (reinicia o SO Taurus)
