/**
 * Lê a duração no navegador via IFrame API do YouTube.
 * O servidor (VPS) é tratado como bot; o Chrome do usuário não.
 */

type YtPlayer = {
  getDuration: () => number;
  destroy: () => void;
};

type YtNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width: number;
      height: number;
      playerVars: Record<string, number>;
      events: {
        onReady?: (e: { target: YtPlayer }) => void;
        onError?: () => void;
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
      const id = u.pathname.replace(/^\//, "").slice(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    /* fall through */
  }
  const m = raw.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
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
  return apiReady;
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
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;width:2px;height:2px;left:-9999px;top:0;opacity:0;pointer-events:none;overflow:hidden";
    const mount = document.createElement("div");
    host.appendChild(mount);
    document.body.appendChild(host);

    let settled = false;
    let player: YtPlayer | null = null;
    const finish = (sec: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { player?.destroy(); } catch { /* ignore */ }
      host.remove();
      resolve(sec && sec > 0 ? Math.round(sec) : null);
    };
    const timer = setTimeout(() => finish(null), 14000);

    try {
      player = new window.YT.Player(mount, {
        videoId,
        width: 2,
        height: 2,
        playerVars: { autoplay: 0, controls: 0, mute: 1, rel: 0 },
        events: {
          onReady: (e) => {
            const d = e.target.getDuration();
            finish(d > 1 ? d : null);
          },
          onError: () => finish(null),
        },
      });
    } catch {
      finish(null);
    }
  });
}
