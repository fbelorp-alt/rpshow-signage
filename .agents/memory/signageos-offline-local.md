---
name: Offline local sync (Viplex-like)
description: Envio de conteúdo para painéis sem internet via Wi-Fi local, igual ao Viplex da Novastar
---

# Modo offline local — Wi-Fi sem internet

## A ideia
Clientes que instalam painéis LED em locais sem internet (ou onde a instalação de internet é difícil). Hoje usam Viplex pra enviar vídeos via Wi-Fi local. Queremos oferecer a mesma experiência dentro do RPShow.

## Fluxo planejado
1. Técnico cria hotspot no celular/laptop (ou usa roteador local do local)
2. TB do painel conecta nesse Wi-Fi local
3. No dashboard (página "Envio Local"), o técnico descobre o TB na rede
4. Seleciona a playlist e clica Enviar
5. Vídeos + JSON da playlist vão do dispositivo do técnico → TB via Wi-Fi local
6. TB grava tudo e toca offline indefinidamente — sem internet nunca

## Arquitetura técnica
- **Player (TB)**: mini servidor HTTP local (Express ou similar em Expo/React Native)
  - Recebe POST com arquivos de vídeo e JSON de playlist
  - Grava em FileSystem.documentDirectory (mesmo local do cache offline)
  - Responde com progresso do download
- **Dashboard**: página `/envio-local`
  - Input de IP do TB (ou QR code exibido no TB com seu IP)
  - Lista playlists disponíveis
  - Botão Enviar → fetch direto pro IP local do TB
  - Barra de progresso do envio

## Descoberta do dispositivo
- Mais simples: TB mostra o IP na tela (ou QR code com o IP)
- Mais avançado: mDNS/Bonjour discovery (mais complexo no Expo)
- Recomendação: começar com IP manual / QR code

## Por que é valioso
- Atende clientes sem internet (mercados, eventos, locais remotos, etc.)
- Diferencial competitivo vs outros sistemas cloud-only
- Técnico resolve tudo no local com hotspot do celular

**Why:** Pedido direto do usuário — existe demanda real de painéis sem internet.
**How to apply:** Implementar após APK estável. Não bloqueia outras features.
