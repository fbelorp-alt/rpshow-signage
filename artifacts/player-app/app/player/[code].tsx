import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGetPlayerPlaylist, useHeartbeat, customFetch } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  PixelRatio,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import type { PlayerItem } from "@workspace/api-client-react";

const STORAGE_KEY = "rpshow_screen_code";
const POLL_INTERVAL_MS = 10_000;
const POLL_EMPTY_MS = 10_000;
const SCREENSHOT_INTERVAL_MS = 10 * 60 * 1000; // 10 min — menos agressivo no Taurus

function resolveMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith("http")) return rawUrl;
  const apiPath = rawUrl.startsWith("/objects/") ? `/api/storage${rawUrl}` : rawUrl;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}${apiPath.startsWith("/") ? "" : "/"}${apiPath}`;
  return apiPath;
}

// ── Video cache local ─────────────────────────────────────────────────────────
// Arquitetura NovaSTAR: baixa vídeos no tablet, reproduz offline.
// Primeira exibição ainda usa streaming (download acontece em paralelo).
// A partir da segunda exibição (ou reinício do app) já usa arquivo local.
const VIDEO_CACHE_DIR = FileSystem.documentDirectory
  ? FileSystem.documentDirectory + "rpshow-video-cache/"
  : null;

function getCacheKey(url: string): string | null {
  if (!url) return null;
  // Apenas vídeos do nosso storage têm path estável (/api/storage/objects/uuid)
  const match = url.match(/\/api\/storage\/objects\/([^?#/]+)/);
  if (match) return match[1];
  return null;
}

function useVideoCache(networkUrls: string[]): Record<string, string> {
  const [cacheMap, setCacheMap] = useState<Record<string, string>>({});
  const urlsKey = networkUrls.join("|");

  useEffect(() => {
    if (!networkUrls.length || !VIDEO_CACHE_DIR) return;
    let cancelled = false;
    const cacheDir = VIDEO_CACHE_DIR;

    async function checkExisting() {
      // Verifica cache existente imediatamente — sem download, sem rede
      try {
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) return {};
        const alreadyCached: Record<string, string> = {};
        for (const url of networkUrls) {
          if (cancelled) return alreadyCached;
          const key = getCacheKey(url);
          if (!key) continue;
          const localPath = cacheDir + key;
          try {
            const info = await FileSystem.getInfoAsync(localPath);
            if (info.exists && (info as any).size > 1024) {
              alreadyCached[url] = localPath;
            }
          } catch {}
        }
        return alreadyCached;
      } catch {
        return {};
      }
    }

    async function downloadMissing(alreadyCached: Record<string, string>) {
      // Aguarda 60s antes de qualquer download — deixa o player estabilizar
      // sem competir com o ExoPlayer por rede e CPU na primeira reprodução.
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 60_000);
        // Se o efeito for cancelado durante o delay, resolve imediatamente
        const check = setInterval(() => { if (cancelled) { clearTimeout(t); clearInterval(check); resolve(); } }, 500);
      });
      if (cancelled) return;

      try {
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        }

        // Baixa vídeos ausentes em sequência
        for (const url of networkUrls) {
          if (cancelled) return;
          const key = getCacheKey(url);
          if (!key || alreadyCached[url]) continue;
          const localPath = cacheDir + key;
          try {
            const result = await FileSystem.downloadAsync(url, localPath);
            if (!cancelled && result.status >= 200 && result.status < 300) {
              const info = await FileSystem.getInfoAsync(localPath);
              if (info.exists && (info as any).size > 1024) {
                setCacheMap((prev) => ({ ...prev, [url]: localPath }));
              }
            }
          } catch {
            // Falha no download — continuará streamando esse vídeo
          }
        }

        // Limpa arquivos de playlists antigas
        if (!cancelled) {
          try {
            const validKeys = new Set(
              networkUrls.map(getCacheKey).filter(Boolean) as string[]
            );
            const files = await FileSystem.readDirectoryAsync(cacheDir);
            for (const file of files) {
              if (!validKeys.has(file)) {
                await FileSystem.deleteAsync(cacheDir + file, { idempotent: true });
              }
            }
          } catch {}
        }
      } catch {}
    }

    async function run() {
      const alreadyCached = await checkExisting();
      if (!cancelled && Object.keys(alreadyCached).length > 0) {
        setCacheMap(alreadyCached);
      }
      await downloadMissing(alreadyCached);
    }

    run();
    return () => { cancelled = true; };
  }, [urlsKey]);

  return cacheMap;
}

// ── Playlist cache offline-first ─────────────────────────────────────────────
// Salva a playlist no sistema de arquivos local após cada fetch bem-sucedido.
// Na inicialização carrega o cache imediatamente — toca conteúdo antes mesmo
// de ter internet. Quando reconecta, atualiza o cache silenciosamente.
const PLAYLIST_CACHE_DIR = FileSystem.documentDirectory
  ? FileSystem.documentDirectory + "rpshow-playlist-cache/"
  : null;

async function loadPlaylistCache(code: string): Promise<any | null> {
  if (!PLAYLIST_CACHE_DIR) return null;
  try {
    const path = PLAYLIST_CACHE_DIR + code + ".json";
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const content = await FileSystem.readAsStringAsync(path);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function savePlaylistCache(code: string, data: any): Promise<void> {
  if (!PLAYLIST_CACHE_DIR) return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(PLAYLIST_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PLAYLIST_CACHE_DIR, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(
      PLAYLIST_CACHE_DIR + code + ".json",
      JSON.stringify(data)
    );
  } catch {}
}

// ── Image cache local ─────────────────────────────────────────────────────────
// Mesma estratégia do vídeo: baixa imagens para o tablet, exibe offline.
const IMAGE_CACHE_DIR = FileSystem.documentDirectory
  ? FileSystem.documentDirectory + "rpshow-image-cache/"
  : null;

function getImageCacheKey(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/api\/storage\/objects\/([^?#/]+)/);
  if (match) return match[1];
  return null;
}

function useImageCache(networkUrls: string[]): Record<string, string> {
  const [cacheMap, setCacheMap] = useState<Record<string, string>>({});
  const urlsKey = networkUrls.join("|");

  useEffect(() => {
    // Imagens carregam rápido via rede — só usa cache se já existe no disco.
    // Sem download em background para não competir com o ExoPlayer.
    if (!networkUrls.length || !IMAGE_CACHE_DIR) return;
    let cancelled = false;
    const cacheDir = IMAGE_CACHE_DIR;

    async function run() {
      try {
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) return;

        const alreadyCached: Record<string, string> = {};
        for (const url of networkUrls) {
          if (cancelled) return;
          const key = getImageCacheKey(url);
          if (!key) continue;
          const localPath = cacheDir + key;
          try {
            const info = await FileSystem.getInfoAsync(localPath);
            if (info.exists && (info as any).size > 100) {
              alreadyCached[url] = "file://" + localPath;
            }
          } catch {}
        }
        if (!cancelled && Object.keys(alreadyCached).length > 0) {
          setCacheMap(alreadyCached);
        }
      } catch {}
    }

    run();
    return () => { cancelled = true; };
  }, [urlsKey]);

  return cacheMap;
}

function toYouTubeEmbedUrl(url: string): string {
  // Converte qualquer URL do YouTube para embed com tela cheia e sem controles
  try {
    const u = new URL(url);

    // Já é embed — garante os parâmetros corretos
    if (u.pathname.startsWith("/embed")) {
      u.searchParams.set("autoplay", "1");
      u.searchParams.set("controls", "0");
      u.searchParams.set("rel", "0");
      u.searchParams.set("modestbranding", "1");
      u.searchParams.set("iv_load_policy", "3");
      u.searchParams.set("fs", "1");
      return u.toString();
    }

    // youtu.be curto
    if (u.hostname === "youtu.be") {
      const vid = u.pathname.slice(1);
      if (vid) return `https://www.youtube.com/embed/${vid}?autoplay=1&controls=0&loop=1&playlist=${vid}&rel=0&modestbranding=1&iv_load_policy=3&fs=1`;
    }

    // URL de playlist (?list=...)
    const listId = u.searchParams.get("list");
    const videoId = u.searchParams.get("v");

    if (videoId) {
      const loop = `&loop=1&playlist=${videoId}`;
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0${loop}&rel=0&modestbranding=1&iv_load_policy=3&fs=1`;
    }

    if (listId) {
      return `https://www.youtube.com/embed?listType=playlist&list=${listId}&autoplay=1&controls=0&loop=1&rel=0&modestbranding=1&iv_load_policy=3&fs=1`;
    }

    // Fallback: só adiciona autoplay
    u.searchParams.set("autoplay", "1");
    return u.toString();
  } catch {
    return url;
  }
}

// JS injetado no embed para forçar fullscreen, autoplay e prevenir pausa por inatividade
const YT_AUTOPLAY_JS = `
(function() {
  // ── Ocultar UI do YouTube ──────────────────────────────────────────────────
  var HIDE_SELECTORS = [
    '#masthead-container','ytd-masthead',
    '.ytp-chrome-top','.ytp-watermark','.ytp-endscreen-content',
    '.ytp-cards-teaser','.ytp-pause-overlay',
    '.ytp-player-content','.videowall-endscreen',
    'ytd-watch-next-secondary-results-renderer',
    '#secondary','#comments','#below','ytd-app header',
    '.html5-endscreen','.ytp-ce-element',
    '#movie_player > div.ytp-chrome-top',
  ];
  function hideUI() {
    HIDE_SELECTORS.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      });
    });
  }

  // ── Retomar vídeo e simular atividade ─────────────────────────────────────
  function keepAlive() {
    var v = document.querySelector('video');
    if (v) {
      // Retoma se pausado (pausa por inatividade ou outro motivo)
      if (v.paused) {
        v.play().catch(function() { v.muted = true; v.play(); });
      }
      // Garante que não está em loop forçado pelo embed
      if (v.loop) v.loop = false;
    }
    // Simula interação do usuário para evitar detecção de inatividade
    ['mousemove','mousedown','keydown','touchstart'].forEach(function(evt) {
      document.dispatchEvent(new Event(evt, { bubbles: true }));
    });
    // Fecha qualquer diálogo "você ainda está aí?" / "continue watching"
    var btns = document.querySelectorAll('button, .ytp-button');
    btns.forEach(function(btn) {
      var txt = (btn.textContent || '').toLowerCase();
      if (txt.includes('continue') || txt.includes('continuar') ||
          txt.includes('sim') || txt.includes('yes') ||
          txt.includes('ok') || txt.includes('dismiss')) {
        btn.click();
      }
    });
    hideUI();
  }

  // ── Desmutar com retry ────────────────────────────────────────────────────
  function tryUnmute() {
    var v = document.querySelector('video');
    if (!v) return;
    v.muted = false;
    v.volume = 1.0;
    // Clica no botão de mute do player do YouTube se existir
    var muteBtn = document.querySelector('.ytp-mute-button');
    if (muteBtn && v.muted) muteBtn.click();
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    var v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.volume = 1.0;
      v.play().catch(function() {
        // Primeira tentativa falhou — toca mudo e depois tenta desmutar
        v.muted = true;
        v.play().then(function() {
          // Assim que estiver tocando, tenta desmutar progressivamente
          setTimeout(tryUnmute, 500);
          setTimeout(tryUnmute, 1500);
          setTimeout(tryUnmute, 3000);
        }).catch(function(){});
      });
    }
    hideUI();
  }

  document.addEventListener('DOMContentLoaded', init);
  setTimeout(init, 800);
  setTimeout(init, 2500);
  setTimeout(tryUnmute, 4000);
  setTimeout(tryUnmute, 8000);

  // Verifica a cada 5s: retoma vídeo pausado e fecha diálogos
  setInterval(keepAlive, 5000);
})();
true;
`;

