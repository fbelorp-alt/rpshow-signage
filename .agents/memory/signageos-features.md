---
name: SignageOS new features - screen groups and emergency alert
description: Implementation details and quirks for the screen groups and emergency alert features added to RPShow OnSign
---

## Screen Groups
- DB table: `screen_groups` (id, userId, name, color, createdAt)
- `screensTable` has `groupId` FK (nullable)
- Routes mounted at `/api/screen-groups` via `screenGroupsRouter`
- Push playlist to group creates a new active schedule in `schedulesTable` — `schedulesTable` does NOT have a `userId` column, do not try to set it
- Dashboard: `ScreenGroupsPanel` component inside `screens.tsx` (not a separate page)

## Emergency Alert
- DB table: `emergency_alerts` (id, userId, message, bgColor, textColor, isActive, expiresAt, createdAt)
- Routes mounted at `/api/emergency`
- Player route (`/api/player/:code`) checks `emergencyAlertsTable` for active alert belonging to `screen.userId` and includes `emergencyAlert` in response payload
- Player app shows fullscreen overlay (zIndex 999) when `data.emergencyAlert` is truthy
- Dashboard sidebar has `EmergencyAlertButton` — pulses red when alert is active

## api-zod export conflicts
- Whenever new inline request body schemas are added to openapi.yaml, the generated types in `types/` conflict with Zod schemas in `api.ts`
- Fix: add explicit `export { SomeName } from "./generated/api"` lines in `lib/api-zod/src/index.ts`
- Pattern: run codegen, note "has already exported" TS errors, add the names to index.ts

**Why:** Orval generates both TS types (types/) and Zod schemas (api.ts) with the same names for inline request body schemas. The barrel re-export causes ambiguity.
