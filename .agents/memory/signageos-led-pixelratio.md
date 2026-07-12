---
name: LED panel PixelRatio fix
description: Physical px vs logical dp mismatch when setting panelWidth/Height for LED panels in React Native player
---

# LED Panel PixelRatio Conversion

## The rule
`panelWidth`/`panelHeight` in the DB are stored as **physical pixels** (what the NovaLCT/hardware reports).
React Native layout uses **logical pixels (dp)**. Always divide by `PixelRatio.get()` before using as view dimensions.

**Why:** A device with 1.5× density maps 1 logical dp → 1.5 physical px. A 168×168 physical LED panel needs `Math.round(168 / 1.5) = 112` logical dp — exactly matching the user's empirical discovery that "112 works, 168 doesn't".

**How to apply:** In `[code].tsx`, always do:
```js
const dpr = PixelRatio.get();
const width  = panelWidth  > 0 ? Math.round(panelWidth  / dpr) : deviceW;
const height = panelHeight > 0 ? Math.round(panelHeight / dpr) : deviceH;
```

## UI clarification
- `screen-detail.tsx` description updated to say "Digite os pixels **físicos** do painel"
- The app converts automatically — user enters 168, player computes 112 dp internally

## Fixed in v1.14.81 (versionCode 98)
- `PixelRatio` added to React Native imports
- Canvas size calculation updated with `/ dpr`
