---
name: Rádio nativa e cenários
description: Decisões de domínio e compatibilidade para rádio contínua no player SignageOS.
---

Use apenas uma rádio por playlist. Ela toca nativamente com `Audio.Sound` durante toda a sequência visual; imagens não interferem e vídeos ficam mudos para evitar áudio duplicado. O catálogo global vem do Radio Browser, rádios verificadas entram na curadoria RPShow e cenários relaxantes usam vídeos licenciados do Pexels.

**Why:** O WebView/Chromium e múltiplas superfícies de reprodução são instáveis no Taurus. Mais de uma rádio ativa também torna indefinido qual áudio deve continuar durante os itens visuais.

**How to apply:** Ao adicionar uma rádio, substitua a rádio anterior da mesma playlist. Preserve um único ciclo de vida de áudio com retry serializado. Qualquer novo tipo visual deve respeitar o mute enquanto a rádio estiver ativa.