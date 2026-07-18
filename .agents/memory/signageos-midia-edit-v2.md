---
name: Midia Edit V2 architecture
description: Key design decisions and crash-fix patterns in banner-editor.tsx V2 rewrite
---

## P0 crash fixes applied

**Stale closure (setScene bug):** `currentSceneIdx` from useState is stale inside setScenes callbacks. Fix: maintain `currentSceneIdxRef = useRef(0)`, update it inside a custom `setCurrentSceneIdx` wrapper, and read `currentSceneIdxRef.current` inside `setScenes(prev => ...)`.

**Division-by-zero in onPointerMove:** All resize/drag paths guard with `if (!rect.width || !rect.height) return` and `if (!Number.isFinite(...)) return` before any division.

**Timeline DnD race (HTML5 DnD → pointer events):** HTML5 `draggable` + dataTransfer caused index races on rapid drags. Replaced with `onPointerDown/onPointerMove/onPointerUp` + `setPointerCapture`. Target index computed from cursor X relative to container.

**Render guard:** `if (!scene || !Array.isArray(scene.elements)) return <loading>` before editor JSX.

## V2 scene model additions

```ts
interface Scene {
  id: string;             // nid() — stable React key, fixes DnD key bugs
  kenBurnsIntensity?: 1.05 | 1.08 | 1.12;
  mediaZoom?: number;     // 100–200, overrides mediaFit when >100
  mediaPanX?: number;     // -50..50, shifts backgroundPosition
  mediaPanY?: number;
}
```

Background CSS formula (zoom + pan):
```ts
const fit = zoom > 100 ? `${zoom}%` : (scene.mediaFit ?? "cover");
const posX = `calc(50% + ${panX}%)`;
// applied as backgroundSize + backgroundPosition
```

## Undo/redo (project-level, not per-scene)

Stack type: `{ scenes: Scene[]; idx: number }[]` (max 40 entries). `pushHistory()` called before every mutation. `undo()` / `redo()` swap via `setUndoStack`/`setRedoStack` inside functional updaters to avoid closure staleness. Keyboard: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.

## CSS scene transitions

CSS keyframes (`beTransFadeA`, `beTransSlideLeftA`, `beTransSlideRightA`, `beTransZoomA`) applied via className on the canvas wrapper. `sceneKey` counter triggers remount for animation reset. Class is cleared via `setTimeout(ms + 50)`.

## Text outline (V2)

No `-webkit-text-stroke` (causes layout shift). Instead, implemented via `text-shadow` with 4 directional shadows using `textStrokeColor` at ±`textStrokeWidth`px. Stored as `textStrokeColor?: string; textStrokeWidth?: number` on `CanvasElem`.

## Snap guides

Center snap: during `onPointerMove` dragging, if `|rawX - 50| < 1.5` → snap to 50. `setSnapGuide({ x: true })` shows a cyan vertical line; `y` shows a red horizontal line. Guide cleared on `pointerUp`.

## Left panel tabs: Mídia / Add / Fundo / Layers

Mídia tab uses `useListMedia()` from `@workspace/api-client-react`, filters `m.type === "image"`, renders thumbnails. Click → `addImageFromLibrary(url)` → overlay image element on canvas. Also has "Upload foto (fundo)" and "Fotos → Timeline" buttons.

**Why:** Allows reusing stored media without leaving editor.

## GitHub push pattern

```
GITHUB_PAT env var (not GITHUB_TOKEN)
PUT https://api.github.com/repos/fbelorp-alt/rpshow-signage/contents/{path}
Must include sha of existing file to update (not just create)
```
