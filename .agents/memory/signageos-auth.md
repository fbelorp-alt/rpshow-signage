---
name: Multi-tenant auth refactor
description: Replit Auth (OIDC) integration — how auth guards, userId filtering, pairing codes, and libs are wired up
---

## Rule
Every user sees only their own data. `userId` is set server-side from `req.user.id` on create, and filtered on list queries. Each user has a unique `pairingCode` generated on first login.

**Why:** SaaS multi-tenant isolation — one Replit account = one tenant. Pairing code allows TVBoxes to self-register without a user account.

**How to apply:**
- `lib/db/src/schema/auth.ts` — `users` table has `pairingCode varchar(8) unique`. Generated on first login via `COALESCE(users.pairing_code, EXCLUDED.pairing_code)` so it's never overwritten on subsequent logins.
- `lib/replit-auth-web` — composite TS lib exposing `useAuth()`. tsconfig requires `composite`, `declarationMap`, `emitDeclarationOnly`, and `references: [api-client-react]`. Do NOT use `import.meta.env` inside the lib (no Vite, compiled with tsc).
- `artifacts/api-server/src/routes/auth.ts` — OIDC setup. `pairingCode` stored in session on login, returned by `/api/auth/user`.
- `artifacts/api-server/src/routes/screens.ts` — `POST /pair`: TVBox sends `{ pairingCode, name, location? }`, server finds user by pairingCode, creates screen with `userId`.
- `artifacts/api-server/src/routes/schedules.ts` — `POST /broadcast`: authenticated user sends `{ playlistId }`, server upserts active schedule for ALL screens belonging to that user.
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — attaches `req.user`; all routes can call `req.isAuthenticated()`.
- DB: `screens`, `media`, `playlists` have `userId text` (nullable).
- Dashboard `App.tsx` — `AuthGuard` wraps all routes except `/player/:code` and `/tv` (fullscreen, no auth).
- `layout.tsx` — user avatar/name + logout dropdown at sidebar bottom. Clients nav item removed.
- `dashboard.tsx` — shows pairing code prominently with copy button (uses `useAuth().user.pairingCode`).
- Route `/api/login?returnTo=/` — hardcoded `/` for returnTo (no import.meta.env in lib).
