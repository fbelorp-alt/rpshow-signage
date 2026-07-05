import {
  documentDirectory,
  makeDirectoryAsync,
  downloadAsync,
  getInfoAsync,
  deleteAsync,
} from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MANIFEST_KEY = "rpshow_vcache_v1";
const CACHE_DIR_NAME = "vcache";

let manifest: Record<string, string> = {};
let ready = false;
let initPromise: Promise<void> | null = null;

const inFlight = new Map<string, Promise<void>>();

function hashUrl(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = Math.imul(h, 31) + url.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function getCacheDir(): string {
  const base = documentDirectory ?? "";
  return base + CACHE_DIR_NAME + "/";
}

async function persistManifest(): Promise<void> {
  try {
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {}
}

export async function initVideoCache(): Promise<void> {
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const dir = getCacheDir();
      if (dir) {
        await makeDirectoryAsync(dir, { intermediates: true });
      }

      const raw = await AsyncStorage.getItem(MANIFEST_KEY);
      const saved: Record<string, string> = raw ? JSON.parse(raw) : {};

      const valid: Record<string, string> = {};
      for (const [url, uri] of Object.entries(saved)) {
        try {
          const info = await getInfoAsync(uri);
          if (info.exists) valid[url] = uri;
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

export function getCachedUri(remoteUrl: string): string | null {
  return manifest[remoteUrl] ?? null;
}

export function prefetchVideo(remoteUrl: string): void {
  if (!remoteUrl || !remoteUrl.startsWith("http")) return;
  if (manifest[remoteUrl]) return;
  if (inFlight.has(remoteUrl)) return;

  const task = (async () => {
    try {
      const dir = getCacheDir();
      if (!dir) return;
      await makeDirectoryAsync(dir, { intermediates: true });

      const localUri = dir + hashUrl(remoteUrl) + ".mp4";

      const info = await getInfoAsync(localUri);
      if (info.exists) {
        manifest[remoteUrl] = localUri;
        await persistManifest();
        return;
      }

      const result = await downloadAsync(remoteUrl, localUri);
      if (result.status === 200) {
        manifest[remoteUrl] = localUri;
        await persistManifest();
      }
    } catch {
      // Silent — streaming fallback
    } finally {
      inFlight.delete(remoteUrl);
    }
  })();

  inFlight.set(remoteUrl, task);
}

export async function clearVideoCache(): Promise<void> {
  try {
    const dir = getCacheDir();
    if (dir) await deleteAsync(dir, { idempotent: true });
  } catch {}
  manifest = {};
  try { await AsyncStorage.removeItem(MANIFEST_KEY); } catch {}
}
