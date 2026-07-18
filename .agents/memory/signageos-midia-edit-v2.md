---
name: Midia Edit V3 architecture
description: Key design decisions in banner-editor.tsx V2/V3 — crash fixes, transitions, animations, UX
---

## P0 crash fixes (V2 — still applies)

**Stale closure (setScene bug):** `currentSceneIdx` from useState is stale inside setScenes callbacks. Fix: maintain `currentSceneIdxRef = useRef(0)`, update it inside a custom `setCurrentSceneIdx` wrapper, and read `currentSceneIdxRef.current` inside `setScenes(prev => ...)`.

**Division-by-zero in onPointerMove:** All resize/drag paths guard with `if (!rect.width || !rect.height) return` and `if (!Number.isFinite(...)) return` before any division.

**Timeline DnD race (HTML5 DnD → pointer events):** Replaced with `onPointerDown/onPointerMove/onPointerUp` + `setPointerCapture`. Target index computed from cursor X relative to container.

**Render guard:** `if (!scene || !Array.isArray(scene.elements)) return <loading>` before editor JSX.

## V3 SceneTransition (11 types)
`none | fade | slideLeft | slideRight | slideUp | slideDown | zoom | wipeLeft | wipeRight | circle | colorBlock`

## V3 AnimationType (12 types)
`none | fadeIn | slideLeft | slideRight | slideUp | slideDown | zoomIn | zoomOut | bounce | pop | blurIn | typewriter`

## transitionMs: free number (V3)
Changed from union `300|500|800` to free `number` (slider 150–2000ms).

## CSS preview transitions
Classes `beTransWipeLeft/Right` use `clip-path:inset()`, `beTransCircle` uses `clip-path:circle()`.
`colorBlock` uses a React state overlay (`colorBlockOverlay`) — NOT a CSS class — because 2-phase fill+reveal requires JS timing (`setTimeout` at ms/2).

## Canvas 2D MP4 applyTransition
- `wipeLeft/Right`: `ctx.save(); beginPath(); rect(); clip(); drawImage(to); restore()`
- `circle`: same pattern with `ctx.arc(cx,cy,alpha*maxR,0,2π)`
- `colorBlock`: split STEPS in half — phase1 fills transColor over 'from', phase2 fills transColor over 'to' with decreasing alpha
- `slideUp/Down`: vertical offset on `drawImage`

## Ken Burns V3
`panLeft` / `panRight`: draw image at width `resW*(1+panAmt)`, shift `offsetX = t * panAmt * resW`.

## V3 UX additions
- Floating contextual toolbar (shrink bar below top toolbar when element selected)
- Canvas view zoom 50–200% (`canvasViewZoom` state, CSS `transform:scale()`, export unaffected)
- Timeline transition popover between clips (`transPop: number|null` → inline popover with grid + slider + "Aplicar a todas")
- Flip H/V per element (`flipX`, `flipY` on CanvasElem → CSS `scaleX(-1)/scaleY(-1)`)
- Image filters per element (`imgFilter: {brightness,contrast,saturate,preset}` → `buildElemFilter()` → CSS `filter`)
- `animDuration` slider (0.2–2.5s), `animLoop` toggle (preview only)
- Timeline reorder uses proportional clip widths — NOT fixed 64px

## Adding new transitions (checklist)
1. `SceneTransition` type union
2. `TRANS_PRESETS` const array
3. `TRANS_BADGE` record
4. `switchScene()` animClass map (or special JS handling like colorBlock)
5. `applyTransition()` in `captureAsVideo` (canvas 2D)
6. CSS `@keyframes` + class name if CSS-based

## GitHub push pattern
```
GITHUB_PAT env var (not GITHUB_TOKEN)
PUT https://api.github.com/repos/fbelorp-alt/rpshow-signage/contents/{path}
Must include sha of existing file to update (not just create)
```

## V2 scene model additions (still applies)
```ts
interface Scene {
  id: string;             // nid() — stable React key
  kenBurnsIntensity?: 1.05 | 1.08 | 1.12;
  mediaZoom?: number;     // 100–200
  mediaPanX?: number; mediaPanY?: number;  // -50..50
}
```

## Undo/redo (project-level)
Stack type: `{ scenes: Scene[]; idx: number }[]` (max 40). `pushHistory()` before every mutation.

## Text outline (V2, still applies)
No `-webkit-text-stroke`. 4-directional `text-shadow` via `textStrokeColor`/`textStrokeWidth`. Stored on `CanvasElem`.
