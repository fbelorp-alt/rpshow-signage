---
name: SignageOS auth — username/password + Turnstile
description: Full replacement of Replit OIDC with custom username/password system. Current state of the auth implementation.
---

## Decision
Replaced Replit Auth (OIDC) with custom username/password + Cloudflare Turnstile.

**Why:** Support multiple operators from different locations without tying auth to Replit accounts.

## Implementation (COMPLETE)

### Backend
- `lib/db/src/schema/operators.ts` — `operatorsTable` (id serial, username unique, passwordHash, name, role)
- `artifacts/api-server/src/lib/auth.ts` — session create/get/delete using existing `sessionsTable`
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — reads session from cookie or Bearer token
- `artifacts/api-server/src/routes/auth.ts` — POST /auth/login, POST /auth/logout, GET /auth/user, POST /auth/setup, POST /mobile-auth/token-exchange

### Auth flow
- `POST /api/auth/setup` — creates first admin (only when no operators exist); returns 409 if already done
- `GET /api/auth/user` — returns `{ user, setupRequired: boolean }`
- `POST /api/auth/login` — verifies Turnstile + bcrypt, sets `sid` cookie
- `POST /api/auth/logout` — clears cookie + deletes session
- Rate limiting: 5 attempts / 15 min per IP (in-memory Map)
- Turnstile: skips verification if `TURNSTILE_SECRET_KEY` env not set

### Frontend
- `lib/replit-auth-web/src/use-auth.ts` — login() → `/login`, logout() → POST /api/auth/logout
- `AuthUser` type: `{ id: string, username: string, name: string, role: string }` (updated in api-zod)
- `artifacts/signage-dashboard/src/pages/login.tsx` — dark login + first-time setup form with Turnstile widget
- `artifacts/signage-dashboard/src/App.tsx` — `/login` route added, AuthGuard redirects to `/login`
- `artifacts/signage-dashboard/src/components/layout.tsx` — uses `user.name` / `user.username`
- `artifacts/signage-dashboard/src/pages/dashboard.tsx` — pairingCode card removed

### Env vars (set when going to production)
- `VITE_TURNSTILE_SITE_KEY` — frontend sitekey (dev fallback `1x00000000000000000000AA` always passes)
- `TURNSTILE_SECRET_KEY` — backend secret (omit to skip verification in dev)

### DB
- `operators` table pushed to dev DB via `pnpm --filter @workspace/db run push`
- `screens`, `media`, `playlists` still have `userId` column (nullable, ignored — all shared across operators)
