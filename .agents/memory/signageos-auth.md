---
name: Multi-tenant auth refactor
description: Replit Auth (OIDC) integration — how auth guards, userId filtering, and the lib are wired up
---

## Rule
Every user sees only their own data. `userId` is set server-side from `req.user.id` on create, and filtered on list queries.

**Why:** SaaS multi-tenant isolation — one Replit account = one tenant.

**How to apply:**
- `lib/replit-auth-web` — composite TS lib exposing `useAuth()`. tsconfig requires `composite`, `declarationMap`, `emitDeclarationOnly`, and `references: [api-client-react]`. Do NOT use `import.meta.env` inside the lib (no Vite, compiled with tsc).
- `artifacts/api-server/src/lib/auth.ts` — OIDC setup (openid-client). Session stored in DB via `connect-pg-simple`.
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — attaches `req.user`; all routes can call `req.isAuthenticated()`.
- `artifacts/api-server/src/routes/auth.ts` — `/api/login`, `/api/callback`, `/api/logout`, `/api/auth/user`.
- DB: `users` + `sessions` tables in `lib/db/src/schema/auth.ts`. `screens`, `media`, `playlists` have `userId text` (nullable).
- Dashboard `App.tsx` — `AuthGuard` wraps all routes except `/player/:code` and `/tv` (fullscreen, no auth).
- `layout.tsx` — user avatar/name + logout dropdown at sidebar bottom. Clients nav item removed.
- Route `/api/login?returnTo=/` — hardcoded `/` for returnTo (no import.meta.env in lib).
