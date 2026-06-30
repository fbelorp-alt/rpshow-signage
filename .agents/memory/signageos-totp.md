---
name: TOTP 2FA feature
description: TOTP 2FA with "remember device 30 days" implementation details and otplib v13 API quirks
---

## otplib v13 API (critical — not standard docs)

The v13 API changed completely from v12. `authenticator` does NOT exist.

Correct top-level sync API:
```ts
import { generateSecret, generateSync, verifySync, generateURI } from "otplib";
const secret = generateSecret();
const code = generateSync({ secret, algorithm: "sha1", digits: 6, period: 30 });
const result = verifySync({ token: code, secret, algorithm: "sha1", digits: 6, period: 30 });
// result.valid is boolean
const uri = generateURI({ issuer: "App", label: "username", secret, algorithm: "sha1", digits: 6, period: 30 });
// Note: uses "label" NOT "accountName"
```

**Why:** The class-based API (new TOTP()) is async and requires options differently. Use the top-level sync functions.

## Architecture

- `operatorsTable` gains `totpSecret` (nullable text) + `totpEnabled` (boolean, default false)
- `trustedDevicesTable` — new table: id, operatorId, token (unique), deviceName, createdAt, expiresAt
- Cookie name: `rpshow_device` (httpOnly, 30-day maxAge)
- Session cookie: `sid` (existing, from lib/auth)

## Login flow (2-step)

1. `POST /auth/login` — password OK + totpEnabled + device NOT trusted → returns `{ requiresTotp: true, tempToken }`
2. `POST /auth/totp/verify` — validates tempToken (in-memory Map, 5-min TTL), verifies code, creates session + optionally sets device cookie
3. On invalid code: server re-issues a new tempToken so user can retry without re-entering password

## Files

- `artifacts/api-server/src/routes/totp.ts` — all TOTP logic + exported helpers
- `artifacts/api-server/src/routes/auth.ts` — imports `createPendingLogin`, `isDeviceTrusted` from totp.ts
- `artifacts/signage-dashboard/src/pages/security.tsx` — setup/disable UI + trusted devices list
- `artifacts/signage-dashboard/src/pages/login.tsx` — 3-step form: credentials | totp | setup
- `/security` is in navItems (all users), not adminItems

## DB push done
Both `totp_secret`/`totp_enabled` columns and `trusted_devices` table were pushed to dev DB.
