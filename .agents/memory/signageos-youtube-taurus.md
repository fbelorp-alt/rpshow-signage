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
- Delay de retry após crash: **2500ms** (não 800ms)
- NUNCA usar `Linking.openURL` como fallback de crash → reinicia o SO Taurus
- Após 2 crashes: `advance("yt-crash-skip")` diretamente

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
2 tentativas (2s e 5s) são suficientes e seguras para o Chromium do Taurus.
