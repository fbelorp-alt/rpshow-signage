---
name: Device token auth
description: Como funciona autenticação do player via device_token; regras legacy; padrão de provisioning automático
---

## Regra atual (playerAuth.ts)

- **Sem X-Device-Token**: aceitar sempre (legacy / APK antigo). Se tela não tem device_token → gerar e salvar agora. Devolver em `res.locals.provisionedToken`; heartbeat ecoa `{ deviceToken }` no body para o player persistir.
- **Com X-Device-Token**: validar com timingSafeEqual contra `screens.device_token`.
- `assertAnyPlayerToken` (storage): ainda exige token válido (URLs de mídia levam `?token=`).

## Onde o token é gerado

1. **POST /screens** — gerado imediatamente após INSERT (fire-and-forget raw SQL).
2. **PATCH /devices/:id** com `status=approved` — se tela vinculada não tem token, gerar agora.
3. **GET /devices/check/:serial** — reutiliza token existente; gera só se NULL (NUNCA regera — evita token stale no player).
4. **assertPlayerAuth** — provisiona on-the-fly se tela ainda não tem token (compatibilidade total com telas legacy).

## Padrão de reuso (check endpoint)

`SELECT device_token FROM screens WHERE code = $code` → se não nulo, retornar o existente; senão gerar + UPDATE.
**Nunca gerar novo token a cada poll** — causa stale no AsyncStorage do player → heartbeat volta a falhar com 401.

## Player ([code].tsx)

- Lê `data.deviceToken` do heartbeat response → salva em AsyncStorage se ainda não tem token local.
- Envia `X-Device-Token` em toda requisição se `_deviceToken` setado.
- 401 em playlist fetch → limpa token + volta para pairing screen → re-pair automático.

## Seriais TV Box (Taurus TB)

- `getAndroidId()` devolve o ID real (ex: `1C518BB567DAF26E`); tela exibe só últimos 8 chars (`67DAF26E`).
- `resolveApprovedDevice` usa exact match + suffix LIKE match para cobrir ambos.
- Devices com serial curto (ex: `5697AFEF`) podem ser sufixo de outro serial completo — exact match tem prioridade.

## APK constants

- `STORAGE_KEY = "rpshow_screen_code"`, `TOKEN_KEY = "rpshow_device_token"`
- `setAuthTokenGetter(() => token)` de `@workspace/api-client-react` seta Bearer em todos `customFetch`
- URLs de mídia usam `?token=` via `resolveMediaUrl` (expo-av Video não suporta headers)
- On 401/404: limpa storage, reseta `_deviceToken`, navega para "/"

## VPS migration

`ALTER TABLE screens ADD COLUMN IF NOT EXISTS device_token text;`
`CREATE UNIQUE INDEX IF NOT EXISTS screens_device_token_uidx ON screens(device_token) WHERE device_token IS NOT NULL;`

**Why:** Telas ficavam "Desconhecido" porque: (a) heartbeat exigia token que não existia no cadastro; (b) check gerava novo token a cada poll tornando o token do player stale; (c) legacy path ausente bloqueava APKs sem token.
