---
name: Multi-screen campaigns + Proof of Play
description: How multi-screen campaigns work — DB schema, API logic, frontend grouping, and Proof of Play PDF generation
---

## The rule

`POST /api/schedules` accepts `screenIds: number[]`. When >1 screen is provided, a UUID `campaignGroupId` is generated and stored on every row. Single-screen calls set `campaignGroupId = null` (backward compat).

**Why:** Agencies like Boticário/Fiat run the same campaign on N screens simultaneously — they need a single logical unit (one card, one Proof of Play) but the DB model is still one row per screen.

## How to apply

- API: always check `screenIds.length > 1` before generating campaignGroupId. Single-screen posts from old clients still work (`screenId` alone, no `campaignGroupId`).
- Frontend `campaigns.tsx`: group by `campaignGroupId ?? "single-${id}"`. All operations (pause, delete, Proof of Play) target the full `ids[]` array of the group.
- Proof of Play: `openProofOfPlay(group)` opens a window, fetches `/api/reports/overview?from=…&to=…&screenId=N` in parallel for each screen, renders an HTML print layout, then calls `window.print()`. Only available for campaigns that have a date range (startAt or endAt).
- `schedules.tsx` modal also has multi-select checkboxes; falls back to `filterScreenId` or first screen if none selected (backward compat for single-screen users).

## Key files

- `lib/db/src/schema/schedules.ts` — `campaignGroupId: text("campaign_group_id")`
- `artifacts/api-server/src/routes/schedules.ts` — POST handler with `randomUUID()` and loop over targetIds
- `artifacts/signage-dashboard/src/pages/campaigns.tsx` — `CampaignGroup` interface, grouping useMemo, `openProofOfPlay()`
- `artifacts/signage-dashboard/src/pages/schedules.tsx` — `selectedScreenIds[]` in form state, `toggleScreenInForm()`
