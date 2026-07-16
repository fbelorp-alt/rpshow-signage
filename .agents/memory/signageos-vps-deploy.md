---
name: VPS Deploy RPShow
description: Detalhes do deploy em produção no VPS Hostinger para app.rpshow.com.br
---

# VPS Deploy RPShow

## Ambiente
- Provider: Hostinger KVM1, Ubuntu 24.04
- IP: 179.197.77.205
- Domínio: app.rpshow.com.br
- Repo GitHub: fbelorp-alt/rpshow-signage (public)

## Stack em produção
- API: PM2 → `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- Dashboard: nginx serving `artifacts/signage-dashboard/dist/public`
- DB: PostgreSQL local, user=rpshow, db=rpshow
- SSL: Let's Encrypt via certbot (expira out/2026, renova automático)

## Causa raiz do build failure (esbuild 0.27.3)
O Replit usa git local sem `origin` — commita mas NÃO empurra pro GitHub automaticamente. Arquivos adicionados por commits do Replit (schema/locations.ts, screen-connections.ts, routes/locations.ts, etc.) nunca chegaram ao GitHub. O VPS clonava o repo sem esses arquivos → build falhava com "Could not resolve".

**Fix aplicado:** push explícito via GitHub API (Python script) para todos os arquivos missing. Depois, esbuild também precisou de fix: pre-bundle dos workspace packages (@workspace/db, @workspace/api-zod) em arquivos JS separados com `absWorkingDir` por pacote antes do build principal.

## Como atualizar o VPS
```bash
cd /var/www/rpshow && git pull origin main && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/signage-dashboard run build && pm2 restart rpshow-api
```

## Checklist para novos arquivos
Sempre que criar novos arquivos no Replit, fazer push explícito via GitHub API antes de tentar build no VPS. O script Python em `.agents/memory/` serve de referência.

**Why:** Replit git é isolado, sem remote origin. Só `build.mjs`, `drizzle.config.ts` etc. que foram editados via Python API chegam ao GitHub.

## .env do VPS
Variáveis necessárias: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `PORT=5000`.
Credenciais ficam apenas no arquivo `/var/www/rpshow/.env` no servidor — nunca no repositório.
