---
name: Auto-pairing TV Box
description: Como funciona o pareamento automático de devices — sem teclado, sem digitação manual.
---

## Regra
O endpoint `GET /api/devices/check/:serial` retorna `{ approved: true, screenCode, deviceToken }` quando o device está aprovado.
O player detecta esses campos e navega direto para `/player/[code]` sem precisar de input manual.

**Why:** TV Boxes não têm teclado — pairing manual é inviável. O server gera o token e salva em `screens.device_token`.

**How to apply:** Ao aprovar um device no DB, linke `screen_code` na tabela `devices`. No próximo poll do player (30s), ele auto-navega.

## Problema do 304 (caching)
Express gera ETags para respostas JSON. O player usava fetch sem `cache: "no-store"`, então enviava `If-None-Match` e recebia 304 com body cacheado (resposta antiga de "not approved"). Fix: `cache: "no-store"` no fetch do player.

## Serial real vs. serial exibido
O serial exibido na tela da TV Box (últimos 8 chars) pode ser diferente do Android ID real que o player envia ao servidor. Sempre verificar via `pm2 logs rpshow-api --lines 100 --nostream 2>&1 | grep "check"` para saber o serial real.

## Pair server-side via SQL
```sql
UPDATE devices SET screen_code='<CODE>', status='approved', approved_at=NOW()
WHERE serial='<SERIAL>' RETURNING serial, screen_code, status;
```
