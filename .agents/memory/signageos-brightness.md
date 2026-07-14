---
name: Brightness control feature
description: Remote brightness control for player screens via heartbeat command system
---

# Brightness Control

## Architecture

**Dashboard → DB → Heartbeat → Player**

1. `POST /api/screens/:id/brightness` body `{ brightness: 0-100 }` → sets `screens.targetBrightness`
2. Player heartbeat `POST /api/player/:code/heartbeat` → server reads `targetBrightness`, clears it to `null`, returns `{ brightness: N }` with HTTP 200 (204 when no command pending)
3. Player reads heartbeat response; if `data.brightness` is a number → calls `expo-brightness` `setBrightnessAsync(value / 100)`

**Why one-shot (clear on read):** avoids re-applying brightness on every heartbeat; command fires once.

## Files

- `lib/db/src/schema/screens.ts` — `targetBrightness: integer("target_brightness")` column
- `artifacts/api-server/src/routes/player.ts` — heartbeat now returns JSON 200 when pending command
- `artifacts/api-server/src/routes/screens.ts` — `POST /:id/brightness` endpoint (auth-guarded)
- `artifacts/signage-dashboard/src/pages/brightness.tsx` — per-screen slider cards
- `artifacts/signage-dashboard/src/App.tsx` — `/brightness` route (operator + admin)
- `artifacts/signage-dashboard/src/components/layout.tsx` — Brilho button now active (was opacity-30)
- `artifacts/player-app/app/player/[code].tsx` — heartbeat reads brightness and applies via dynamic import of expo-brightness
- `artifacts/player-app/app.config.js` — `expo-brightness` plugin + `WRITE_SETTINGS` permission

## Notes

- `expo-brightness` installed as v57 (`pnpm add expo-brightness` in player-app)
- `WRITE_SETTINGS` Android permission required to change system brightness programmatically
- Dynamic `import("expo-brightness")` with try/catch so old APKs without the lib don't crash
- customFetch returns parsed body (not a Response object) — 204 returns undefined, 200+JSON returns the object
- Sidebar hint updated to "4 ativos · 2 em breve" (Brilho now active, Volume + Reiniciar still em breve)
- Needs new APK build to activate player-side brightness (any subsequent build will include it)
