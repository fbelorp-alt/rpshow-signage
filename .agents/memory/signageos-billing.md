---
name: Subscription billing system
description: SaaS subscription management — operator subscription fields, payments table, admin panel, client billing page, self-registration
---

## Schema additions to operators table
- `subscriptionStatus` text default 'trial' — trial/active/suspended/cancelled
- `trialEndsAt` timestamp nullable
- `trialDays` integer default 30
- `monthlyAmount` text default '80.00'
- `email`, `phone` text nullable

## New table: subscription_payments
- operatorId (int FK), referenceMonth (text YYYY-MM), status (paid/pending/overdue), amount, notes, paidAt, dueDate

## API routes (artifacts/api-server/src/routes/)
- `admin.ts` → mounted at `/api/admin/*` — requireAdmin middleware; GET/PATCH/DELETE operators, GET/POST/PATCH payments
- `billing.ts` → GET `/api/billing/me` — client's own billing info
- `auth.ts` → POST `/api/auth/register` — self-register with 30-day trial

## Frontend pages (artifacts/signage-dashboard/src/pages/)
- `admin.tsx` → `/admin` — admin-only; client list with expand, subscription dialog, payment recording, delete
- `financeiro.tsx` → `/financeiro` — client view; status card, payment history, support contact

## Navigation (layout.tsx)
- Admin role sees: Usuários + Painel Admin under "Administração" section
- Operator role sees: Financeiro under "Conta" section

## Login page
- Added "Não tem conta? Criar agora" link that shows register form (step === "register")
- Register creates account with 30-day trial, logs in immediately

## screensTable.userId is text, operatorsTable.id is int
- Use String(op.id) when looking up screen counts in countMap

**Why:** userId in screens was set as text("user_id") from original design; when joining with operators.id (serial/int) must convert.

## Admin user setup
- DB: `UPDATE operators SET role='admin', subscription_status='active' WHERE username='admin'`
- When new operators register they default to role='operator', subscriptionStatus='trial'
