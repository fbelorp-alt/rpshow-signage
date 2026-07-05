import { File, Directory, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MANIFEST_KEY = "rpshow_vcache_v1";

// In-memory manifest: remoteUrl → local file URI (file:// string)
let manifest: Record<string, string> = {};
let ready = false;
let initPromise: Promise<void> | null = null;

// Downloads currently in progress (deduplicated)
const inFlight = new Map<string, Promise<void>>();

// ── djb2 hash — turns a URL into a short safe filename ─────────────────────
function hashUrl(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = Math.imul(h, 31) + url.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function getCacheDir(): Directory {
  return new Directory(Paths.document, "vcache");
}

async function persistManifest(): Promise<void> {
  try {
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {}
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Call once on app start. Loads the manifest and validates that cached files
 * still exist on disk. Safe to call multiple times — deduplicates automatically.
 */
export async function initVideoCache(): Promise<void> {
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const cacheDir = getCacheDir();
      if (!cacheDir.exists) {
        cacheDir.create({ intermediates: true });
      }

      const raw = await AsyncStorage.getItem(MANIFEST_KEY);
      const saved: Record<string, string> = raw ? JSON.parse(raw) : {};

      // Validate — remove entries whose local file was deleted
      const valid: Record<string, string> = {};
      for (const [url, uri] of Object.entries(saved)) {
        try {
          const f = new File(uri);
          if (f.exists) valid[url] = uri;
        } catch {}
      }
      manifest = valid;
    } catch {
      // Non-fatal — streaming fallback
    } finally {
      ready = true;
    }
  })();

  return initPromise;
}

/**
 * Returns the local cached URI for a remote video URL, or null if not yet cached.
 * Synchronous — call after initVideoCache() resolves.
 */
export function getCachedUri(remoteUrl: string): string | null {
  return manifest[remoteUrl] ?? null;
}

/**
 * Start downloading a video to local storage in the background.
 * No-op if already cached or already downloading.
 */
export function prefetchVideo(remoteUrl: string): void {
  if (!remoteUrl || !remoteUrl.startsWith("http")) return;
  if (manifest[remoteUrl]) return;    // already cached
  if (inFlight.has(remoteUrl)) return; // already downloading

  const task = (async () => {
    try {
      const cacheDir = getCacheDir();
      if (!cacheDir.exists) cacheDir.create({ intermediates: true });

      const destFile = new File(cacheDir, hashUrl(remoteUrl) + ".mp4");
      if (destFile.exists) {
        // Already on disk but missing from manifest
        manifest[remoteUrl] = destFile.uri;
        await persistManifest();
        return;
      }

      const downloaded = await File.downloadFileAsync(remoteUrl, destFile, {
        idempotent: true,
      });
      manifest[remoteUrl] = downloaded.uri;
      await persistManifest();
    } catch {
      // Silent — streaming fallback
    } finally {
      inFlight.delete(remoteUrl);
    }
  })();

  inFlight.set(remoteUrl, task);
}

/**
 * Delete all cached video files and reset the manifest.
 */
export async function clearVideoCache(): Promise<void> {
  try {
    const cacheDir = getCacheDir();
    if (cacheDir.exists) cacheDir.delete();
    cacheDir.create({ intermediates: true });
  } catch {}
  manifest = {};
  try { await AsyncStorage.removeItem(MANIFEST_KEY); } catch {}
}
