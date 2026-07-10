---
name: Player video URI bug history
description: Root causes and fixes for blank screen / looping bugs in the Expo player video rendering
---

# Player video URI — bug history

## Bug 1: blank screen (v34/v35 → fixed in v38)

**Symptom:** Screen totally black. VideoPlayer never renders. No advance timer for videos. Player permanently stuck.

**Root cause (v34/v35):** `currentVideoUri` was computed via ref mutation DURING render (anti-pattern). On first render (no data), ref was set to null for index 0. On second render (data arrived), index was still 0 so the reset was skipped — but the fill condition also was never reached because the pattern assumed only one render per index. VideoPlayer received `null` URI → didn't render → no `onEnd` → no advance.

**Root cause (v37 attempt):** Used `useState` + `useEffect`, but derivation was `currentVideoUri = videoState`. During the render IMMEDIATELY after `advance()` (e.g. index 3→0), the state still held the OLD index's URI. VideoPlayer remounted (key changed) but received the wrong URI — causing the wrong video to replay.

**Final fix (v38):** Use `videoState = {index, uri}` and derive `currentVideoUri = videoState.index === currentIndex ? videoState.uri : null`. When `currentIndex` advances, `videoState.index` is still the old value → derived URI is `null` → VideoPlayer correctly does NOT render until the effect fills `videoState` for the new index.

**Why:** This is the only approach that makes the URI ownership explicit and atomic — the render sees either "URI for my index" or nothing.

**How to apply:** Any time video URI needs to be frozen per-index, use the `{index, uri}` pattern so transitions are null-safe by construction. Never mutate refs during render, never use plain `useState<string|null>` for per-index state.

## Bug 2: loop on last video (found in v33/v37 after API fix exposed more playback)

**Symptom:** Plays N videos in order, gets to last one, loops it forever instead of cycling back to first.

**Root cause:** Same as final fix above — in v37, `currentVideoUri` state still held the old URI when `currentIndex` wrapped around (3→0). VideoPlayer remounted with `key={0}` but got URI of video 4. When video 4 finished, `advance()` was called again with `currentIndex` already 0, so `nxt = (0+1)%4 = 1`, not 3 — it didn't actually loop index 3. It looped the CONTENT of video 4 because the VideoPlayer received the wrong URI on each new mount.

**Fix:** Same `{index, uri}` pattern — URI is null during transition → VideoPlayer doesn't mount with wrong content.