async function logPlay(screenCode: string, item: PlayerItem) {
  try {
    const rawUrl = (item as any).mediaUrl ?? null;
    const currentMediaUrl = rawUrl ? resolveMediaUrl(rawUrl) : null;
    await customFetch(`/api/player/${screenCode}/play`, {
      method: "POST",
      body: JSON.stringify({
        mediaId: (item as any).mediaId ?? null,
        mediaName: (item as any).mediaName ?? item.mediaType,
        mediaType: item.mediaType,
        durationSeconds: item.durationSeconds ?? null,
        currentMediaUrl,
      }),
    });
  } catch {
    // silent — fire and forget
  }
}

// VideoPlayer v52 — dual-slot: preload NÃO é descartado na troca (elimina ~3s pretos).
// v49: playback SEMPRE via URL de rede (nunca file:// do cache local).
// v50: faixa preta de debug some da tela; 7 toques rápidos liga/desliga.
// v51: tentou Video oculto 0×0 — NÃO compartilha buffer com o próximo mount.
// v52: dois slots A/B; ao acabar, promove o slot já bufferizado (sem remount frio).
//
// Evidência v47 (HUD do usuário):
// - Índice AVANÇA: 3/3 key=2 → 1/3 key=3 → 2/3 key=4 (wrap OK)
// - Mas no ÚLTIMO o usuário vê "patinar" (ExoPlayer reinicia antes da troca)
// - last=pre-end, dur≈20500 em todos
//
// FIX v48:
// 1. Corta em 80% da duração (não 90%/−1.5s) — mata antes do restart nativo
// 2. Qualquer rewind de posição (pos cai >2s após ter andado) → kill imediato
// 3. Reporta pos ao vivo pro HUD (prova se está reiniciando)
// 4. onEnd síncrono + setDead (mantém v47)
function VideoPlayer({
  uri, active = true, onEnd, onDuration, onProgress, fallbackSeconds = 30, screenWidth, screenHeight, objectFit = "contain",
  debugLabel,
}: {
  uri: string;
  /** false = bufferiza em silêncio; true = toca e pode disparar onEnd */
  active?: boolean;
  onEnd: (reason: string) => void;
  onDuration?: (durationMillis: number) => void;
  onProgress?: (positionMillis: number, durationMillis: number) => void;
  fallbackSeconds?: number;
  screenWidth: number;
  screenHeight: number;
  objectFit?: string;
  debugLabel?: string;
}) {
  const [frozenUri] = useState(uri);
  const videoRef = useRef<InstanceType<typeof Video>>(null);
  const [shouldPlay, setShouldPlay] = useState(active);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  const onEndRef = useRef(onEnd);
  const onDurationRef = useRef(onDuration);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onEndRef.current = onEnd; });
  useEffect(() => { onDurationRef.current = onDuration; });
  useEffect(() => { onProgressRef.current = onProgress; });

  const endedRef = useRef(false);
  const [dead, setDead] = useState(false);
  const preEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedDurationRef = useRef(false);
  const maxPosRef = useRef(0);
  const lastPosRef = useRef(0);
  const lastProgressEmitRef = useRef(0);
  const durationRef = useRef(0);

  const clearTimers = () => {
    if (preEndTimerRef.current) {
      clearTimeout(preEndTimerRef.current);
      preEndTimerRef.current = null;
    }
    if (hardFallbackRef.current) {
      clearTimeout(hardFallbackRef.current);
      hardFallbackRef.current = null;
    }
  };

  // Liga/desliga playback sem remount — promove o slot de preload.
  useEffect(() => {
    setShouldPlay(active);
    if (!active) {
      clearTimers();
      endedRef.current = false;
      armedDurationRef.current = false;
      maxPosRef.current = 0;
      lastPosRef.current = 0;
      videoRef.current
        ?.setStatusAsync({ shouldPlay: false, positionMillis: 0, isLooping: false })
        .catch(() => {});
      return;
    }
    // Slot promovido a ativo: toca do início
    endedRef.current = false;
    videoRef.current
      ?.setStatusAsync({ shouldPlay: true, positionMillis: 0, isLooping: false })
      .catch(() => {});
  }, [active]);

  const finishCurrent = useCallback((reason: string) => {
    if (!activeRef.current) return; // preload nunca dispara advance
    if (endedRef.current) return;
    endedRef.current = true;
    clearTimers();
    console.log("[VP52] finish", reason, debugLabel ?? "", frozenUri.slice(-40));

    setShouldPlay(false);
    setDead(true); // remove <Video> neste render — mata ExoPlayer
    onEndRef.current(reason);

    videoRef.current
      ?.setStatusAsync({ shouldPlay: false, isLooping: false })
      .catch(() => {});
  }, [frozenUri, debugLabel]);

  useEffect(() => {
    if (!active) return;
    const ms = Math.max(8000, (fallbackSeconds + 1) * 1000);
    hardFallbackRef.current = setTimeout(() => finishCurrent("hard-fallback"), ms);
    return () => clearTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const armPreEndTimer = useCallback((durationMillis: number) => {
    if (!activeRef.current) return;
    if (armedDurationRef.current || endedRef.current) return;
    if (!durationMillis || durationMillis < 800) return;
    armedDurationRef.current = true;
    durationRef.current = durationMillis;
    onDurationRef.current?.(durationMillis);

    // Hard fallback: duration + 0.5s (se 80% falhar)
    if (hardFallbackRef.current) clearTimeout(hardFallbackRef.current);
    hardFallbackRef.current = setTimeout(
      () => finishCurrent("hard-fallback"),
      durationMillis + 500,
    );

    // ★ CORTE A 80% — deixa 20% de folga antes do ExoPlayer patinar no fim
    const fireIn = Math.max(400, Math.floor(durationMillis * 0.8));
    console.log("[VP52] arm 80% cut", fireIn, "ms of", durationMillis, debugLabel ?? "");
    if (preEndTimerRef.current) clearTimeout(preEndTimerRef.current);
    preEndTimerRef.current = setTimeout(() => finishCurrent("cut-80"), fireIn);
  }, [finishCurrent, debugLabel]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (endedRef.current) return;
    if (!status.isLoaded) {
      if ((status as { error?: string }).error && activeRef.current) finishCurrent("error");
      return;
    }

    if (status.isLooping) {
      videoRef.current?.setStatusAsync({ isLooping: false }).catch(() => {});
    }

    const dur = status.durationMillis ?? 0;
    const pos = status.positionMillis ?? 0;

    // Preload: só reporta duração quando virar ativo; ainda assim bufferiza
    if (activeRef.current && dur > 0) armPreEndTimer(dur);
    else if (!activeRef.current && dur > 0) {
      // Mantém ExoPlayer “quente” sem tocar
      if (status.isPlaying) {
        videoRef.current?.setStatusAsync({ shouldPlay: false }).catch(() => {});
      }
    }

    if (!activeRef.current) return;

    // HUD ao vivo (throttle ~400ms)
    const now = Date.now();
    if (now - lastProgressEmitRef.current > 400) {
      lastProgressEmitRef.current = now;
      onProgressRef.current?.(pos, dur);
    }

    if (status.didJustFinish === true) {
      finishCurrent("didJustFinish");
      return;
    }

    if (pos > maxPosRef.current) maxPosRef.current = pos;

    // ★ REWIND = patinar do ExoPlayer: posição caiu depois de ter andado
    if (
      dur > 800 &&
      maxPosRef.current > 2500 &&
      lastPosRef.current > 2000 &&
      pos + 2000 < lastPosRef.current
    ) {
      console.log("[VP52] REWIND/patina pos", pos, "was", lastPosRef.current, "max", maxPosRef.current);
      finishCurrent("rewind");
      return;
    }

    // Já passou de 80% pela posição — corta agora
    if (dur > 800 && pos >= dur * 0.8) {
      finishCurrent("pos-80");
      return;
    }

    lastPosRef.current = pos;
  }, [armPreEndTimer, finishCurrent]);

  const resizeMode =
    objectFit === "cover"  ? ResizeMode.COVER   :
    objectFit === "fill"   ? ResizeMode.STRETCH  :
                             ResizeMode.CONTAIN;

  if (dead) {
    return <View style={{ width: screenWidth, height: screenHeight, backgroundColor: "#000" }} />;
  }

  return (
    <Video
      ref={videoRef}
      source={{ uri: frozenUri }}
      style={{ width: screenWidth, height: screenHeight }}
      shouldPlay={shouldPlay}
      isLooping={false}
      isMuted={true}
      resizeMode={resizeMode}
      progressUpdateIntervalMillis={active ? 100 : 500}
      onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      useNativeControls={false}
    />
  );
}

import QRCode from "react-native-qrcode-svg";

function DeviceClockOverlay({ timezone, city, screenW, screenH }: { timezone: string; city?: string; screenW: number; screenH: number }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const minDim = Math.min(screenW, screenH);
  // Bem menor: máximo 10px em telas grandes, escala para baixo em painéis LED
  const timeFontSize = Math.max(3, Math.min(7, Math.round(minDim * 0.025)));
  const dateFontSize = Math.max(2, Math.min(6, Math.round(minDim * 0.018)));
  const padH = Math.max(2, Math.min(4, Math.round(minDim * 0.014)));
  const padV = Math.max(1, Math.min(2, Math.round(minDim * 0.009)));

  let time = "--:--";
  let date = "--/--";
  try {
    const tz = { timeZone: timezone };
    time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", ...tz });
    date = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" as const, ...tz });
  } catch {
    try {
      time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      date = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" as const });
    } catch {
      const pad = (n: number) => String(n).padStart(2, "0");
      time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    }
  }

  return (
    <View style={[styles.deviceClock, { paddingHorizontal: padH, paddingVertical: padV }]} pointerEvents="none">
      <Text style={[styles.deviceClockTime, { fontSize: timeFontSize }]}>{time}</Text>
      <Text style={[styles.deviceClockDate, { fontSize: dateFontSize }]}>{date}</Text>
    </View>
  );
}

function ClockWidget({ timezone, scale = 1 }: { timezone: string; scale?: number }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tz = { timeZone: timezone };
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", ...tz });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", ...tz });

  return (
    <View style={styles.clockContainer}>
      <Text style={[styles.clockTime, { fontSize: Math.round(96 * scale) }]}>{timeStr}</Text>
      <Text style={[styles.clockDate, { fontSize: Math.round(22 * scale), marginTop: Math.round(12 * scale) }]}>{dateStr}</Text>
    </View>
  );
}

