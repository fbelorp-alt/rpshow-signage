/**
 * Lê a duração no navegador via IFrame API do YouTube.
 * O servidor (VPS) é tratado como bot; o Chrome do usuário não.
 */

type YtPlayer = {
  getDuration: () => number;
  mute: () => void;
  playVideo: () => void;
  destroy: () => void;
};

type YtNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width: number;
      height: number;
      playerVars: Record<string, string | number>;
      events: {
        onReady?: (e: { target: YtPlayer }) => void;
        onError?: () => void;
        onStateChange?: (e: { data: number; target: YtPlayer }) => void;
      };
    },
  ) => YtPlayer;
};

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function parseYouTubeVideoId(raw: string): string | null {
  try {
    const u = new URL(raw);
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const embed = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed) return embed[1];
    const shorts = u.pathname.match(/\/(?:shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (shorts) return shorts[1];
    if (u.hostname === "youtu.be" || u.hostname.endsWith(".youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split(/[/?#]/)[0]?.slice(0, 11);
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    /* fall through */
  }
  const m = raw.match(/(?:v=|embed\/|youtu\.be\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

let apiReady: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.onerror = () => reject(new Error("iframe_api"));
      document.head.appendChild(s);
    }
    const started = Date.now();
    const poll = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - started > 12000) {
        clearInterval(poll);
        reject(new Error("timeout"));
      }
    }, 100);
  });
  apiReady.catch(() => {
    apiReady = null;
  });
  return apiReady;
}

/** 10s/30s são o padrão do formulário — não a duração real do YouTube. */
export function isPlaceholderYoutubeDuration(sec: number | null | undefined): boolean {
  const n = Number(sec) || 0;
  return n <= 0 || n === 10 || n === 30;
}

export async function fetchYouTubeDurationInBrowser(url: string): Promise<number | null> {
  const videoId = parseYouTubeVideoId(url);
  if (!videoId) return null;
  try {
    await loadYouTubeIframeApi();
  } catch {
    return null;
  }
  if (!window.YT?.Player) return null;

  return new Promise((resolve) => {
    // Fora da tela o YouTube muitas vezes devolve getDuration() === 0.
    // Fica no viewport, quase invisível, só para carregar o metadado.
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;width:320px;height:180px;right:0;bottom:0;opacity:0.05;overflow:hidden;z-index:2147483646";
    const mount = document.createElement("div");
    host.appendChild(mount);
    document.body.appendChild(host);

    let settled = false;
    let player: YtPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const finish = (sec: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      try { player?.destroy(); } catch { /* ignore */ }
      host.remove();
      resolve(sec && sec > 1 ? Math.round(sec) : null);
    };
    const takeDuration = (target: YtPlayer) => {
      try {
        const d = target.getDuration();
        if (d > 1) finish(d);
      } catch {
        /* still loading */
      }
    };
    const timer = setTimeout(() => finish(null), 18000);

    try {
      player = new window.YT.Player(mount, {
        videoId,
        width: 320,
        height: 180,
        playerVars: {
          autoplay: 1,
          controls: 0,
          mute: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            try { e.target.mute(); } catch { /* ignore */ }
            try { e.target.playVideo(); } catch { /* ignore */ }
            takeDuration(e.target);
            poll = setInterval(() => takeDuration(e.target), 200);
          },
          onStateChange: (e) => takeDuration(e.target),
          onError: () => finish(null),
        },
      });
    } catch {
      finish(null);
    }
  });
}

/** IFrame no Chrome do usuário, depois API do VPS (quase sempre bloqueada). */
export async function readYouTubeDuration(url: string): Promise<number | null> {
  const browser = await fetchYouTubeDurationInBrowser(url);
  if (browser && browser > 0) return browser;
  try {
    const r = await fetch(`/api/media/youtube-duration?url=${encodeURIComponent(url)}`, { credentials: "include" });
    const data = await r.json() as { durationSeconds?: number | null };
    return data.durationSeconds && data.durationSeconds > 0 ? data.durationSeconds : null;
  } catch {
    return null;
  }
}
