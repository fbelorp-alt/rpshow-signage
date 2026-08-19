---
name: YouTube no Taurus TB10 Plus
description: Regras e fixes para YouTube funcionar no Taurus TB10 Plus sem travar/reiniciar
---

## Regra
O HTML wrapper do YouTube (buildYouTubeHtml) deve ter JS **mínimo e seguro**.

**Why:** JS complexo no wrapper (múltiplos addEventListener, setTimeouts em cadeia)
trava o Chromium WebView do Taurus TB10 Plus → onRenderProcessGone em loop → reinicializa o SO.

**How to apply:**
- `buildYouTubeHtml` aceita apenas 2 `<script>` simples: listener `yt:ended` + unmute via postMessage
- `mute=1` no embedUrl → autoplay funciona; unmute é enviado via IFrame API após início
- Delay antes de montar o WebView: **1500ms** (não 450ms)
- Delay de retry após crash: backoff 2s/4s (não 800ms)
- NUNCA usar `Linking.openURL` como fallback de crash → reinicia o SO Taurus
- `androidLayerType="software"` no WebView YouTube
- Após 2x `onRenderProcessGone`: skip 15 min (`rpshow_yt_skip_until`) e filtra youtube da playlist

## Canário de mount (v1.15.64) — crash mata o processo e volta pro login
`onRenderProcessGone` NÃO dispara quando o Chromium mata o processo inteiro.
Antes de montar o WebView YT: `AsyncStorage.setItem("rpshow_yt_mounting", timestamp)` (await).
No boot, se o flag ainda está setado: arma skip **30 min** e filtra youtube/youtube_playlist.
Limpa o flag no unmount normal e ao aplicar skip.

## Unmute — como fazer certo
`document.querySelector('video')` NÃO funciona no wrapper porque o vídeo está dentro de
um iframe cross-origin (youtube-nocookie.com). O único jeito é postMessage para o iframe:

```js
function unmute() {
  var f = document.querySelector('iframe');
  if(f && f.contentWindow) {
    f.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}','*');
    f.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}','*');
  }
}
setTimeout(unmute, 2000);
setTimeout(unmute, 5000);
```

Funciona porque o embedUrl já tem `enablejsapi=1` — a IFrame API aceita esses comandos.
No player atual: **um** setTimeout em 3s (múltiplos setTimeouts travam o Chromium do Taurus).