function DateWidget({ timezone, scale = 1 }: { timezone: string; scale?: number }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const tz = { timeZone: timezone };
  const weekday = now.toLocaleDateString("pt-BR", { weekday: "long", ...tz });
  const day = now.toLocaleDateString("pt-BR", { day: "2-digit", ...tz });
  const month = now.toLocaleDateString("pt-BR", { month: "long", ...tz });
  const year = now.toLocaleDateString("pt-BR", { year: "numeric", ...tz });
  return (
    <View style={styles.clockContainer}>
      <Text style={[styles.clockDate, { fontSize: Math.round(36 * scale), textTransform: "capitalize", marginBottom: Math.round(8 * scale) }]}>{weekday}</Text>
      <Text style={[styles.clockTime, { fontSize: Math.round(120 * scale), lineHeight: Math.round(130 * scale) }]}>{day}</Text>
      <Text style={[styles.clockDate, { fontSize: Math.round(32 * scale), textTransform: "capitalize" }]}>{month} {year}</Text>
    </View>
  );
}

function QRCodeWidget({ url, label, scale = 1 }: { url: string; label?: string; scale?: number }) {
  const safeUrl = url && url.startsWith("http") ? url : "https://rpshow.com.br";
  return (
    <View style={styles.clockContainer}>
      <QRCode value={safeUrl} size={Math.round(280 * scale)} backgroundColor="#000000" color="#ffffff" />
      {!!label && <Text style={[styles.clockDate, { marginTop: Math.round(24 * scale), fontSize: Math.round(22 * scale) }]}>{label}</Text>}
    </View>
  );
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity / 100})`;
}

interface TextMeta {
  textContent?: string;
  textSize?: number;
  textFont?: string;
  textColor?: string;
  textBold?: boolean;
  textItalic?: boolean;
  textUppercase?: boolean;
  textAlign?: "left" | "center" | "right";
  textEffect?: string;
  textShadowColor?: string;
  textStrokeColor?: string;
  textGradientTo?: string;
  textBg?: string;
  textBgOpacity?: number;
  textAnimation?: string;
  textAnimationSpeed?: number;
}

function TextSlideWidget({ meta }: { meta: TextMeta }) {
  const content = meta.textContent ?? "Texto";
  const size = meta.textSize ?? 80;
  const color = meta.textColor ?? "#ffffff";
  const bold = meta.textBold !== false;
  const italic = meta.textItalic ?? false;
  const uppercase = meta.textUppercase ?? false;
  const align = meta.textAlign ?? "center";
  const effect = meta.textEffect ?? "none";
  const shadowColor = meta.textShadowColor ?? "#000000";
  const bgColor = meta.textBg ?? "#000000";
  const bgOpacity = meta.textBgOpacity ?? 0;
  const animType = meta.textAnimation ?? "none";
  const speed = meta.textAnimationSpeed ?? 5;

  // speed 1 (slow 24s) → speed 10 (fast 2s)
  const durationMs = Math.max(2000, Math.round(26000 - speed * 2400));

  const animPos = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(1)).current;
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [textW, setTextW] = useState(0);
  const [textH, setTextH] = useState(0);

  const isHoriz = animType === "scroll_left" || animType === "scroll_right";
  const isVert  = animType === "scroll_up"   || animType === "scroll_down";
  const isBlink = animType === "blink";
  const isScroll = isHoriz || isVert;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;

    if (isBlink) {
      const half = Math.max(400, durationMs / 2);
      anim = Animated.loop(Animated.sequence([
        Animated.timing(animOpacity, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.delay(half),
        Animated.timing(animOpacity, { toValue: 0, duration: 50, useNativeDriver: true }),
        Animated.delay(half),
      ]));
      anim.start();
    } else if (isScroll) {
      const w = containerW || 1280;
      const h = containerH || 720;
      const tw = textW || w;
      const th = textH || h;

      let from = 0;
      let to = 0;
      if (animType === "scroll_left")  { from = w;   to = -tw; }
      if (animType === "scroll_right") { from = -tw; to = w;   }
      if (animType === "scroll_up")    { from = h;   to = -th; }
      if (animType === "scroll_down")  { from = -th; to = h;   }

      const dist = Math.abs(to - from);
      const scaledDuration = Math.round((dist / (w > h ? w : h)) * durationMs);
      animPos.setValue(from);
      anim = Animated.loop(
        Animated.timing(animPos, { toValue: to, duration: Math.max(1000, scaledDuration), easing: Easing.linear, useNativeDriver: true })
      );
      anim.start();
    } else {
      animPos.setValue(0);
      animOpacity.setValue(1);
    }

    return () => { anim?.stop(); };
  }, [animType, speed, containerW, containerH, textW, textH]);

  const bgStyle: import("react-native").ViewStyle = bgOpacity > 0
    ? { backgroundColor: hexToRgba(bgColor, bgOpacity) }
    : { backgroundColor: "transparent" };

  const textShadow: import("react-native").TextStyle =
    effect === "shadow"
      ? { textShadowColor: shadowColor, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 6 }
      : effect === "glow" || effect === "led"
      ? { textShadowColor: shadowColor, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }
      : {};

  const textStyle: import("react-native").TextStyle = {
    color,
    fontSize: size,
    fontWeight: bold ? "bold" : "normal",
    fontStyle: italic ? "italic" : "normal",
    textAlign: isScroll ? "left" : align,
    textTransform: uppercase ? "uppercase" : "none",
    lineHeight: size * 1.2,
    ...(isScroll ? {} : { flexShrink: 1 }),
    ...textShadow,
  };

  const transform = isHoriz
    ? [{ translateX: animPos }]
    : isVert
    ? [{ translateY: animPos }]
    : [];

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.textSlideContainer, bgStyle, { overflow: "hidden" }]}
      onLayout={(e) => {
        setContainerW(e.nativeEvent.layout.width);
        setContainerH(e.nativeEvent.layout.height);
      }}
    >
      <Animated.View
        style={{ transform, opacity: isBlink ? animOpacity : 1 }}
        onLayout={(e) => {
          setTextW(e.nativeEvent.layout.width);
          setTextH(e.nativeEvent.layout.height);
        }}
      >
        <Text style={textStyle} numberOfLines={isScroll ? 1 : 0} adjustsFontSizeToFit={false}>
          {content}
        </Text>
      </Animated.View>
    </View>
  );
}

interface WeatherData {
  temp: number;
  windspeed: number;
  weathercode: number;
  cityName: string;
}

function weatherEmoji(code: number) {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code <= 45) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

function WeatherWidget({ cityName, scale = 1 }: { cityName: string; scale?: number }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchWeather() {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt&format=json`
        );
        const geo = await geoRes.json();
        if (!geo.results?.length) { setLoading(false); return; }
        const { latitude, longitude, name } = geo.results[0];
        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
        );
        const wx = await wxRes.json();
        if (mounted) {
          setWeather({
            temp: Math.round(wx.current_weather.temperature),
            windspeed: Math.round(wx.current_weather.windspeed),
            weathercode: wx.current_weather.weathercode,
            cityName: name,
          });
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    }
    fetchWeather();
    const t = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, [cityName]);

  if (loading) {
    return (
      <View style={styles.weatherContainer}>
        <ActivityIndicator color="#fff" />
        <Text style={[styles.weatherCity, { fontSize: Math.round(24 * scale) }]}>{cityName}</Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={styles.weatherContainer}>
        <Text style={[styles.weatherTemp, { fontSize: Math.round(96 * scale) }]}>—</Text>
        <Text style={[styles.weatherCity, { fontSize: Math.round(24 * scale) }]}>{cityName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.weatherContainer}>
      <Text style={[styles.weatherEmoji, { fontSize: Math.round(80 * scale) }]}>{weatherEmoji(weather.weathercode)}</Text>
      <Text style={[styles.weatherTemp, { fontSize: Math.round(96 * scale), letterSpacing: -2 * scale }]}>{weather.temp}°C</Text>
      <Text style={[styles.weatherCity, { fontSize: Math.round(24 * scale) }]}>{weather.cityName}</Text>
      <Text style={[styles.weatherWind, { fontSize: Math.round(18 * scale), marginTop: Math.round(8 * scale) }]}>💨 {weather.windspeed} km/h</Text>
    </View>
  );
}

interface ForecastDay {
  date: string;
  weathercode: number;
  tempMax: number;
  tempMin: number;
}

