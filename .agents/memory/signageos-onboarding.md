---
name: Onboarding wizard
description: Multi-step onboarding wizard that appears after first login to capture operator's job role, industry segment, and planned screen count.
---

## What it is
A 3-step modal wizard that appears automatically after login when `onboardingDone === false`.

## DB columns added to operatorsTable
- `onboarding_done` boolean NOT NULL DEFAULT false
- `segment` text nullable (industry/setor)
- `job_role` text nullable (cargo/função)
- `screen_count` text nullable (planned screens range)

## API
- `GET /api/auth/user` now DB-fetches the full operator row and merges `onboardingDone`, `segment`, `jobRole`, `screenCount` into the user response.
- `PATCH /api/auth/onboarding` (auth required) saves all 3 fields + sets `onboarding_done = true`.

## Frontend
- Component: `artifacts/signage-dashboard/src/components/onboarding-wizard.tsx`
- Injected in: `artifacts/signage-dashboard/src/components/layout.tsx`
- Dismiss is immediate (local state), PATCH is async fire-and-forget.
- `extUser.onboardingDone === false` (strict equality) triggers wizard — undefined (unauthenticated) does not.

**Why:** User wanted to track which business segment each client operates in (posto, supermercado, clínica, etc.) for business intelligence and deployment analytics.
