---
name: LED panel canvas rotation
description: panelRotation field; correct approach for non-square panels (90°/270°) on Android
---

# Canvas rotation for LED panels

## What it does
`panelRotation` (0, 90, 180, 270) stored in DB. Player reads it and renders
content rotated to fill the physical LED panel, which may be mounted landscape
while NovaLCT/TB50 device is in portrait orientation.

## Use cases
- **Square panel** (168×168, w==h): rotate canvas View directly, canvasLeft=0, canvasTop=0.
  Rotating around own center keeps it at (0,0). Simple.
- **Rectangle panel landscape** (512×256) on portrait device (256×512):
  canvasW=256, canvasH=512 (SWAPPED). Rotate content INSIDE the canvas box — do NOT
  rotate the canvas itself. See architecture below.

## Architecture for 90°/270° non-square panels (CONFIRMED WORKING as of build #94)

```
Canvas outer View: canvasW×canvasH (256×512) — no rotation transform
└── Inner clip View: canvasW×canvasH, overflow:'visible' for transposed (NOT 'hidden'!)
    └── Content wrapper: width×height (512×256), overflow:'hidden', renderToHardwareTextureAndroid
        left=(canvasW-width)/2  e.g. (256-512)/2 = -128
        top=(canvasH-height)/2  e.g. (512-256)/2 = +128
        transform: [{ rotate: `${panelRotationDeg}deg` }]
        └── All content items (video, images, widgets) — designed at 512×256
```

**Why this works:**
- `canvasW/canvasH` = swapped panel dims → canvas stays within the device framebuffer (no negative coords on canvas itself)
- `renderToHardwareTextureAndroid` forces GPU to rasterize the FULL 512×256 content wrapper texture before transforms
- `overflow:'visible'` on inner clip view prevents layout-level pre-clipping of the content wrapper at left=-128
- The content wrapper's `overflow:'hidden'` clips content items to 512×256
- After rotate(90°), the 512×256 texture maps exactly to (0,0)-(256,512) — perfect fill

**Why previous attempts failed:**
- Rotating the CANVAS (512×256) itself → canvas extends outside 256dp screen → Android clips half before transform → black or partial screen
- `overflow:'hidden'` on inner clip view → clips content wrapper layout (-128 to 384) to (0 to 256) → only 256×256 strip survives → only half fills after rotation
- deviceW/deviceH centering → canvas pushed away from (0,0) → NovaLCT reads wrong framebuffer region

## Key variables

```tsx
const isCanvasTransposed = panelRotationDeg === 90 || panelRotationDeg === 270;
const width  = Math.round(panelWidth  / dpr); // content width  (e.g. 512dp)
const height = Math.round(panelHeight / dpr); // content height (e.g. 256dp)
const canvasW = isCanvasTransposed ? height : width;  // LED box width  (e.g. 256dp)
const canvasH = isCanvasTransposed ? width  : height; // LED box height (e.g. 512dp)
const contentLeft = isCanvasTransposed ? (canvasW - width)  / 2 : 0; // e.g. -128
const contentTop  = isCanvasTransposed ? (canvasH - height) / 2 : 0; // e.g. +128
// 180°: simple flip on canvas itself; 90°/270°: rotation on content wrapper only
const canvasTransform = panelRotationDeg === 180 ? [{ rotate: "180deg" }] : undefined;
```

## Critical rules
- **NEVER** use `deviceW`/`deviceH` for canvas positioning — NovaLCT reads framebuffer from (0,0)
- **NEVER** rotate the canvas itself for 90°/270° non-square panels
- **ALWAYS** set `overflow:'visible'` on inner clip view for transposed panels
- **ALWAYS** set `overflow:'hidden'` on content wrapper (clips items to content bounds)
- **ALWAYS** set `renderToHardwareTextureAndroid` on content wrapper for transposed

## DB / API fields
- `lib/db/src/schema/screens.ts` — `panelRotation` integer column, default 0
- `lib/api-spec/openapi.yaml` — `panelRotation` in Screen + ScreenUpdate
- `artifacts/api-server/src/routes/screens.ts` — SELECT includes panelRotation
- `artifacts/api-server/src/routes/player.ts` — basePayload includes panelRotation
- `artifacts/signage-dashboard/src/pages/screen-detail.tsx` — 4-button selector UI
- `artifacts/player-app/app/player/[code].tsx` — canvas + content wrapper render logic
