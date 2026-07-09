import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGetPlayerPlaylist, useHeartbeat, customFetch } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
const POLL_INTERVAL_MS = 30_000;
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

function toYouTubeWatchUrl(url: string): string {
  // Keep direct watch URL — avoid embed (causes Erro 153 on videos with embedding disabled)
  // Just ensure autoplay param is present
  try {
    const u = new URL(url);
    u.searchParams.set("autoplay", "1");
    return u.toString();
  } catch {
    return url;
  }
}

const YT_AUTOPLAY_JS = `
(function() {
  var MAX = 30, tries = 0;
  function attempt() {
    var v = document.querySelector('video');
    if (v) {
      v.muted = false;
      v.play().catch(function() { v.muted = true; v.play(); });
    }
    // Hide YouTube header/search bar for a cleaner look
    var hdr = document.querySelector('#masthead-container, ytd-masthead');
    if (hdr) hdr.style.display = 'none';
    if (tries++ < MAX) setTimeout(attempt, 1000);
  }
  document.addEventListener('DOMContentLoaded', attempt);
  setTimeout(attempt, 1500);
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

function VideoPlayer({
  uri, onEnd, fallbackSeconds = 30, screenWidth, screenHeight, objectFit = "contain", active = true,
}: {
  uri: string; onEnd: () => void; fallbackSeconds?: number; screenWidth: number; screenHeight: number; objectFit?: string; active?: boolean;
}) {
  const calledRef = useRef(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef  = useRef<Video>(null);
  // Ref estável para onEnd — evita recriar doEnd quando o pai re-renderiza
  const onEndRef  = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });

  // doEnd sem dependências — nunca muda, nunca dispara re-efeitos
  const doEnd = useCallback(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      // Para o expo-av explicitamente antes de avançar — previne auto-restart
      videoRef.current?.pauseAsync().catch(() => {});
      onEndRef.current();
    }
  }, []); // sem deps — estável para sempre

  // Controle imperativo: play/pause via API em vez de só shouldPlay.
  // replayAsync() busca posição 0 antes de tocar — evita playAsync() no fim do vídeo
  // (que pode disparar didJustFinish imediatamente no wrap-around da playlist).
  useEffect(() => {
    if (active) {
      calledRef.current = false;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      timerRef.current = setTimeout(doEnd, (fallbackSeconds + 30) * 1000);
      videoRef.current?.replayAsync().catch(() => {});
    } else {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      videoRef.current?.pauseAsync().catch(() => {});
    }
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [active, uri]); // doEnd intencionalmente excluído — é estável

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ((status as any).error) doEnd();
      return;
    }
    if (status.didJustFinish) doEnd();
  }, [doEnd]);

  const resizeMode =
    objectFit === "cover"  ? ResizeMode.COVER   :
    objectFit === "fill"   ? ResizeMode.STRETCH  :
                             ResizeMode.CONTAIN;

  return (
    <Video
      ref={videoRef}
      source={{ uri }}
      style={{ width: screenWidth, height: screenHeight }}
      shouldPlay={false}
      isLooping={false}
      isMuted={true}
      resizeMode={resizeMode}
      onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      useNativeControls={false}
    />
  );
}

import QRCode from "react-native-qrcode-svg";

function ClockWidget({ timezone }: { timezone: string }) {
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
      <Text style={styles.clockTime}>{timeStr}</Text>
      <Text style={styles.clockDate}>{dateStr}</Text>
    </View>
  );
}

function DateWidget({ timezone }: { timezone: string }) {
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
      <Text style={[styles.clockDate, { fontSize: 36, textTransform: "capitalize", marginBottom: 8 }]}>{weekday}</Text>
      <Text style={[styles.clockTime, { fontSize: 120, lineHeight: 130 }]}>{day}</Text>
      <Text style={[styles.clockDate, { fontSize: 32, textTransform: "capitalize" }]}>{month} {year}</Text>
    </View>
  );
}

function QRCodeWidget({ url, label }: { url: string; label?: string }) {
  const safeUrl = url && url.startsWith("http") ? url : "https://rpshow.com.br";
  return (
    <View style={styles.clockContainer}>
      <QRCode value={safeUrl} size={280} backgroundColor="#000000" color="#ffffff" />
      {!!label && <Text style={[styles.clockDate, { marginTop: 24, fontSize: 22 }]}>{label}</Text>}
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

function WeatherWidget({ cityName }: { cityName: string }) {
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
        <Text style={styles.weatherCity}>{cityName}</Text>
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={styles.weatherContainer}>
        <Text style={styles.weatherTemp}>—</Text>
        <Text style={styles.weatherCity}>{cityName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.weatherContainer}>
      <Text style={styles.weatherEmoji}>{weatherEmoji(weather.weathercode)}</Text>
      <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
      <Text style={styles.weatherCity}>{weather.cityName}</Text>
      <Text style={styles.weatherWind}>💨 {weather.windspeed} km/h</Text>
    </View>
  );
}

interface ForecastDay {
  date: string;
  weathercode: number;
  tempMax: number;
  tempMin: number;
}

function WeatherForecastWidget({ cityName, days }: { cityName: string; days: number }) {
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
      <Text style={styles.forecastCity}>{displayCity}</Text>
      <Text style={styles.forecastLabel}>PREVISÃO DO TEMPO</Text>
      <View style={styles.forecastRow}>
        {(forecast ?? Array.from({ length: days }).map((_, i) => ({
          date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
          weathercode: 1, tempMax: 0, tempMin: 0,
        }))).map((day, i) => {
          const weekday = DAY_PT[new Date(day.date + "T12:00:00").getDay()];
          const emoji = weatherEmoji(day.weathercode);
          const isToday = i === 0;
          return (
            <View key={day.date} style={[styles.forecastCard, isToday && styles.forecastCardToday]}>
              <Text style={[styles.forecastDayName, isToday && { color: "#fbbf24" }]}>
                {isToday ? "Hoje" : weekday}
              </Text>
              <Text style={styles.forecastEmoji}>{emoji}</Text>
              {forecast ? (
                <>
                  <Text style={styles.forecastMax}>{day.tempMax}°</Text>
                  <Text style={styles.forecastMin}>{day.tempMin}°</Text>
                </>
              ) : (
                <Text style={styles.forecastMax}>—</Text>
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

function RssFullscreen({ feedUrl }: { feedUrl: string }) {
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
      <Text style={{ color: "#f97316", fontSize: 16, fontWeight: "bold", opacity: 0.7 }}>Carregando notícias…</Text>
    </View>
  );

  const current = items[idx];

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#060612" }]}>
      {/* Cabeçalho */}
      <View style={{ paddingHorizontal: 60, paddingTop: 40, paddingBottom: 20, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#f9731620" }}>
        <View style={{ backgroundColor: "#f97316", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4 }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 2 }}>NOTÍCIAS</Text>
        </View>
        <Text style={{ color: "#f97316", opacity: 0.5, fontSize: 13 }}>{idx + 1} / {items.length}</Text>
      </View>

      {/* Conteúdo da notícia */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 60, paddingVertical: 30 }}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={{ color: "#ffffff", fontSize: 38, fontWeight: "800", lineHeight: 52, marginBottom: 28 }}>
            {current.title}
          </Text>
          {!!current.description && (
            <Text style={{ color: "#ffffffb0", fontSize: 22, lineHeight: 34, fontWeight: "400" }}>
              {current.description}
            </Text>
          )}
        </Animated.View>
      </View>

      {/* Barra de progresso */}
      <View style={{ height: 4, backgroundColor: "#0d0d1a" }}>
        <View style={{ height: 4, backgroundColor: "#f97316", width: `${((idx + 1) / items.length) * 100}%` }} />
      </View>
    </View>
  );
}

export default function PlayerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { width: deviceW, height: deviceH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [powerMode, setPowerMode] = useState<"auto" | "off">("auto");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedIndex = useRef<number>(-1);
  const invalidCheckedRef = useRef(false);
  const currentOpacity = useRef(new Animated.Value(1)).current;
  const nextOpacity = useRef(new Animated.Value(0)).current;
  const slideCurrentX = useRef(new Animated.Value(0)).current;
  const slideNextX = useRef(new Animated.Value(0)).current;
  const zoomNextScale = useRef(new Animated.Value(1)).current;
  const screenshotViewRef = useRef<View>(null);

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

  // Panel canvas dimensions — use NovaLCT-configured size for LED panels, device size for TVs
  const panelWidth  = (data as any)?.panelWidth  as number | null | undefined;
  const panelHeight = (data as any)?.panelHeight as number | null | undefined;
  const width  = (panelWidth  && panelWidth  > 0) ? panelWidth  : deviceW;
  const height = (panelHeight && panelHeight > 0) ? panelHeight : deviceH;

  useEffect(() => {
    const doHeartbeat = () => {
      customFetch(`/api/player/${code}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({ resolution }),
      }).catch(() => {});
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

    // per-day schedule (new format) takes priority
    const schedJson = (data as any)?.powerScheduleJson as string | null | undefined;
    if (schedJson) {
      try {
        const sched: { day: number; active: boolean; on: string; off: string }[] = JSON.parse(schedJson);
        const entry = sched.find(e => e.day === curDay);
        if (!entry || !entry.active) return false; // day not active → off
        if (!entry.on || !entry.off) return true;  // active but no times → always on today
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

  const items: PlayerItem[] = data?.items ?? [];


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
  const displayItems = items.filter((it) => !isRssTickerItem(it));
  // Ref sempre atualizado com o comprimento atual — advance usa este ref
  // para nunca ter closure stale quando a playlist muda entre renders
  const displayItemsLengthRef = useRef(displayItems.length);
  displayItemsLengthRef.current = displayItems.length;

  const currentItem = displayItems[currentIndex];
  const nextIndex = (currentIndex + 1) % Math.max(displayItems.length, 1);
  const nextItem = displayItems[nextIndex];

  // ── Cache local de vídeos (NovaSTAR-style) ────────────────────────────────
  // Baixa todos os vídeos da playlist para o armazenamento interno do tablet.
  // Reprodução é sempre do arquivo local (sem depender da rede).
  // Primeira reprodução ainda faz streaming; nas seguintes usa cache local.
  const videoNetworkUrls = displayItems
    .filter((it) => it.mediaType === "video")
    .map((it) => resolveMediaUrl(it.mediaUrl ?? ""))
    .filter(Boolean);
  const videoCacheMap = useVideoCache(videoNetworkUrls);

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

  const advance = useCallback(() => {
    const DURATION = 350;
    // len capturado no momento em que advance é chamado — sem closure stale,
    // sem ref, sem risco de callback nativo trazer valor desatualizado.
    const len = displayItems.length;

    const next = () => {
      setCurrentIndex((prev) => (len > 0 ? (prev + 1) % len : 0));
      setIsTransitioning(false);
    };

    if (transitionEffect === "cut") {
      setIsTransitioning(true);
      next();
      return;
    }

    setIsTransitioning(true);

    if (transitionEffect === "slide") {
      slideNextX.setValue(deviceW);
      nextOpacity.setValue(1);
      Animated.parallel([
        Animated.timing(slideCurrentX, { toValue: -deviceW, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slideNextX, { toValue: 0, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) { slideCurrentX.setValue(0); slideNextX.setValue(0); }
        next();
        slideCurrentX.setValue(0);
        slideNextX.setValue(0);
        nextOpacity.setValue(0);
      });
      return;
    }

    if (transitionEffect === "zoom") {
      nextOpacity.setValue(1);
      zoomNextScale.setValue(1.08);
      Animated.parallel([
        Animated.timing(currentOpacity, { toValue: 0, duration: DURATION, useNativeDriver: true }),
        Animated.timing(zoomNextScale, { toValue: 1, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        next();
        currentOpacity.setValue(1);
        nextOpacity.setValue(0);
        zoomNextScale.setValue(1);
      });
      return;
    }

    // Default: fade
    nextOpacity.setValue(1);
    Animated.timing(currentOpacity, { toValue: 0, duration: DURATION, useNativeDriver: true }).start(() => {
      next();
      currentOpacity.setValue(1);
      nextOpacity.setValue(0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayItems.length, currentOpacity, nextOpacity, slideCurrentX, slideNextX, zoomNextScale, transitionEffect, deviceW]);

  // Reseta índice quando a PLAYLIST muda (não apenas o nome da tela)
  const playlistId = (data as any)?.playlistId ?? null;
  useEffect(() => { setCurrentIndex(0); }, [playlistId]);

  // Garante que currentIndex nunca fique fora dos limites se a playlist encolher
  useEffect(() => {
    if (displayItems.length > 0 && currentIndex >= displayItems.length) {
      setCurrentIndex(0);
    }
  }, [displayItems.length, currentIndex]);

  useEffect(() => {
    if (currentItem && lastLoggedIndex.current !== currentIndex) {
      lastLoggedIndex.current = currentIndex;
      logPlay(code!, currentItem);
    }
  }, [currentIndex, currentItem, code]);

  useEffect(() => {
    const type = currentItem?.mediaType;
    if (!currentItem || type === "video") return;
    if (type === "web_channel" || type === "youtube" || type === "pluto_tv"
      || type === "canva" || type === "google_slides" || type === "youtube_playlist"
      || type === "spotify" || type === "instagram" || type === "tiktok") {
      const dur = currentItem.durationSeconds ?? 0;
      if (!dur) return;
      timerRef.current = setTimeout(advance, dur * 1000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
    // Fire 350ms early (= transition animation duration) so the transition
    // plays during the last 350ms of display time, and the next item appears
    // exactly at durationSeconds — same compensation videos already have.
    const TRANSITION_MS = 350;
    const duration = Math.max(1000, (currentItem.durationSeconds ?? 10) * 1000 - TRANSITION_MS);
    timerRef.current = setTimeout(advance, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, currentItem, advance]);

  const handleScreenTap = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 4000);
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
    const slotIsYT = item.mediaType === "youtube" || item.mediaType === "youtube_playlist";
    const slotWebUrl = slotIsYT ? toYouTubeWatchUrl(slotUrl) : slotUrl;
    const slotMeta: Record<string, any> | null = (() => {
      const raw = (item as any).metaJson;
      if (!raw) return null;
      if (typeof raw === "object") return raw;
      try { return JSON.parse(raw); } catch { return null; }
    })();
    const slotCity = slotMeta?.city ?? item.mediaUrl ?? "São Paulo";
    const slotForecastDays = typeof slotMeta?.days === "number" ? slotMeta.days : 5;
    const slotRssFeed = slotMeta?.feedUrl ?? item.mediaUrl ?? "";

    if (item.mediaType === "rss" && slotMeta?.displayMode === "fullscreen") {
      return <RssFullscreen feedUrl={slotRssFeed} />;
    } else if (item.mediaType === "clock") {
      return <ClockWidget timezone={data?.timezone ?? "America/Sao_Paulo"} />;
    } else if (item.mediaType === "date") {
      return <DateWidget timezone={data?.timezone ?? "America/Sao_Paulo"} />;
    } else if (item.mediaType === "qr_code") {
      return <QRCodeWidget url={item.mediaUrl ?? ""} label={slotMeta?.label} />;
    } else if (item.mediaType === "text") {
      return <TextSlideWidget meta={slotMeta ?? {}} />;
    } else if (item.mediaType === "weather") {
      return <WeatherWidget cityName={slotCity} />;
    } else if (item.mediaType === "weather_forecast") {
      return <WeatherForecastWidget cityName={slotCity} days={slotForecastDays} />;
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
      style={[styles.fullscreen, { width: deviceW, height: deviceH, backgroundColor: "#000" }]}
      onPress={handleScreenTap}
    >
      <StatusBar hidden />
      {/* Canvas — for LED panels this is exactly W×H px; for TVs it fills the device screen */}
      <View style={{ width, height, overflow: "hidden", position: "absolute", top: 0, left: 0 }}>

      {/* ── STABLE VIDEO POOL (sempre montado) ──────────────────────────────────
          NUNCA retorna null para vídeos — todos ficam montados com opacity:0
          quando invisíveis. O ExoPlayer permanece vivo e NÃO é destruído entre
          ciclos da playlist. Este é o fix definitivo para "rodando e parando":
          o player recomeça do início via seekBy(-currentTime), não via reinit.

          Slots visíveis (current/next) usam Animated.Value para transições.
          Slots ocultos usam opacity estática 0 — sem custo de animação. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {displayItems.map((item, idx) => {
          if (item.mediaType !== "video") return null;
          const isCurrentVideo = idx === currentIndex;
          const isNextVideo    = idx === nextIndex && idx !== currentIndex;
          // Usa arquivo local se já baixado; caso contrário streama (primeiro play)
          const networkUrl = resolveMediaUrl(item.mediaUrl ?? "");
          const slotUrl    = videoCacheMap[networkUrl] ?? networkUrl;

          if (isCurrentVideo) {
            return (
              <Animated.View
                key={`video-slot-${idx}`}
                style={[StyleSheet.absoluteFill, {
                  opacity: currentOpacity,
                  transform: [{ translateX: slideCurrentX }],
                }]}
                pointerEvents="auto"
              >
                <VideoPlayer
                  key={`vp-${idx}`}
                  uri={slotUrl}
                  onEnd={advance}
                  fallbackSeconds={item.durationSeconds || 30}
                  screenWidth={width}
                  screenHeight={height}
                  objectFit={(item as any).objectFit ?? "contain"}
                  active={!isTransitioning}
                />
              </Animated.View>
            );
          }

          if (isNextVideo) {
            return (
              <Animated.View
                key={`video-slot-${idx}`}
                style={[StyleSheet.absoluteFill, {
                  opacity: nextOpacity,
                  transform: [{ translateX: slideNextX }, { scale: zoomNextScale }],
                }]}
                pointerEvents="none"
              >
                <VideoPlayer
                  key={`vp-${idx}`}
                  uri={slotUrl}
                  onEnd={() => {}}
                  fallbackSeconds={item.durationSeconds || 30}
                  screenWidth={width}
                  screenHeight={height}
                  objectFit={(item as any).objectFit ?? "contain"}
                  active={false}
                />
              </Animated.View>
            );
          }

          // Slot oculto — não monta ExoPlayer; só current+next ficam vivos.
          // Manter todos montados causava crash/reboot no TB50 por falta de memória.
          return null;
        })}
      </View>


      {/* Next item — preloads underneath current (non-video items) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: nextOpacity, transform: [{ translateX: slideNextX }, { scale: zoomNextScale }] }]} pointerEvents="none">
        {renderSlot(nextItem, nextIndex, false)}
      </Animated.View>

      {/* Current item — plays on top (non-video items) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: currentOpacity, transform: [{ translateX: slideCurrentX }] }]}>
        {renderSlot(currentItem, currentIndex, true)}
      </Animated.View>

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
