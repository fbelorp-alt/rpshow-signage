---
name: LED panel canvas rotation
description: panelRotation field for panels mounted horizontally; player applies CSS transform
---

# Canvas rotation for LED panels

## What it does
`panelRotation` (0, 90, 180, 270) stored in DB. Player reads it and applies
`transform: [{ rotate: '${deg}deg' }]` to the canvas View.

## Use case
P3.9 LED modules are 128×256 (portrait). Mounted 3×3 horizontally:
- Width: 256×3 = 768px, Height: 128×3 = 384px (landscape panel)
- Device stays in portrait mode
- User sets: panelWidth=768, panelHeight=384, panelRotation=90°
- Player renders 768×384dp canvas and rotates it 90°

## Critical rule: canvas ALWAYS at top:0, left:0

```tsx
// CORRECT (v1.14.86+)
const canvasLeft = 0;
const canvasTop  = 0;
```

**Why:** NovaLCT reads the Android framebuffer starting at physical (0,0). Centering the
canvas on the device screen (old code: `(deviceW - width) / 2`) pushes the canvas to
~(150dp, 379dp) on a 412×870 device → physical (225px, 569px) → completely outside the
168×168 LED area → LED shows black.

For a **square panel** (w==h, e.g. 168×168), rotating around the view's own center (w/2, h/2)
keeps the bounding box in place — no centering needed.

**Old (wrong) code that caused 90°/270° black screen — DO NOT restore:**
```tsx
const canvasLeft = isCanvasTransposed ? (deviceW - width) / 2 : 0;  // BUG
const canvasTop  = isCanvasTransposed ? (deviceH - height) / 2 : 0; // BUG
```

## Remount key
Add `key={`canvas-rot-${panelRotationDeg}`}` to the outer canvas View.
Forces Android SurfaceView remount when rotation changes → prevents video freeze.

## Files changed
- `lib/db/src/schema/screens.ts` — panelRotation integer column, default 0
- `lib/api-spec/openapi.yaml` — panelRotation in Screen + ScreenUpdate
- `artifacts/api-server/src/routes/screens.ts` — SELECT includes panelRotation
- `artifacts/api-server/src/routes/player.ts` — basePayload includes panelRotation
- `artifacts/signage-dashboard/src/pages/screen-detail.tsx` — 4-button selector UI
- `artifacts/player-app/app/player/[code].tsx` — transform logic (canvasLeft/Top always 0)
