---
name: SignageOS storage and player setup
description: Object storage wiring, Metro workspace fix, and APK pairing flow for SignageOS
---

## Object storage
After upload, `objectPath` (e.g. `/objects/uploads/uuid`) is saved as the media `url` field.
The API serves it at `GET /api/storage/objects/{path}`.

**Why:** The media schema already has a `url` string field; reusing it avoids schema changes. The Zod validation was relaxed from `.url()` to `.min(1)` to accept relative object paths.

**How to apply:** When media `url` starts with `/objects/`, it's a stored file. When serving in the player, the browser fetches it as a relative URL through the proxy. ObjectUploader stores objectPath in a `useRef(Map)` keyed by `file.id` to correlate per-file upload responses with their objectPaths.

React overrides for Uppy peer deps go in `pnpm-workspace.yaml > overrides` (not package.json), using version strings like `react: "19.1.0"` (not `$react` variables which require root deps).

lib/object-storage-web requires `composite: true, declarationMap: true, emitDeclarationOnly: true` in its tsconfig to work as a workspace lib.

## Metro workspace resolution (Expo player)
pnpm workspace symlinks are NOT followed by Metro by default → `Unable to resolve ./generated/api` error.

**Fix:** `artifacts/player-app/metro.config.js` must set:
- `config.watchFolders = [workspaceRoot]`
- `config.resolver.nodeModulesPaths` = both project and workspace node_modules
- `config.resolver.unstable_enableSymlinks = true`

## Player APK pairing flow
- Pairing screen calls `POST /api/screens/pair` with user's `pairingCode` (shown in dashboard)
- API returns the SCREEN's unique `code` (distinct from user's pairing code)
- APK saves returned screen `code` to AsyncStorage under key `rpshow_screen_code`
- On boot: checks AsyncStorage → if found, skips entry and goes straight to player
- "Desparear" in player overlay clears AsyncStorage and returns to pairing screen

## APK build config
- `artifacts/player-app/eas.json`: APK profiles (preview + production)
- `app.json`: package `com.rpshow.signageplayer`, landscape orientation, RECEIVE_BOOT_COMPLETED, Leanback launcher for Android TV
- Build: `eas build --profile preview --platform android` (requires Expo account + EAS CLI installed)
