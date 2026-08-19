/**
 * Resolve YouTube watch/embed/playlist URLs to a direct stream for ExoPlayer.
 * Chromium WebView on Taurus T10 Plus kills the process; expo-av already works.
 *
 * Innertube is called ON DEVICE (stream URLs are IP-bound; a VPS resolve 403s).
 */

export type YtStream = {
  streamUrl: string;
  durationSeconds: number;
  videoId: string;
};

const ANDROID_UA =
  "com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip";

type YtClient = {
  name: string;
  version: string;
  clientNameNum: string;
  ua: string;
  extra: Record<string, unknown>;
};

const CLIENTS: YtClient[] = [
  {
    name: "ANDROID",
    version: "21.26.364",
    clientNameNum: "3",
    ua: ANDROID_UA,
    extra: {
      androidSdkVersion: 30,
      osName: "Android",
      osVersion: "11",
      userAgent: ANDROID_UA,
    },
  },
  {
    name: "ANDROID_VR",
    version: "1.60.19",
    clientNameNum: "28",
    ua: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    extra: {
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      androidSdkVersion: 32,
      osName: "Android",
      osVersion: "12L",
    },
  },
  {
    name: "IOS",
    version: "20.10.4",
    clientNameNum: "5",
    ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)",
    extra: {
      deviceMake: "Apple",
      deviceModel: "iPhone16,2",
      osName: "iPhone",
      osVersion: "18.3.2.22D82",
    },
  },
];

export function parseYouTubeIds(raw: string): { videoId: string | null; listId: string | null } {
  try {
    const u = new URL(raw);
    const listId = u.searchParams.get("list");
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { videoId: v, listId };
    const embed = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed) return { videoId: embed[1], listId };
    const shorts = u.pathname.match(/\/(?:shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (shorts) return { videoId: shorts[1], listId };
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").slice(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { videoId: id, listId };
    }
    return { videoId: null, listId };
  } catch {
    const m = raw.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const list = raw.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return { videoId: m?.[1] ?? null, listId: list?.[1] ?? null };
  }
}

function clientContext(c: YtClient) {
  return {
    clientName: c.name,
    clientVersion: c.version,
    hl: "pt",
    gl: "BR",
    ...c.extra,
  };
}

async function innertube(path: string, c: YtClient, payload: Record<string, unknown>): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/${path}?prettyPrint=false`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": c.ua,
        "X-YouTube-Client-Name": c.clientNameNum,
        "X-YouTube-Client-Version": c.version,
        Origin: "https://www.youtube.com",
      },
      body: JSON.stringify({
        context: { client: clientContext(c) },
        contentCheckOk: true,
        racyCheckOk: true,
        ...payload,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function pickStream(data: any): { streamUrl: string; durationSeconds: number } | null {
  const status = data?.playabilityStatus?.status;
  if (status && status !== "OK") return null;
  const sd = data?.streamingData;
  if (!sd) return null;
  const durationSeconds = Number(data?.videoDetails?.lengthSeconds) || 0;
  const formats: any[] = Array.isArray(sd.formats) ? sd.formats : [];

  const muxed = formats.filter((f) => typeof f?.url === "string" && f.url.startsWith("http"));
  const preferItag = (itags: number[]) =>
    muxed.find((f) => itags.includes(Number(f.itag)) && String(f.mimeType || "").includes("mp4"));
  const chosen =
    preferItag([18]) ||
    preferItag([22]) ||
    muxed.find((f) => String(f.mimeType || "").includes("mp4")) ||
    muxed[0];
  if (chosen?.url) return { streamUrl: chosen.url, durationSeconds };

  const hls = typeof sd.hlsManifestUrl === "string" ? sd.hlsManifestUrl : "";
  if (hls.startsWith("http")) return { streamUrl: hls, durationSeconds };
  return null;
}

async function firstVideoIdFromPlaylist(listId: string): Promise<string | null> {
  for (const c of CLIENTS) {
    const data = await innertube("next", c, { playlistId: listId });
    if (!data) continue;
    const blob = JSON.stringify(data);
    const m = blob.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (m) return m[1];
  }
  return null;
}

async function playerStream(videoId: string): Promise<YtStream | null> {
  for (const c of CLIENTS) {
    const data = await innertube("player", c, { videoId });
    if (!data) continue;
    const picked = pickStream(data);
    if (picked) {
      console.log("[YT-EXO] stream", c.name, videoId, "dur", picked.durationSeconds);
      return { ...picked, videoId };
    }
    const st = data?.playabilityStatus?.status;
    console.log("[YT-EXO] no stream", c.name, videoId, st, data?.playabilityStatus?.reason);
  }
  return null;
}

export async function resolveYouTubeStream(rawUrl: string): Promise<YtStream | null> {
  const { videoId: parsedId, listId } = parseYouTubeIds(rawUrl);
  let videoId = parsedId;
  if (!videoId && listId) {
    videoId = await firstVideoIdFromPlaylist(listId);
  }
  if (!videoId) {
    console.warn("[YT-EXO] sem videoId", rawUrl.slice(0, 80));
    return null;
  }
  return playerStream(videoId);
}
