---
name: Auto-pairing TV Box
description: Como funciona o pareamento automático de devices — sem teclado, sem digitação manual.
---

## Regra
O endpoint `GET /api/devices/check/:serial` retorna `{ approved: true, screenCode, deviceToken }` quando o device está aprovado.
O player detecta esses campos e navega direto para `/player/[code]` sem precisar de input manual.

**Why:** TV Boxes não têm teclado — pairing manual é inviável. O server gera o token e salva em `screens.device_token`.

**How to apply:** Ao aprovar um device no DB, linke `screen_code` na tabela `devices`. No próximo poll do player (30s), ele auto-navega.

## Problema do 304 (caching) — CORRIGIDO no servidor
Fix aplicado em `artifacts/api-server/src/routes/devices.ts`: headers `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache` adicionados no início do handler `/check/:serial`. Antes só havia fix client-side (`cache: "no-store"` no fetch), mas Express ainda gerava ETag e respondia 304. **Fix definitivo: server-side.**

## Serial real no TB50
O TB50 (Taurus) retorna `Application.getAndroidId()` com apenas **8 chars** (ex: `CBA7DB33`), diferente de outros devices que retornam 16 chars. O código exibido na tela DO É o serial a cadastrar — não há diferença entre "exibido" e "enviado" para o TB50.

Para confirmar o serial real de qualquer device: `pm2 logs rpshow-api --lines 100 --nostream 2>&1 | grep "check"` no VPS.

## Fluxo correto de cadastro (novo device)
1. Liga o device → app abre → mostra código na tela (ex: `CBA7DB33`)
2. Dashboard → Dispositivos → Novo → **esse código é o Serial**
3. Aprova
4. Em ≤30s o device auto-pareia e entra online

## Armadilha comum
Usuário confunde o código exibido na TV (serial) com o screen_code (gerado pelo servidor). Nunca inverter: serial vai no campo Serial, screen_code é gerado automaticamente na aprovação.

## VPS — limitações SQL
- `pgcrypto` NÃO está instalado → `gen_random_bytes()` não existe. Usar: `md5(random()::text || clock_timestamp()::text || id::text)`
- `device_token` já existe na tabela `screens` do VPS
- `screen_code` já existe na tabela `devices` do VPS

## Pair server-side via SQL
```sql
-- Aprovar device e definir screen_code
UPDATE devices SET screen_code='<CODE>', status='approved', approved_at=NOW(), name='<NOME>'
WHERE serial='<SERIAL>' RETURNING serial, screen_code, status;

-- Criar tela se não existir
INSERT INTO screens (name, code, status)
VALUES ('<NOME>', '<CODE>', 'unknown')
ON CONFLICT (code) DO NOTHING;
```

## Player volta ao QR code (diagnóstico)
Se o device pareia mas volta ao QR:
1. `curl -s "https://app.rpshow.com.br/api/devices/check/<SERIAL>"` — verifica resposta
2. `curl -s "https://app.rpshow.com.br/api/player/<SCREEN_CODE>" -H "X-Device-Token: <TOKEN>"` — verifica playlist
3. Se ambos retornam 200 → problema é crash no app → limpar dados via ADB
4. ADB precisa estar no **notebook local** na mesma rede, não no VPS

## ADB no TB50 (IP via NovaStar)
O software NovaStar mostra o IP do Taurus. Com o IP, do notebook local na mesma rede:
```bash
adb connect <IP_LOCAL>
adb shell pm clear com.rpshow.signageplayer
adb shell monkey -p com.rpshow.signageplayer -c android.intent.category.LAUNCHER 1
```