function WeatherForecastWidget({ cityName, days, scale = 1 }: { cityName: string; days: number; scale?: number }) {
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [displayCity, setDisplayCity] = useState(cityName);

  useEffect(() => {
    let mounted = true;
    async function fetchForecast() {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt&format=json`
        );
        const geo = await geoRes.json();
        if (!geo.results?.length) return;
        const { latitude, longitude, name } = geo.results[0];
        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=${days}`
        );
        const wx = await wxRes.json();
        if (!mounted) return;
        setDisplayCity(name);
        const d = wx.daily;
        const parsed: ForecastDay[] = d.time.map((t: string, i: number) => ({
          date: t,
          weathercode: d.weathercode[i],
          tempMax: Math.round(d.temperature_2m_max[i]),
          tempMin: Math.round(d.temperature_2m_min[i]),
        }));
        setForecast(parsed.slice(0, days));
      } catch {}
    }
    fetchForecast();
    const t = setInterval(fetchForecast, 30 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, [cityName, days]);

  const DAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <View style={styles.forecastContainer}>
      <Text style={[styles.forecastCity, { fontSize: Math.round(36 * scale) }]}>{displayCity}</Text>
      <Text style={[styles.forecastLabel, { fontSize: Math.round(11 * scale), letterSpacing: 2 * scale }]}>PREVISÃO DO TEMPO</Text>
      <View style={styles.forecastRow}>
        {(forecast ?? Array.from({ length: days }).map((_, i) => ({
          date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
          weathercode: 1, tempMax: 0, tempMin: 0,
        }))).map((day, i) => {
          const weekday = DAY_PT[new Date(day.date + "T12:00:00").getDay()];
          const emoji = weatherEmoji(day.weathercode);
          const isToday = i === 0;
          return (
            <View key={day.date} style={[styles.forecastCard, isToday && styles.forecastCardToday, { padding: Math.round(12 * scale), borderRadius: Math.round(12 * scale) }]}>
              <Text style={[styles.forecastDayName, isToday && { color: "#fbbf24" }, { fontSize: Math.round(13 * scale) }]}>
                {isToday ? "Hoje" : weekday}
              </Text>
              <Text style={[styles.forecastEmoji, { fontSize: Math.round(28 * scale) }]}>{emoji}</Text>
              {forecast ? (
                <>
                  <Text style={[styles.forecastMax, { fontSize: Math.round(18 * scale) }]}>{day.tempMax}°</Text>
                  <Text style={[styles.forecastMin, { fontSize: Math.round(14 * scale) }]}>{day.tempMin}°</Text>
                </>
              ) : (
                <Text style={[styles.forecastMax, { fontSize: Math.round(18 * scale) }]}>—</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RssTicker({ feedUrls }: { feedUrls: string[] }) {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const animX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(400);
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const feedKey = feedUrls.join("|");

  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      try {
        const results = await Promise.allSettled(
          feedUrls.map(async (url) => {
            // Usa proxy do servidor — evita CORS e cache do Android
            // customFetch<T> já parseia o JSON e retorna T diretamente
            const items = await customFetch<{ title: string }[]>(`/api/rss-proxy?url=${encodeURIComponent(url)}`);
            return items.map((i) => i.title).filter(Boolean);
          })
        );
        const merged = results
          .filter((r) => r.status === "fulfilled")
          .flatMap((r) => (r as PromiseFulfilledResult<string[]>).value);
        if (mounted && merged.length) setHeadlines(merged);
      } catch {}
    }
    fetchAll();
    const t = setInterval(fetchAll, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, [feedKey]);

  useEffect(() => {
    if (!headlines.length || !textWidth || !containerWidth) return;
    animX.setValue(containerWidth);
    if (animRef.current) animRef.current.stop();
    const totalDist = containerWidth + textWidth;
    const duration = (totalDist / 80) * 1000;
    animRef.current = Animated.loop(
      Animated.timing(animX, {
        toValue: -textWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();
    return () => { if (animRef.current) animRef.current.stop(); };
  }, [headlines, textWidth, containerWidth]);

  if (!headlines.length) return null;

  const tickerText = headlines.join("  •  ") + "  •  ";

  return (
    <View
      style={styles.tickerWrapper}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.tickerLabel}>
        <Text style={styles.tickerLabelText}>NOTÍCIAS</Text>
      </View>
      <View style={styles.tickerScroll}>
        <Animated.Text
          style={[styles.tickerText, { transform: [{ translateX: animX }] }]}
          numberOfLines={1}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {tickerText}
        </Animated.Text>
      </View>
    </View>
  );
}

function RssFullscreen({ feedUrl, scale = 1 }: { feedUrl: string; scale?: number }) {
  const [items, setItems] = useState<{ title: string; description: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    async function fetchRss() {
      try {
        // Proxy do servidor: sem CORS, sem cache do Android, atualiza a cada chamada
        // customFetch<T> já parseia o JSON e retorna T diretamente
        const data = await customFetch<{ title: string; description: string }[]>(`/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`);
        if (mounted && data.length) setItems(data);
      } catch {}
    }
    fetchRss();
    const t = setInterval(fetchRss, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, [feedUrl]);

  useEffect(() => {
    if (!items.length) return;
    // 12s por notícia — tempo suficiente para ler título + descrição
    const t = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        setIdx((i) => (i + 1) % items.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      });
    }, 12_000);
    return () => clearInterval(t);
  }, [items, fadeAnim]);

  if (!items.length) return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#060612", justifyContent: "center", alignItems: "center" }]}>
      <Text style={{ color: "#f97316", fontSize: Math.round(16 * scale), fontWeight: "bold", opacity: 0.7 }}>Carregando notícias…</Text>
    </View>
  );

  const current = items[idx];
  const ph = Math.round(60 * scale);
  const pt = Math.round(40 * scale);
  const pb = Math.round(20 * scale);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#060612" }]}>
      {/* Cabeçalho */}
      <View style={{ paddingHorizontal: ph, paddingTop: pt, paddingBottom: pb, flexDirection: "row", alignItems: "center", gap: Math.round(12 * scale), borderBottomWidth: 1, borderBottomColor: "#f9731620" }}>
        <View style={{ backgroundColor: "#f97316", paddingHorizontal: Math.round(14 * scale), paddingVertical: Math.round(5 * scale), borderRadius: 4 }}>
          <Text style={{ color: "#fff", fontSize: Math.round(13 * scale), fontWeight: "900", letterSpacing: Math.round(2 * scale) }}>NOTÍCIAS</Text>
        </View>
        <Text style={{ color: "#f97316", opacity: 0.5, fontSize: Math.round(13 * scale) }}>{idx + 1} / {items.length}</Text>
      </View>

      {/* Conteúdo da notícia */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: ph, paddingVertical: Math.round(30 * scale) }}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={{ color: "#ffffff", fontSize: Math.round(38 * scale), fontWeight: "800", lineHeight: Math.round(52 * scale), marginBottom: Math.round(28 * scale) }}>
            {current.title}
          </Text>
          {!!current.description && (
            <Text style={{ color: "#ffffffb0", fontSize: Math.round(22 * scale), lineHeight: Math.round(34 * scale), fontWeight: "400" }}>
              {current.description}
            </Text>
          )}
        </Animated.View>
      </View>

      {/* Barra de progresso */}
      <View style={{ height: Math.max(2, Math.round(4 * scale)), backgroundColor: "#0d0d1a" }}>
        <View style={{ height: Math.max(2, Math.round(4 * scale)), backgroundColor: "#f97316", width: `${((idx + 1) / items.length) * 100}%` }} />
      </View>
    </View>
  );
}

export default function PlayerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { width: deviceW, height: deviceH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Estado atômico: index + key num único setState.
  // key SEMPRE incrementa no advance — VideoPlayer SEMPRE remonta, sem exceção.
  const [playState, setPlayState] = useState({ index: 0, key: 0 });
  // videoGate: false desmonta o <Video> completamente antes do advance.
  // Isso garante que o ExoPlayer seja destruído antes de montar o próximo.
  const [videoGate, setVideoGate] = useState(true);
  // Ref com o tamanho atual da playlist — nunca stale dentro do updater funcional.
  const displayItemsLenRef = useRef(0);
  // Guard: impede advance() duplo enquanto o desmonte está em andamento.
  const advancingRef = useRef(false);
  const currentIndex = playState.index;
  const [showControls, setShowControls] = useState(false);
  const [showClock, setShowClock] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem("rpshow_show_clock").then(v => { if (v === "false") setShowClock(false); });
  }, []);
  const toggleClock = () => {
    setShowClock(prev => {
      const next = !prev;
      AsyncStorage.setItem("rpshow_show_clock", String(next));
      return next;
    });
  };
  const [showDebugHud, setShowDebugHud] = useState(false);
  const debugTapRef = useRef({ count: 0, lastAt: 0 });
  const [powerMode, setPowerMode] = useState<"auto" | "off">("auto");
  const [brightnessLevel, setBrightnessLevel] = useState(100); // 0–100; overlay dims screen when < 100
  const [lastAdvanceReason, setLastAdvanceReason] = useState<string>("-");
  const [knownDurationMs, setKnownDurationMs] = useState<number>(0);
  const [livePosMs, setLivePosMs] = useState<number>(0);
  const itemStartedAtRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedIndex = useRef<number>(-1);
  const invalidCheckedRef = useRef(false);
  const screenshotViewRef = useRef<View>(null);

  // ── Dual-slot preload (v52) ─────────────────────────────────────────────────
  // Dois slots fixos A/B. O inativo bufferiza o próximo (opacity 0, tamanho real).
  // Na troca só flipamos `activeSide` — MESMA key React → ExoPlayer já quente.
  type VideoSlot = { uri: string; index: number; key: number };
  const [slotA, setSlotA] = useState<VideoSlot | null>(null);
  const [slotB, setSlotB] = useState<VideoSlot | null>(null);
  const [activeSide, setActiveSide] = useState<"a" | "b">("a");
  const preloadStartedRef = useRef<string | null>(null);
  const slotKeyRef = useRef(0);
  const activeSideRef = useRef<"a" | "b">("a");
  useEffect(() => { activeSideRef.current = activeSide; }, [activeSide]);

  // ── Immersive fullscreen on Android ────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    StatusBar.setHidden(true, "none");
  }, []);

  // ── Offline-first: carrega cache imediatamente, atualiza em background ───────
  const [cachedData, setCachedData] = useState<any | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const cacheLoadedRef = useRef(false);

  useEffect(() => {
    if (!code || cacheLoadedRef.current) return;
    cacheLoadedRef.current = true;
    loadPlaylistCache(code).then((cached) => {
      if (cached) setCachedData(cached);
    });
  }, [code]);

  // Sem placeholderData: quando o servidor retorna dados novos (playlist alterada),
  // freshData atualiza imediatamente. cachedData (disco) já mantém o display
  // estável enquanto o fetch está em andamento — sem necessidade de placeholder.
  const { data: freshData, isLoading: freshLoading, isError, refetch } = useGetPlayerPlaylist(code!);

  // Quando chega dado fresco: salva cache e usa ele
  useEffect(() => {
    if (!freshData || !code) return;
    setCachedData(freshData);
    setIsOffline(false);
    savePlaylistCache(code, freshData);
  }, [freshData, code]);

  // Detecta quando está offline (erro na busca)
  useEffect(() => {
    if (isError) setIsOffline(true);
    else setIsOffline(false);
  }, [isError]);

  // Usa dado fresco se disponível, senão usa cache offline
  const data = freshData ?? cachedData;
  const isLoading = freshLoading && !cachedData;

  const transitionEffect: string = (data as any)?.transitionEffect ?? "fade";
  const { mutate: sendHeartbeat } = useHeartbeat();

  const resolution = `${Math.round(deviceW)}x${Math.round(deviceH)}`;

  // Panel canvas dimensions — use NovaLCT-configured size for LED panels, device size for TVs.
  // panelWidth/Height are PHYSICAL pixels (as set in the NovaLCT / dashboard config).
  // React Native layout uses LOGICAL pixels (dp), so we must divide by PixelRatio.get()
  // to convert physical px → logical dp. Example: 168 physical px ÷ 1.5 DPR = 112 dp.
  const dpr = PixelRatio.get();
  const panelWidth  = (data as any)?.panelWidth  as number | null | undefined;
  const panelHeight = (data as any)?.panelHeight as number | null | undefined;
  // panelRotation: 0 (default), 90, 180 or 270 degrees.
  // Used for LED panels mounted horizontally when the device is in portrait mode.
  const panelRotationDeg = ((data as any)?.panelRotation as number | undefined) ?? 0;
  const isCanvasTransposed = panelRotationDeg === 90 || panelRotationDeg === 270;
  // width/height = content coordinate space (what items are designed for = panelWidth×panelHeight)
  const width  = (panelWidth  && panelWidth  > 0) ? Math.round(panelWidth  / dpr) : deviceW;
  const height = (panelHeight && panelHeight > 0) ? Math.round(panelHeight / dpr) : deviceH;
  // Canvas (LED box) dimensions:
  //   0°/180° → canvas = content size (width × height)
  //   90°/270° → swap W↔H so the canvas matches the physical device framebuffer orientation.
  //   For a 256×512 device with 512×256 content at 90°: canvasW=256, canvasH=512.
  //   The content (512×256) is rendered inside and rotated 90° to fill the 256×512 box.
  //   This keeps the canvas WITHIN the device framebuffer — no negative coords, no overflow needed.
  const canvasW = isCanvasTransposed ? height : width;
  const canvasH = isCanvasTransposed ? width  : height;
  // Content wrapper (only for 90°/270°):
  //   Size = content dims (width × height), centered in the canvas box, then rotated.
  //   After rotating 90°, a width×height box becomes height×width, filling canvasW×canvasH exactly.
  //   renderToHardwareTextureAndroid ensures the GPU rasterizes the full content texture
  //   BEFORE the parent's overflow:hidden clips it — so no content is lost at the edges.
  const contentLeft = isCanvasTransposed ? (canvasW - width)  / 2 : 0; // e.g. (256-512)/2 = -128
  const contentTop  = isCanvasTransposed ? (canvasH - height) / 2 : 0; // e.g. (512-256)/2 = +128
  // 0°/180°: simple rotate on the canvas itself (no wrapper needed, content == canvas dims).
  const canvasTransform = panelRotationDeg === 180 ? [{ rotate: "180deg" }] as const : undefined;

  useEffect(() => {
    const doHeartbeat = async () => {
      try {
        type HBResp = { brightness?: number; brightnessSchedules?: Array<{ startTime: string; endTime: string; brightness: number; days: string }> } | undefined;
        const data = await customFetch<HBResp>(
          `/api/player/${code}/heartbeat`,
          { method: "POST", body: JSON.stringify({ resolution }) },
        );
        if (data) {
          // Compute brightness from schedule or fall back to manual targetBrightness
          let level: number | undefined;
          if (data.brightnessSchedules && data.brightnessSchedules.length > 0) {
            const now = new Date();
            const hh = now.getHours().toString().padStart(2, "0");
            const mm = now.getMinutes().toString().padStart(2, "0");
            const timeStr = `${hh}:${mm}`;
            const day = now.getDay();
            for (const slot of data.brightnessSchedules) {
              const days = (slot.days || "").split(",").map(Number);
              if (!days.includes(day)) continue;
              const { startTime, endTime } = slot;
              const inRange = startTime <= endTime
                ? timeStr >= startTime && timeStr <= endTime
                : timeStr >= startTime || timeStr <= endTime;
              if (inRange) { level = slot.brightness; break; }
            }
          }
          if (level === undefined && typeof data.brightness === "number") level = data.brightness;
          if (level !== undefined) {
            setBrightnessLevel(level);
            try {
              const { novastarSetBrightness } = await import("../lib/novastar-brightness");
              await novastarSetBrightness(level);
            } catch { }
          }
        }
      } catch {
        // network error — ignore
      }
    };
    doHeartbeat();
    const poll = setInterval(() => { refetch(); }, POLL_INTERVAL_MS);
    const hb = setInterval(doHeartbeat, POLL_INTERVAL_MS);
    return () => { clearInterval(poll); clearInterval(hb); };
  }, [refetch, code, resolution]);

  // ── Detecção de tela deletada (404) ──────────────────────────────────────────
  // Quando o admin deleta a tela no dashboard, o servidor agora limpa o screenCode
  // do device. Na próxima vez que o player tenta buscar a playlist, recebe 404.
  // Se isError persistir por 2 ciclos de polling, verifica diretamente se é 404 —
  // se for, limpa o AsyncStorage e volta à tela de pareamento automaticamente.
  useEffect(() => {
    if (!isError || invalidCheckedRef.current) return;
    invalidCheckedRef.current = true;
    const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";
    fetch(`${API_BASE}/api/player/${code}`)
      .then(async (r) => {
        if (r.status === 404) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          router.replace("/");
        } else {
          // Erro temporário (rede) — permite nova checagem na próxima falha
          invalidCheckedRef.current = false;
        }
      })
      .catch(() => { invalidCheckedRef.current = false; });
  }, [isError, code, router]);

  // ── Screenshot capture & upload ─────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const doScreenshot = async () => {
      try {
        if (!screenshotViewRef.current) return;
        const base64 = await captureRef(screenshotViewRef, {
          format: "jpg",
          quality: 0.5,
          result: "base64",
        });
        await customFetch(`/api/monitoring/screenshot/${code}`, {
          method: "POST",
          body: JSON.stringify({ imageBase64: base64, contentType: "image/jpeg" }),
        });
      } catch {
        // silent — fire and forget
      }
    };
    // First capture after 10s (let content load), then every 2min
    const initial = setTimeout(doScreenshot, 10_000);
    const interval = setInterval(doScreenshot, SCREENSHOT_INTERVAL_MS);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [code]);

  // Polling agressivo quando sem conteúdo ou com erro — verifica a cada 10s
  const hasContent = (data?.items ?? []).length > 0;
  useEffect(() => {
    if (hasContent && !isError) return;
    const fastPoll = setInterval(() => { refetch(); }, POLL_EMPTY_MS);
    return () => clearInterval(fastPoll);
  }, [hasContent, isError, refetch]);

  // ── Power schedule check ────────────────────────────────────────────────────
  const isWithinPowerSchedule = (): boolean => {
    const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
    const now = new Date();
    const nowBRT = new Date(now.getTime() + BRT_OFFSET_MS);
    const pad = (n: number) => String(n).padStart(2, "0");
    const curTime = `${pad(nowBRT.getUTCHours())}:${pad(nowBRT.getUTCMinutes())}`;
    const curDay = nowBRT.getUTCDay(); // 0=Sun … 6=Sat

    // per-day schedule takes priority
    const schedJson = (data as any)?.powerScheduleJson as string | null | undefined;
    if (schedJson) {
      try {
        const sched: { day: number; active: boolean; on?: string; off?: string; windows?: { on: string; off: string }[] }[] = JSON.parse(schedJson);
        const entry = sched.find(e => e.day === curDay);
        if (!entry || !entry.active) return false; // day not active → off
        // v2: windows array
        if (Array.isArray(entry.windows)) {
          if (entry.windows.length === 0) return true; // active, no restriction → always on today
          return entry.windows.some(w => curTime >= w.on && curTime < w.off);
        }
        // v1: on/off at root
        if (!entry.on || !entry.off) return true;
        return curTime >= entry.on && curTime < entry.off;
      } catch {
        // fall through to legacy
      }
    }

    // legacy single on/off pair
    const onTime  = (data as any)?.powerOnTime  as string | null | undefined;
    const offTime = (data as any)?.powerOffTime as string | null | undefined;
    if (!onTime || !offTime) return true; // no schedule → always on
    return curTime >= onTime && curTime < offTime;
  };

  const shouldDisplay = powerMode === "auto" ? isWithinPowerSchedule() : false;

  // ── Screen sleep / wake via NovaStar brightness ──────────────────────────
  // When schedule says OFF → set brightness 0 (screen goes dark).
  // When schedule says ON  → restore saved brightness level.
  // Uses a ref to detect transitions only (avoid calling on every re-render).
  const prevShouldDisplayRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevShouldDisplayRef.current;
    prevShouldDisplayRef.current = shouldDisplay;
    if (prev === null) return; // first render — don't act yet
    if (prev === shouldDisplay) return; // no change
    (async () => {
      try {
        const { novastarSetBrightness } = await import("../lib/novastar-brightness");
        if (!shouldDisplay) {
          // Going to sleep — set brightness to 0
          await novastarSetBrightness(0);
        } else {
          // Waking up — restore current brightness level
          await novastarSetBrightness(brightnessLevel);
        }
      } catch {
        // Non-NovaStar device — ignore silently
      }
    })();
  }, [shouldDisplay, brightnessLevel]);

  const items: PlayerItem[] = data?.items ?? [];

  const playlistId = (data as any)?.playlistId ?? null;

  // RSS ticker items run as an overlay — exclude them from the slide rotation
  const isRssTickerItem = (it: PlayerItem) => {
    if (it.mediaType !== "rss") return false;
    const raw = (it as any).metaJson;
    const m: Record<string, any> | null = (() => {
      if (!raw) return null;
      if (typeof raw === "object") return raw;
      try { return JSON.parse(raw); } catch { return null; }
    })();
    return !m || m.displayMode !== "fullscreen";
  };

  // displayItems: só reconstrói quando a playlist ou a quantidade de itens muda —
  // evita re-renders e efeitos colaterais em polls que retornam a mesma playlist.
  const displayItems = useMemo(
    () => items.filter((it) => !isRssTickerItem(it)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playlistId, items.length], // reconstrói só quando playlist ou qtd de itens muda
  );

  const currentItem = displayItems[currentIndex];

  // ── Cache local de vídeos (NovaSTAR-style) ────────────────────────────────
  // Baixa todos os vídeos da playlist para o armazenamento interno do tablet.
  // Reprodução é sempre do arquivo local (sem depender da rede).
  // Primeira reprodução ainda faz streaming; nas seguintes usa cache local.
  const videoNetworkUrls = displayItems
    .filter((it) => it.mediaType === "video")
    .map((it) => resolveMediaUrl(it.mediaUrl ?? ""))
    .filter(Boolean);
  const videoCacheMap = useVideoCache(videoNetworkUrls);

  // URI de reprodução.
  // v49: NÃO usa cache local (file://) no playback.
  // Evidência: 1ª volta OK (streaming); 2ª vez no último patina.
  // O download local começa após 60s — exatamente quando começa a 2ª passagem.
  // file:// no ExoPlayer do Taurus reinicia o vídeo sem disparar advance.
  // useVideoCache continua baixando em background (offline futuro), mas NÃO alimenta o player.
  const currentVideoUri = (() => {
    if (!currentItem || currentItem.mediaType !== "video") return null;
    const net = resolveMediaUrl(currentItem.mediaUrl ?? "");
    if (!net) return null;
    return net;
  })();

  // URI do próximo vídeo — usado para preloading em background
  const nextVideoUri = useMemo(() => {
    if (displayItems.length <= 1) return null;
    const nextIndex = (currentIndex + 1) % displayItems.length;
    const nextItem = displayItems[nextIndex];
    if (!nextItem || nextItem.mediaType !== "video") return null;
    return resolveMediaUrl(nextItem.mediaUrl ?? "") || null;
  }, [displayItems, currentIndex]);
  const cacheReadyForCurrent = (() => {
    if (!currentItem || currentItem.mediaType !== "video") return false;
    const net = resolveMediaUrl(currentItem.mediaUrl ?? "");
    return !!(net && videoCacheMap[net]);
  })();

  // Cache de imagens — baixa todas as imagens da playlist para o dispositivo
  const imageNetworkUrls = displayItems
    .filter((it) => it.mediaType !== "video" && it.mediaType !== "clock"
      && it.mediaType !== "date" && it.mediaType !== "weather"
      && it.mediaType !== "weather_forecast" && it.mediaType !== "rss"
      && it.mediaType !== "web_channel" && it.mediaType !== "youtube"
      && it.mediaType !== "youtube_playlist" && it.mediaType !== "pluto_tv"
      && it.mediaType !== "canva" && it.mediaType !== "google_slides"
      && it.mediaType !== "spotify" && it.mediaType !== "instagram"
      && it.mediaType !== "tiktok" && it.mediaType !== "qr_code"
      && it.mediaType !== "text")
    .map((it) => resolveMediaUrl(it.mediaUrl ?? ""))
    .filter(Boolean);
  const imageCacheMap = useImageCache(imageNetworkUrls);

  // Mantém ref atualizada com o tamanho atual da playlist.
  useEffect(() => {
    displayItemsLenRef.current = displayItems.length;
  }, [displayItems.length]);

  // advance v52: se o próximo já está no slot inativo, só flipa activeSide (sem tela preta).
  const slotARef = useRef<VideoSlot | null>(null);
  const slotBRef = useRef<VideoSlot | null>(null);
  const displayItemsRef = useRef(displayItems);
  useEffect(() => { slotARef.current = slotA; }, [slotA]);
  useEffect(() => { slotBRef.current = slotB; }, [slotB]);
  useEffect(() => { displayItemsRef.current = displayItems; }, [displayItems]);
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const advance = useCallback((reason: string = "advance") => {
    if (advancingRef.current) {
      console.log("[ADV52] ignored (already advancing)", reason);
      return;
    }
    advancingRef.current = true;
    setLastAdvanceReason(reason);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const items = displayItemsRef.current;
    const len = items.length;
    const cur = currentIndexRef.current;
    const nextIndex = len > 0 ? (cur + 1) % len : 0;
    const nextItem = len > 0 ? items[nextIndex] : null;
    const nextUri =
      nextItem?.mediaType === "video"
        ? resolveMediaUrl(nextItem.mediaUrl ?? "") || null
        : null;

    const side = activeSideRef.current;
    const coldSide = side === "a" ? "b" : "a";
    const cold = coldSide === "a" ? slotARef.current : slotBRef.current;
    const canPromote =
      !!nextUri &&
      !!cold &&
      cold.uri === nextUri &&
      cold.index === nextIndex;

    setKnownDurationMs(0);
    setLivePosMs(0);
    itemStartedAtRef.current = Date.now();
    preloadStartedRef.current = null;

    if (canPromote) {
      console.log("[ADV52] PROMOTE", coldSide, "→ active", reason, cur, "→", nextIndex);
      setActiveSide(coldSide);
      activeSideRef.current = coldSide;
      // Limpa o slot antigo depois (mata ExoPlayer velho sem black flash)
      const oldSide = side;
      setTimeout(() => {
        if (oldSide === "a") { setSlotA(null); slotARef.current = null; }
        else { setSlotB(null); slotBRef.current = null; }
      }, 200);
      setPlayState((prev) => ({ index: nextIndex, key: prev.key + 1 }));
      setVideoGate(true);
      advancingRef.current = false;
      return;
    }

    console.log("[ADV52] COLD remount", reason, cur, "→", nextIndex);
    setSlotA(null);
    setSlotB(null);
    slotARef.current = null;
    slotBRef.current = null;
    setVideoGate(false);

    setTimeout(() => {
      setPlayState((prev) => {
        const l = displayItemsLenRef.current;
        const nxt = l > 0 ? (prev.index + 1) % l : 0;
        console.log("[ADV52]", reason, prev.index, "→", nxt, "len=", l, "key", prev.key, "→", prev.key + 1);
        return { index: nxt, key: prev.key + 1 };
      });
      itemStartedAtRef.current = Date.now();
      setVideoGate(true);
      advancingRef.current = false;
    }, 40);
  }, []);

  const handleVideoEnd = useCallback((reason: string) => {
    advance(reason);
  }, [advance]);

  const handleVideoDuration = useCallback((ms: number) => {
    setKnownDurationMs(ms);
  }, []);

  const handleVideoProgress = useCallback((pos: number, _dur: number) => {
    setLivePosMs(pos);
  }, []);

  // Reseta ao trocar de playlist
  useEffect(() => {
    advancingRef.current = false;
    setVideoGate(true);
    setKnownDurationMs(0);
    setLivePosMs(0);
    setLastAdvanceReason("-");
    itemStartedAtRef.current = Date.now();
    setPlayState({ index: 0, key: 0 });
    setSlotA(null);
    setSlotB(null);
    slotARef.current = null;
    slotBRef.current = null;
    setActiveSide("a");
    activeSideRef.current = "a";
    preloadStartedRef.current = null;
  }, [playlistId]);

  // Marca início de cada item
  useEffect(() => {
    itemStartedAtRef.current = Date.now();
    setLivePosMs(0);
  }, [currentIndex, playState.key]);

  // Clamp se playlist encolheu
  useEffect(() => {
    if (displayItems.length > 0 && currentIndex >= displayItems.length) {
      setPlayState((prev) => ({ index: Math.max(0, displayItems.length - 1), key: prev.key + 1 }));
    }
  }, [displayItems.length, currentIndex]);

  useEffect(() => {
    if (currentItem && lastLoggedIndex.current !== currentIndex) {
      lastLoggedIndex.current = currentIndex;
      logPlay(code!, currentItem);
    }
  }, [currentIndex, currentItem, code]);

  // Watchdog do PAI a 80% — desconta tempo já decorrido desde o mount do item
  useEffect(() => {
    if (!currentItem) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const type = currentItem.mediaType;
    if (type === "video") {
      let targetMs: number;
      let reason: string;
      if (knownDurationMs > 800) {
        targetMs = Math.floor(knownDurationMs * 0.8);
        reason = "parent-80pct";
      } else {
        const sec = currentItem.durationSeconds || 30;
        targetMs = Math.max(4000, Math.floor(sec * 1000 * 0.8));
        reason = "parent-cms-80";
      }
      const elapsed = Date.now() - itemStartedAtRef.current;
      const ms = Math.max(300, targetMs - elapsed);
      console.log("[ADV49] parent watchdog", ms, "ms", reason, "elapsed=", elapsed, "idx=", currentIndex);
      timerRef.current = setTimeout(() => advance(reason), ms);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    if (type === "web_channel" || type === "youtube" || type === "pluto_tv"
      || type === "canva" || type === "google_slides" || type === "youtube_playlist"
      || type === "spotify" || type === "instagram" || type === "tiktok") {
      const dur = currentItem.durationSeconds ?? 0;
      if (!dur) return;
      timerRef.current = setTimeout(() => advance("parent-web"), dur * 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    const duration = Math.max(1000, (currentItem.durationSeconds ?? 10) * 1000);
    timerRef.current = setTimeout(() => advance("parent-image"), duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, currentItem, advance, knownDurationMs]);

  // ★ v49 WALL-CLOCK ABSOLUTO — NÃO depende de durationMillis / ExoPlayer / cache.
  // Dispara uma vez por item (deps: index+key). Se tudo mais falhar na 2ª passagem, este salva.
  useEffect(() => {
    if (!currentItem || currentItem.mediaType !== "video") return;
    const sec = currentItem.durationSeconds || 30;
    // 85% da duração do CMS, mínimo 5s
    const ms = Math.max(5000, Math.floor(sec * 1000 * 0.85));
    console.log("[ADV52] WALL-CLOCK armed", ms, "ms idx=", currentIndex, "key=", playState.key);
    const t = setTimeout(() => {
      console.log("[ADV52] WALL-CLOCK FIRE idx=", currentIndex);
      advance("wall-clock");
    }, ms);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playState.key]);

  // Garante slot ATIVO alinhado ao item atual (1º vídeo / caminho frio)
  useEffect(() => {
    if (!currentVideoUri || currentItem?.mediaType !== "video") {
      if (!advancingRef.current) {
        setSlotA(null);
        setSlotB(null);
        slotARef.current = null;
        slotBRef.current = null;
      }
      return;
    }
    const side = activeSideRef.current;
    const cur = side === "a" ? slotARef.current : slotBRef.current;
    if (cur && cur.uri === currentVideoUri && cur.index === currentIndex) return;

    slotKeyRef.current += 1;
    const slot = { uri: currentVideoUri, index: currentIndex, key: slotKeyRef.current };
    if (side === "a") { setSlotA(slot); slotARef.current = slot; }
    else { setSlotB(slot); slotBRef.current = slot; }
  }, [currentVideoUri, currentIndex, currentItem?.mediaType, playState.key]);

  // ── Preload: monta slot INATIVO (tamanho real, opacity 0) a partir de 40% ────
  useEffect(() => {
    if (!nextVideoUri) return;
    if (!knownDurationMs || !livePosMs) return;
    if (livePosMs / knownDurationMs < 0.4) return;
    if (preloadStartedRef.current === nextVideoUri) return;
    const len = displayItems.length;
    if (len <= 1) return;
    const nextIndex = (currentIndex + 1) % len;
    preloadStartedRef.current = nextVideoUri;
    slotKeyRef.current += 1;
    const slot = { uri: nextVideoUri, index: nextIndex, key: slotKeyRef.current };
    const coldSide = activeSideRef.current === "a" ? "b" : "a";
    if (coldSide === "a") { setSlotA(slot); slotARef.current = slot; }
    else { setSlotB(slot); slotBRef.current = slot; }
    console.log("[PRE52] cold slot", coldSide, "idx", nextIndex, nextVideoUri.slice(-40));
  }, [livePosMs, knownDurationMs, nextVideoUri, currentIndex, displayItems.length]);

  // Reset preload flag ao trocar item
  useEffect(() => {
    preloadStartedRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playState.key]);

  const handleScreenTap = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);

    // HUD debug escondido: 7 toques rápidos liga/desliga (produção fica limpa)
    const now = Date.now();
    if (now - debugTapRef.current.lastAt > 2500) debugTapRef.current.count = 0;
    debugTapRef.current.lastAt = now;
    debugTapRef.current.count += 1;
    if (debugTapRef.current.count >= 7) {
      debugTapRef.current.count = 0;
      setShowDebugHud((v) => !v);
    }
  };

  const handleUnpair = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    router.replace("/");
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: "#000" }]}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#00b4d8" />
        <Text style={styles.loadingText}>Carregando playlist...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: "#0d1117" }]}>
        <StatusBar hidden />
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Sem conexão com o servidor</Text>
        <Text style={styles.errorSub}>Código: {code}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <ActivityIndicator size="small" color="#f85149" />
          <Text style={{ color: "#8b949e", fontSize: 12, fontFamily: "Inter_400Regular" }}>
            Reconectando automaticamente...
          </Text>
        </View>
        <Pressable style={[styles.retryBtn, { marginTop: 20 }]} onPress={() => refetch()}>
          <Text style={styles.retryText}>Tentar agora</Text>
        </Pressable>
        <Pressable style={styles.backBtn} onPress={handleUnpair}>
          <Text style={styles.backText}>Desparear e voltar</Text>
        </Pressable>
      </View>
    );
  }

  // ── Blocked screen — admin bloqueou esta tela ───────────────────────────────
  if ((data as any)?.blocked) {
    return (
      <View style={[styles.center, { backgroundColor: "#0d1117" }]}>
        <StatusBar hidden />
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
        <Text style={[styles.errorTitle, { color: "#f85149" }]}>Tela Bloqueada</Text>
        <Text style={[styles.errorSub, { textAlign: "center", maxWidth: 320 }]}>
          Esta tela foi bloqueada pelo administrador.{"\n"}
          Entre em contato para regularizar sua assinatura.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20 }}>
          <ActivityIndicator size="small" color="#8b949e" />
          <Text style={{ color: "#8b949e", fontSize: 12, fontFamily: "Inter_400Regular" }}>
            Verificando status automaticamente...
          </Text>
        </View>
      </View>
    );
  }

  if (displayItems.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: "#0d1117" }]}>
        <StatusBar hidden />
        <Text style={styles.errorIcon}>📺</Text>
        <Text style={styles.errorTitle}>Sem conteúdo</Text>
        <Text style={styles.errorSub}>
          Nenhuma playlist atribuída a esta tela.{"\n"}
          Atribua uma playlist no painel de administração.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
          <ActivityIndicator size="small" color="#00b4d8" />
          <Text style={{ color: "#8b949e", fontSize: 12, fontFamily: "Inter_400Regular" }}>
            Verificando novo conteúdo automaticamente...
          </Text>
        </View>
        <Pressable style={[styles.retryBtn, { marginTop: 20 }]} onPress={() => refetch()}>
          <Text style={styles.retryText}>Verificar agora</Text>
        </Pressable>
      </View>
    );
  }

  // ── Standby screen (power off or out of schedule) ──────────────────────────
  if (!shouldDisplay) {
    return (
      <Pressable
        style={[styles.fullscreen, { width: deviceW, height: deviceH, backgroundColor: "#000" }]}
        onPress={handleScreenTap}
      >
        <StatusBar hidden />
        {showControls && (
          <View style={[styles.overlay, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
            <View style={styles.overlayContent}>
              <View style={styles.screenBadge}>
                <Text style={styles.screenBadgeLabel}>Tela</Text>
                <Text style={styles.screenBadgeName} numberOfLines={1}>{data.screenName}</Text>
              </View>
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text style={{ color: "#8b949e", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 }}>ENERGIA</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => setPowerMode("auto")}
                    style={[styles.powerBtn, { backgroundColor: powerMode === "auto" ? "#00b4d8" : "rgba(255,255,255,0.1)" }]}
                  >
                    <Text style={[styles.powerBtnText, { color: powerMode === "auto" ? "#000" : "#fff" }]}>Auto</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPowerMode("off")}
                    style={[styles.powerBtn, { backgroundColor: powerMode === "off" ? "#f85149" : "rgba(255,255,255,0.1)" }]}
                  >
                    <Text style={styles.powerBtnText}>Off</Text>
                  </Pressable>
                </View>
              </View>
              <Pressable style={styles.exitBtn} onPress={handleUnpair}>
                <Text style={styles.exitText}>Desparear</Text>
              </Pressable>
            </View>
            <View style={styles.progressBar} />
          </View>
        )}
      </Pressable>
    );
  }


  const metaRaw = (currentItem as any).metaJson;
  const meta: Record<string, any> | null = (() => {
    if (!metaRaw) return null;
    if (typeof metaRaw === "object") return metaRaw;
    try { return JSON.parse(metaRaw); } catch { return null; }
  })();
  const cityName = meta?.city ?? currentItem.mediaUrl ?? "São Paulo";
  const forecastDays = typeof meta?.days === "number" ? meta.days : 5;
  const rssFeedUrl = meta?.feedUrl ?? currentItem.mediaUrl ?? "";
  const isRssFullscreen = currentItem.mediaType === "rss" && meta?.displayMode === "fullscreen";

  // ticker overlay: collect ALL rss items in "ticker" mode and merge their feeds
  const tickerRssItems = items.filter((it) => {
    if (it.mediaType !== "rss") return false;
    const raw = (it as any).metaJson;
    const m: Record<string, any> | null = (() => {
      if (!raw) return null;
      if (typeof raw === "object") return raw;
      try { return JSON.parse(raw); } catch { return null; }
    })();
    return !m || m.displayMode !== "fullscreen";
  });
  const showTicker = tickerRssItems.length > 0;
  const rssFeeds = tickerRssItems
    .map((it) => {
      const raw = (it as any).metaJson;
      const m: Record<string, any> | null = (() => {
        if (!raw) return null;
        if (typeof raw === "object") return raw;
        try { return JSON.parse(raw); } catch { return null; }
      })();
      return m?.feedUrl ?? it?.mediaUrl ?? "";
    })
    .filter(Boolean);

  const renderSlot = (item: PlayerItem | undefined, slotIndex: number, isActive: boolean) => {
    if (!item) return null;
    const slotUrl = resolveMediaUrl(item.mediaUrl ?? "");
    // Detecta YouTube também quando mídia é web_channel com URL do YT
    const urlIsYT = slotUrl.includes("youtube.com") || slotUrl.includes("youtu.be");
    const slotIsYT = item.mediaType === "youtube" || item.mediaType === "youtube_playlist"
      || (item.mediaType === "web_channel" && urlIsYT);
    const slotWebUrl = slotIsYT ? toYouTubeEmbedUrl(slotUrl) : slotUrl;
    const slotMeta: Record<string, any> | null = (() => {
      const raw = (item as any).metaJson;
      if (!raw) return null;
      if (typeof raw === "object") return raw;
      try { return JSON.parse(raw); } catch { return null; }
    })();
    const slotCity = slotMeta?.city ?? item.mediaUrl ?? "São Paulo";
    const slotForecastDays = typeof slotMeta?.days === "number" ? slotMeta.days : 5;
    const slotRssFeed = slotMeta?.feedUrl ?? item.mediaUrl ?? "";

    const widgetScale = Math.min(1, Math.max(0.15, Math.min(width, height) / 360));

    if (item.mediaType === "rss" && slotMeta?.displayMode === "fullscreen") {
      return <RssFullscreen feedUrl={slotRssFeed} scale={widgetScale} />;
    } else if (item.mediaType === "clock") {
      return <ClockWidget timezone={data?.timezone ?? "America/Sao_Paulo"} scale={widgetScale} />;
    } else if (item.mediaType === "date") {
      return <DateWidget timezone={data?.timezone ?? "America/Sao_Paulo"} scale={widgetScale} />;
    } else if (item.mediaType === "qr_code") {
      return <QRCodeWidget url={item.mediaUrl ?? ""} label={slotMeta?.label} scale={widgetScale} />;
    } else if (item.mediaType === "text") {
      return <TextSlideWidget meta={slotMeta ?? {}} />;
    } else if (item.mediaType === "weather") {
      return <WeatherWidget cityName={slotCity} scale={widgetScale} />;
    } else if (item.mediaType === "weather_forecast") {
      return <WeatherForecastWidget cityName={slotCity} days={slotForecastDays} scale={widgetScale} />;
    } else if (item.mediaType === "web_channel" || slotIsYT || item.mediaType === "pluto_tv"
      || item.mediaType === "canva" || item.mediaType === "google_slides"
      || item.mediaType === "spotify" || item.mediaType === "instagram" || item.mediaType === "tiktok") {
      return isActive ? (
        <WebView
          key={`web-${slotIndex}`}
          source={{ uri: slotWebUrl }}
          style={{ width, height, backgroundColor: "#000" }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          scrollEnabled={false}
          overScrollMode="never"
          injectedJavaScript={slotIsYT ? YT_AUTOPLAY_JS : undefined}
          userAgent={slotIsYT ? "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" : undefined}
        />
      ) : null;
    } else if (item.mediaType === "video") {
      // Video items are rendered in the stable pool below — never inside current/next
      // Animated.Views, because moving a component between different parent elements
      // causes React to unmount+remount it (even with the same key), forcing a full
      // network re-buffer and causing the 5-second black screen.
      return null;
    } else {
      // Usa arquivo local se já cacheado; senão usa URL de rede
      const cachedImageUri = imageCacheMap[slotUrl] ?? slotUrl;
      return (
        <Image
          key={`image-${slotIndex}`}
          source={{ uri: cachedImageUri }}
          style={styles.media}
          contentFit={((item as any).objectFit ?? "contain") as "contain" | "cover" | "fill"}
          transition={0}
        />
      );
    }
  };

  return (
    <Pressable
      ref={screenshotViewRef as any}
      style={[styles.fullscreen, { width: deviceW, height: deviceH, backgroundColor: "#000", ...(isCanvasTransposed ? { overflow: "visible" } : {}) }]}
      onPress={handleScreenTap}
    >
      <StatusBar hidden />
      {/* Canvas — for LED panels this is exactly W×H px; for TVs it fills the device screen */}
      {/* Canvas outer View — sized to the LED box (canvasW×canvasH = device framebuffer area).
          For 90°/270° this is the swapped size (e.g. 256×512 for a landscape 512×256 content).
          Only 0°/180° use a transform here (simple flip). 90°/270° rotation happens on the
          content wrapper inside, keeping everything within the device framebuffer bounds. */}
      <View
        key={`canvas-rot-${panelRotationDeg}`}
        style={{ width: canvasW, height: canvasH, position: "absolute", top: 0, left: 0, ...(canvasTransform ? { transform: canvasTransform } : {}) }}
      >
      {/* Inner clip view — for 0°/180° clips content to canvas bounds.
          For 90°/270° must be overflow:visible so it does NOT pre-clip the content wrapper
          layout (which extends to left=-128) before the rotation transform is applied.
          The content wrapper itself carries overflow:hidden to clip content items. */}
      <View style={{ width: canvasW, height: canvasH, overflow: isCanvasTransposed ? "visible" : "hidden" }}>

      {/* Content wrapper — always rendered.
          For 0°/180°: same size as canvas, at (0,0), no transform. overflow:hidden clips items.
          For 90°/270°: content dims (width×height), centered in canvas box, rotated to fill it.
          overflow:hidden clips content items to content bounds.
          renderToHardwareTextureAndroid: GPU rasterizes the full width×height texture first,
          then the parent composites the rotated result — no layout-level pre-clipping. */}
      <View
        renderToHardwareTextureAndroid={isCanvasTransposed}
        style={{
          width, height,
          overflow: "hidden",
          position: "absolute",
          left: contentLeft,
          top: contentTop,
          ...(isCanvasTransposed ? { transform: [{ rotate: `${panelRotationDeg}deg` }] } : {}),
        }}
      >

      {/* v52 dual-slot: A/B — inativo bufferiza (opacity 0, tamanho real); ativo toca.
          Promote só flipa activeSide → mesma key React → sem ~3s pretos. */}
      {videoGate && currentItem?.mediaType === "video" && (
        <>
          {slotA && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { opacity: activeSide === "a" ? 1 : 0, zIndex: activeSide === "a" ? 2 : 1 },
              ]}
            >
              <VideoPlayer
                key={`slot-a-${slotA.key}`}
                uri={slotA.uri}
                active={activeSide === "a"}
                onEnd={handleVideoEnd}
                onDuration={handleVideoDuration}
                onProgress={handleVideoProgress}
                fallbackSeconds={currentItem.durationSeconds || 30}
                screenWidth={width}
                screenHeight={height}
                objectFit={(currentItem as any).objectFit ?? "contain"}
                debugLabel={`A#${slotA.index + 1}`}
              />
            </View>
          )}
          {slotB && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { opacity: activeSide === "b" ? 1 : 0, zIndex: activeSide === "b" ? 2 : 1 },
              ]}
            >
              <VideoPlayer
                key={`slot-b-${slotB.key}`}
                uri={slotB.uri}
                active={activeSide === "b"}
                onEnd={handleVideoEnd}
                onDuration={handleVideoDuration}
                onProgress={handleVideoProgress}
                fallbackSeconds={currentItem.durationSeconds || 30}
                screenWidth={width}
                screenHeight={height}
                objectFit={(currentItem as any).objectFit ?? "contain"}
                debugLabel={`B#${slotB.index + 1}`}
              />
            </View>
          )}
        </>
      )}

      {/* Itens não-vídeo (imagens, widgets, WebView) */}
      <View style={StyleSheet.absoluteFill}>
        {renderSlot(currentItem, currentIndex, true)}
      </View>

      {/* HUD DEBUG — oculto por padrão. 7 toques rápidos na tela para ligar/desligar. */}
      {showDebugHud && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            backgroundColor: "rgba(0,0,0,0.75)",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 4,
            zIndex: 9999,
          }}
        >
          <Text style={{ color: "#00ff88", fontSize: 14, fontFamily: "monospace" }}>
            {`v52 ${currentIndex + 1}/${displayItems.length || 0} key=${playState.key} gate=${videoGate ? 1 : 0}`}
          </Text>
          <Text style={{ color: "#ffcc66", fontSize: 11, fontFamily: "monospace", marginTop: 2 }} numberOfLines={1}>
            {`last=${lastAdvanceReason} dur=${knownDurationMs || "-"} src=net${cacheReadyForCurrent ? "+cached" : ""} pre=${(activeSide === "a" ? slotB : slotA) ? "▶" : "–"} side=${activeSide}`}
          </Text>
          <Text style={{ color: "#66ccff", fontSize: 11, fontFamily: "monospace", marginTop: 2 }} numberOfLines={1}>
            {`pos=${Math.round(livePosMs / 100) / 10}s / ${knownDurationMs ? Math.round(knownDurationMs / 100) / 10 : "-"}s`}
          </Text>
          <Text style={{ color: "#ffffffaa", fontSize: 11, fontFamily: "monospace", marginTop: 2 }} numberOfLines={1}>
            {(currentItem?.mediaName || currentItem?.mediaType || "?").toString().slice(0, 40)}
          </Text>
        </View>
      )}

      {/* RSS ticker overlay — merges all "ticker" mode RSS items */}
      {showTicker && rssFeeds.length > 0 ? (
        <View style={styles.tickerContainer}>
          <RssTicker feedUrls={rssFeeds} />
        </View>
      ) : null}

      {/* Zone overlays — sidebar (top-right) and logo (bottom-right) */}
      {(data as any)?.layoutZones?.sidebar && (
        <View style={[styles.zoneSidebar, { width: width * 0.38, height: height * 0.5 }]}>
          {(data as any).layoutZones.sidebar.type === "video" ? (
            <VideoPlayer
              uri={(data as any).layoutZones.sidebar.url}
              onEnd={() => {}}
              fallbackSeconds={3600}
              screenWidth={width * 0.38}
              screenHeight={height * 0.5}
              objectFit="cover"
            />
          ) : (
            <Image
              source={{ uri: (data as any).layoutZones.sidebar.url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          )}
        </View>
      )}
      {(data as any)?.layoutZones?.logo && (
        <View style={[styles.zoneLogo, { width: width * 0.38, height: height * 0.5 }]}>
          {(data as any).layoutZones.logo.type === "video" ? (
            <VideoPlayer
              uri={(data as any).layoutZones.logo.url}
              onEnd={() => {}}
              fallbackSeconds={3600}
              screenWidth={width * 0.38}
              screenHeight={height * 0.5}
              objectFit="cover"
            />
          ) : (
            <Image
              source={{ uri: (data as any).layoutZones.logo.url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          )}
        </View>
      )}

      {/* Emergency alert overlay — highest priority, sits above everything */}
      {!!(data as any)?.emergencyAlert && (
        <View style={[styles.emergencyOverlay, { backgroundColor: (data as any).emergencyAlert.bgColor || "#cc0000" }]}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={[styles.emergencyTitle, { color: (data as any).emergencyAlert.textColor || "#ffffff" }]}>
            ALERTA DE EMERGÊNCIA
          </Text>
          <Text style={[styles.emergencyMsg, { color: (data as any).emergencyAlert.textColor || "#ffffff" }]}>
            {(data as any).emergencyAlert.message}
          </Text>
        </View>
      )}

      {/* Device clock — inside content wrapper so acompanha a rotação do painel */}
      {showClock && (
        <DeviceClockOverlay
          timezone={data?.timezone ?? "America/Sao_Paulo"}
          city={(data as any)?.location ?? undefined}
          screenW={width}
          screenH={height}
        />
      )}

      </View>{/* end content wrapper */}
      </View>{/* end inner clip */}
      </View>{/* end canvas */}

      {showControls && (
        <View
          style={[
            styles.overlay,
            { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 },
          ]}
        >
          <View style={styles.overlayContent}>
            <View style={styles.screenBadge}>
              <Text style={styles.screenBadgeLabel}>Tela</Text>
              <Text style={styles.screenBadgeName} numberOfLines={1}>
                {data.screenName}
              </Text>
              {isOffline && (
                <Text style={{ color: "#f85149", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginTop: 2 }}>
                  ⚠ OFFLINE (cache)
                </Text>
              )}
            </View>
            <View style={styles.tzBadge}>
              <Text style={styles.tzLabel}>
                {new Date().toLocaleTimeString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </Text>
              <Text style={styles.tzSub}>🇧🇷 BRT (UTC-3)</Text>
            </View>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: "#8b949e", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 }}>ENERGIA</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setPowerMode("auto")}
                  style={[styles.powerBtn, { backgroundColor: powerMode === "auto" ? "#00b4d8" : "rgba(255,255,255,0.1)" }]}
                >
                  <Text style={[styles.powerBtnText, { color: powerMode === "auto" ? "#000" : "#fff" }]}>Auto</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPowerMode("off")}
                  style={[styles.powerBtn, { backgroundColor: powerMode === "off" ? "#f85149" : "rgba(255,255,255,0.1)" }]}
                >
                  <Text style={styles.powerBtnText}>Off</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ color: "#8b949e", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 }}>RELÓGIO</Text>
              <Pressable
                onPress={toggleClock}
                style={[styles.powerBtn, { backgroundColor: showClock ? "#22c55e" : "rgba(255,255,255,0.1)", minWidth: 68 }]}
              >
                <Text style={[styles.powerBtnText, { color: showClock ? "#000" : "#fff" }]}>
                  {showClock ? "Ligado" : "Desligado"}
                </Text>
              </Pressable>
            </View>
            <Pressable style={styles.exitBtn} onPress={handleUnpair}>
              <Text style={styles.exitText}>Desparear</Text>
            </Pressable>
          </View>

          <View style={styles.progressBar}>
            {displayItems.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: i === currentIndex ? "#00b4d8" : "rgba(255,255,255,0.3)",
                    flex: i === currentIndex ? 2 : 1,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}
      {/* Brightness overlay — black layer; opacity 0 = full brightness, 1 = screen off */}
      {brightnessLevel < 100 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "#000", opacity: (100 - brightnessLevel) / 100, zIndex: 9999 },
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullscreen: { backgroundColor: "#000", position: "relative" },
  media: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  loadingText: { color: "#8b949e", fontSize: 15, marginTop: 12, fontFamily: "Inter_400Regular" },
  errorIcon: { fontSize: 48 },
  errorTitle: { color: "#f0f0f0", fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  errorSub: { color: "#8b949e", fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  retryBtn: { backgroundColor: "#00b4d8", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  retryText: { color: "#0d1117", fontSize: 16, fontFamily: "Inter_700Bold" },
  backBtn: { paddingVertical: 10 },
  backText: { color: "#8b949e", fontSize: 14, fontFamily: "Inter_400Regular" },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "space-between", paddingBottom: 32,
  },
  overlayContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 24 },
  screenBadge: {
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(0,180,216,0.4)", gap: 2, maxWidth: "60%",
  },
  screenBadgeLabel: { color: "#8b949e", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  screenBadgeName: { color: "#00b4d8", fontSize: 18, fontFamily: "Inter_700Bold" },
  tzBadge: { alignItems: "center", backgroundColor: "rgba(0,180,216,0.15)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(0,180,216,0.3)" },
  tzLabel: { color: "#00b4d8", fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tzSub: { color: "#8b949e", fontSize: 9, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  exitBtn: { backgroundColor: "rgba(248,81,73,0.9)", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  exitText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  progressBar: { flexDirection: "row", gap: 4, paddingHorizontal: 24, height: 4 },
  progressDot: { height: 4, borderRadius: 2 },
  powerBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, minWidth: 52, alignItems: "center" },
  powerBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  /* Device clock overlay — fixed top-left corner, always visible */
  deviceClock: {
    position: "absolute", top: 8, left: 8, zIndex: 1002,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  deviceClockTime: {
    color: "#ffffff", fontSize: 14, fontFamily: "Inter_700Bold",
    letterSpacing: 0.5, fontVariant: ["tabular-nums"],
  },
  deviceClockDate: {
    color: "#cccccc", fontSize: 11,
    fontFamily: "Inter_600SemiBold", marginTop: 2,
  },

  /* Clock widget */
  clockContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  textSlideContainer: { alignItems: "center", justifyContent: "center", backgroundColor: "#000", padding: 40 },
  clockTime: { color: "#fff", fontSize: 96, fontFamily: "Inter_700Bold", letterSpacing: -2, fontVariant: ["tabular-nums"] },
  clockDate: { color: "#8b949e", fontSize: 22, fontFamily: "Inter_400Regular", marginTop: 12, textTransform: "capitalize" },

  /* Weather widget */
  weatherContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#001828", gap: 8 },
  weatherEmoji: { fontSize: 80 },
  weatherTemp: { color: "#fff", fontSize: 96, fontFamily: "Inter_700Bold", letterSpacing: -2 },
  weatherCity: { color: "#8b949e", fontSize: 24, fontFamily: "Inter_400Regular" },
  weatherWind: { color: "#00b4d8", fontSize: 18, fontFamily: "Inter_400Regular", marginTop: 8 },

  /* Weather forecast widget */
  forecastContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1a0c00", gap: 12, padding: 24 },
  forecastCity: { color: "#fff", fontSize: 36, fontFamily: "Inter_700Bold" },
  forecastLabel: { color: "#fbbf24", fontSize: 13, fontFamily: "Inter_400Regular", letterSpacing: 3, textTransform: "uppercase" },
  forecastRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" },
  forecastCard: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, minWidth: 80, gap: 4 },
  forecastCardToday: { backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" },
  forecastDayName: { color: "#9ca3af", fontSize: 12, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 1 },
  forecastEmoji: { fontSize: 36 },
  forecastMax: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  forecastMin: { color: "#6b7280", fontSize: 16, fontFamily: "Inter_400Regular" },

  /* Zone overlays */
  zoneSidebar: {
    position: "absolute", top: 0, right: 0, zIndex: 10, backgroundColor: "#000", overflow: "hidden",
  },
  zoneLogo: {
    position: "absolute", bottom: 0, right: 0, zIndex: 10, backgroundColor: "#000", overflow: "hidden",
  },

  /* Emergency alert overlay */
  emergencyOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999, alignItems: "center", justifyContent: "center",
    padding: 40, gap: 24,
  },
  emergencyIcon: { fontSize: 80 },
  emergencyTitle: {
    fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: 3,
    textTransform: "uppercase", textAlign: "center",
  },
  emergencyMsg: {
    fontSize: 48, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 60,
  },

  /* RSS ticker */
  tickerContainer: {
    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20,
  },
  tickerWrapper: {
    flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.82)",
    borderTopWidth: 1, borderTopColor: "#00b4d8", height: 36, overflow: "hidden",
  },
  tickerLabel: {
    paddingHorizontal: 12, backgroundColor: "#00b4d8", alignSelf: "stretch",
    alignItems: "center", justifyContent: "center", minWidth: 80,
  },
  tickerLabelText: { color: "#000", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  tickerScroll: { flex: 1, overflow: "hidden", height: 36, justifyContent: "center" },
  tickerText: { color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", paddingHorizontal: 8 },
});
