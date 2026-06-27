---
name: SignageOS storage setup
description: Object storage wiring decisions for SignageOS media uploads
---

After upload, `objectPath` (e.g. `/objects/uploads/uuid`) is saved as the media `url` field.
The API serves it at `GET /api/storage/objects/{path}`.

**Why:** The media schema already has a `url` string field; reusing it avoids schema changes. The Zod validation was relaxed from `.url()` to `.min(1)` to accept relative object paths.

**How to apply:** When media `url` starts with `/objects/`, it's a stored file. When serving in the player, the browser fetches it as a relative URL through the proxy. ObjectUploader stores objectPath in a `useRef(Map)` keyed by `file.id` to correlate per-file upload responses with their objectPaths.

React overrides for Uppy peer deps go in `pnpm-workspace.yaml > overrides` (not package.json), using version strings like `react: "19.1.0"` (not `$react` variables which require root deps).

lib/object-storage-web requires `composite: true, declarationMap: true, emitDeclarationOnly: true` in its tsconfig to work as a workspace lib.
