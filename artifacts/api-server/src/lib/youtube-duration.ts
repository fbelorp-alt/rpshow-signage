/**
 * Lê a duração real de um vídeo do YouTube (lengthSeconds).
 * Usado ao adicionar o link no painel — não resolve stream (isso é no player).
 */

const WATCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ANDROID_UA = "com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip";

export function parseYouTubeVideoId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const embed = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed) return embed[1];
    const shorts = u.pathname.match(/\/(?:shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (shorts) return shorts[1];
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").slice(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    /* fall through */
  }
  const m = raw.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

async function durationFromInnertube(videoId: string): Promise<number | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": ANDROID_UA,
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": "21.26.364",
        Origin: "https://www.youtube.com",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "21.26.364",
            androidSdkVersion: 30,
            osName: "Android",
            osVersion: "11",
            hl: "pt",
            gl: "BR",
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      videoDetails?: { lengthSeconds?: string; isLive?: boolean; isLiveContent?: boolean };
      playabilityStatus?: { liveStreamability?: unknown };
    };
    const live =
      data.videoDetails?.isLive === true ||
      !!data.playabilityStatus?.liveStreamability;
    if (live) return null;
    const len = Number(data.videoDetails?.lengthSeconds) || 0;
    return len > 0 ? len : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function durationFromWatchPage(videoId: string): Promise<number | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": WATCH_UA, "Accept-Language": "pt-BR,pt;q=0.9" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"lengthSeconds":\s*"(\d+)"/);
    const len = m ? Number(m[1]) : 0;
    if (!len) return null;
    if (/"isLive":\s*true/.test(html) && len < 5) return null;
    return len;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Duração em segundos, ou null se for ao vivo / não der para ler. */
export async function fetchYouTubeDurationSeconds(url: string): Promise<number | null> {
  const videoId = parseYouTubeVideoId(url);
  if (!videoId) return null;
  return (await durationFromInnertube(videoId)) ?? (await durationFromWatchPage(videoId));
}
