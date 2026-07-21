---
name: Device token auth (Etapa 2 Segurança)
description: Player endpoint protection with per-screen device tokens, storage access control, and APK pairing/re-pairing flow.
---

## The rule
Every player endpoint (`POST /:code/heartbeat`, `POST /:code/play`, `GET /:code`, monitoring screenshot endpoints) requires a valid `X-Device-Token` or `Authorization: Bearer` header matching the screen's `device_token` in the DB. Storage objects require either a dashboard session OR any valid device token (header or `?token=` query param). `/api/devices/check/:serial` returns only `{ status, approved }` — no screenCode/name leak.

**Why:** Unauthenticated player endpoints allowed any actor knowing a screenCode to inject play events, poll playlists, or access stored media. With token auth, each physical device has a secret that rotates on every re-pair.

**How to apply:**
- `assertPlayerAuth(req, res, screenCode)` — validates token for specific screen; returns `{id,code,userId}` or sends 401+null
- `assertAnyPlayerToken(req, res)` — validates against any screen; accepts header OR `?token=` (for Video/Image src URLs which can't set headers)
- Both live in `artifacts/api-server/src/lib/playerAuth.ts`
- Token generated at `/pair` as `randomBytes(32).toString("hex")`, stored in `screens.device_token`
- APK constants: `STORAGE_KEY = "rpshow_screen_code"`, `TOKEN_KEY = "rpshow_device_token"`
- APK mount: `setAuthTokenGetter(() => token)` from `@workspace/api-client-react` sets Bearer for all `customFetch` calls
- Media URLs use `?token=` appended in `resolveMediaUrl` via module-level `_deviceToken` (expo-av Video can't use headers)
- On 401 or 404: APK clears both storage keys, resets `_deviceToken`, calls `setAuthTokenGetter(null)`, navigates to "/"
- New APK pairing UX: after check returns `approved:true`, shows text input for pairing code (admin copies from dashboard → Telas page)
- VPS migration needed: `ALTER TABLE screens ADD COLUMN IF NOT EXISTS device_token text; CREATE UNIQUE INDEX IF NOT EXISTS screens_device_token_uidx ON screens(device_token) WHERE device_token IS NOT NULL;`
