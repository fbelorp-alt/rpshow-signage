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

## Key implementation detail
When rotating 90°/270°, React Native transform-origin is the VIEW CENTER.
The canvas must be positioned centered on the device screen (not top:0, left:0)
so the rotated output stays within bounds.

```tsx
const canvasLeft = isCanvasTransposed ? (deviceW - width) / 2 : 0;
const canvasTop  = isCanvasTransposed ? (deviceH - height) / 2 : 0;
```

**Why:** If canvas is at top:0, left:0 and rotated 90°, the rotated output overflows
off-screen because the transform pivots around the wrong center point.

## Files changed
- `lib/db/src/schema/screens.ts` — panelRotation integer column, default 0
- `lib/api-spec/openapi.yaml` — panelRotation in Screen + ScreenUpdate
- `artifacts/api-server/src/routes/screens.ts` — SELECT includes panelRotation
- `artifacts/api-server/src/routes/player.ts` — basePayload includes panelRotation
- `artifacts/signage-dashboard/src/pages/screen-detail.tsx` — 4-button selector UI
- `artifacts/player-app/app/player/[code].tsx` — transform + centering logic
