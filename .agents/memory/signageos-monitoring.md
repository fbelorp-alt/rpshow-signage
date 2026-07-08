---
name: SignageOS Monitoring Feature
description: Architecture and key decisions for the /monitoring page and screenshot upload flow
---

# Monitoring Feature

## Key decisions

**No userId filter on screens:** The `screensTable` has a `userId` column but existing screens were created before the multi-tenant refactor and have `userId = null`. All monitoring routes query ALL screens without filtering by userId. If multi-tenancy is added later, this must be revisited.

**Status logic:** online = `lastSeen` within 2 minutes, offline = `lastSeen` older than 2 min, never = `lastSeen IS NULL`. The `offlineMonitor.ts` (checks every 60s) already handles DB-level status flagging.

**Screenshot storage path:** Player captures via `react-native-view-shot`, sends JPEG base64 to `POST /api/monitoring/screenshot/:screenCode`. Server saves to object storage at `${PRIVATE_OBJECT_DIR}/screenshots/<uuid>.jpg`, stores `/objects/screenshots/<uuid>.jpg` in `screens.lastScreenshot`. Frontend resolves with `/api/storage${path}`.

**Player screenshot timing:** Android only (`Platform.OS === "android"`). First capture 10s after mount, then every 2 minutes. Silent failure. Uses `screenshotViewRef` on the root `<Pressable>` element.

**`lastScreenshot` dual use:** The column was already used by `logPlay` (stores `currentMediaUrl` for image/video items). The new screenshot endpoint overwrites it with a real device capture — which takes priority since it's always more recent.

**Routes registered:**
- `GET /api/monitoring` — all screens with status + last play
- `GET /api/monitoring/:id/plays` — last 50 plays for a screen
- `POST /api/monitoring/screenshot/:screenCode` — receives JPEG base64 from player

**How:**
- Why: Screens have no userId because they predate multi-tenant auth. Filter was removed to avoid returning empty lists.

**Styling was NOT theme-based:** `monitoring.tsx` was written entirely with inline `style={{...}}` hardcoded dark hex colors (unrelated to the actual monitoring architecture above). It has since been rewritten to theme Tailwind classes (`bg-card`/`border`/`bg-muted`/`text-muted-foreground`) matching `reports.tsx`. Any future styling assumption about a page must be verified with a fresh grep for hex colors — do not trust prior memory/progress notes claiming a page was "already fixed".
