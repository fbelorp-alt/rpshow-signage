import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGetPlayerPlaylist, useHeartbeat, customFetch } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
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
const SCREENSHOT_INTERVAL_MS = 2 * 60 * 1000; // 2 min

function resolveMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith("http")) return rawUrl;
  const apiPath = rawUrl.startsWith("/objects/") ? `/api/storage${rawUrl}` : rawUrl;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}${apiPath.startsWith("/") ? "" : "/"}${apiPath}`;
  return apiPath;
}

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
  uri, onEnd, fallbackSeconds = 30, screenWidth, screenHeight, objectFit = "contain",
}: {
  uri: string; onEnd: () => void; fallbackSeconds?: number; screenWidth: number; screenHeight: number; objectFit?: string;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => { player.play(); }, [player]);
  useEffect(() => {
    const sub = player.addListener("playToEnd", () => { onEnd(); });
    return () => sub.remove();
  }, [player, onEnd]);
  useEffect(() => {
    const t = setTimeout(onEnd, fallbackSeconds * 1000);
    return () => clearTimeout(t);
  }, [onEnd, fallbackSeconds]);

  const videoFit = objectFit === "cover" ? "cover" : objectFit === "fill" ? "fill" : "contain";

  return (
    <VideoView
      player={player}
      style={{ width: screenWidth, height: screenHeight }}
      contentFit={videoFit as "contain" | "cover" | "fill"}
      nativeControls={false}
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

function RssTicker({ feedUrl }: { feedUrl: string }) {
  const [headlines, setHeadlines] = useState<string[]>([]);
  const animX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(400);
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchRss() {
      try {
        const res = await fetch(feedUrl);
        const xml = await res.text();
        const matches = [...xml.matchAll(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gi)];
        const titles = matches.slice(1, 16).map((m) => m[1].trim()).filter(Boolean);
        if (mounted && titles.length) setHeadlines(titles);
      } catch {}
    }
    fetchRss();
    const t = setInterval(fetchRss, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, [feedUrl]);

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
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    async function fetchRss() {
      try {
        const res = await fetch(feedUrl);
        const xml = await res.text();
        const matches = [...xml.matchAll(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gi)];
        const titles = matches.slice(1, 11).map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, " ").trim()).filter(Boolean);
        if (mounted && titles.length) setHeadlines(titles);
      } catch {}
    }
    fetchRss();
    const t = setInterval(fetchRss, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, [feedUrl]);

  useEffect(() => {
    if (!headlines.length) return;
    const cycle = () => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => {
        setIdx((i) => (i + 1) % headlines.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      });
    };
    const t = setInterval(cycle, 6000);
    return () => clearInterval(t);
  }, [headlines, fadeAnim]);

  if (!headlines.length) return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a14", justifyContent: "center", alignItems: "center" }]}>
      <Text style={{ color: "#f97316", fontSize: 14, fontWeight: "bold", opacity: 0.6 }}>Carregando notícias…</Text>
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a14" }]}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 80 }}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 32, gap: 8 }}>
            <View style={{ backgroundColor: "#f97316", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 2 }}>NOTÍCIAS</Text>
            </View>
            <Text style={{ color: "#f97316", opacity: 0.5, fontSize: 11 }}>{idx + 1}/{headlines.length}</Text>
          </View>
          <Text style={{ color: "#ffffff", fontSize: 36, fontWeight: "800", textAlign: "center", lineHeight: 48 }}>
            {headlines[idx]}
          </Text>
        </Animated.View>
      </View>
      <View style={{ height: 3, backgroundColor: "#1a1a2e" }}>
        <View style={{ height: 3, backgroundColor: "#f97316", width: `${((idx + 1) / headlines.length) * 100}%` }} />
      </View>
    </View>
  );
}

export default function PlayerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [powerMode, setPowerMode] = useState<"auto" | "off">("auto");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedIndex = useRef<number>(-1);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const screenshotViewRef = useRef<View>(null);

  // ── Immersive fullscreen on Android ────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    StatusBar.setHidden(true, "none");
  }, []);

  const { data, isLoading, isError, refetch } = useGetPlayerPlaylist(code!);
  const { mutate: sendHeartbeat } = useHeartbeat();

  const { width: screenW, height: screenH } = useWindowDimensions();
  const resolution = `${screenW}x${screenH}`;

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
  const currentItem = displayItems[currentIndex];

  const advance = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((prev) => (prev + 1) % Math.max(displayItems.length, 1));
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [items.length, fadeAnim]);

  useEffect(() => { setCurrentIndex(0); }, [data?.screenName]);

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
    const duration = (currentItem.durationSeconds ?? 10) * 1000;
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

  if (isError || !data) {
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
        style={[styles.fullscreen, { width, height, backgroundColor: "#000" }]}
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

  const mediaUrl = resolveMediaUrl(currentItem.mediaUrl ?? "");
  const isVideo = currentItem.mediaType === "video";
  const isWebChannel = currentItem.mediaType === "web_channel" || currentItem.mediaType === "youtube" || currentItem.mediaType === "pluto_tv"
    || currentItem.mediaType === "canva" || currentItem.mediaType === "google_slides" || currentItem.mediaType === "youtube_playlist"
    || currentItem.mediaType === "spotify" || currentItem.mediaType === "instagram" || currentItem.mediaType === "tiktok";
  const isClock = currentItem.mediaType === "clock";
  const isDate = currentItem.mediaType === "date";
  const isQRCode = currentItem.mediaType === "qr_code";
  const isWeather = currentItem.mediaType === "weather";
  const isForecast = currentItem.mediaType === "weather_forecast";

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

  // ticker overlay: only show for rss items in "ticker" mode (or no mode set = legacy)
  const tickerRssItem = items.find((it) => {
    if (it.mediaType !== "rss") return false;
    const m = (it as any).metaJson as Record<string, any> | null;
    return !m || m.displayMode !== "fullscreen";
  });
  const showTicker = !!tickerRssItem;
  const rssFeed = (tickerRssItem as any)?.metaJson?.feedUrl ?? tickerRssItem?.mediaUrl ?? "";

  return (
    <Pressable
      ref={screenshotViewRef as any}
      style={[styles.fullscreen, { width, height }]}
      onPress={handleScreenTap}
    >
      <StatusBar hidden />

      {/* Crossfade wrapper — all media content fades in/out on slide change */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {isRssFullscreen ? (
          <RssFullscreen feedUrl={rssFeedUrl} />
        ) : isClock ? (
          <ClockWidget timezone={data?.timezone ?? "America/Sao_Paulo"} />
        ) : isDate ? (
          <DateWidget timezone={data?.timezone ?? "America/Sao_Paulo"} />
        ) : isQRCode ? (
          <QRCodeWidget url={currentItem.mediaUrl ?? ""} label={meta?.label} />
        ) : isWeather ? (
          <WeatherWidget cityName={cityName} />
        ) : isForecast ? (
          <WeatherForecastWidget cityName={cityName} days={forecastDays} />
        ) : isWebChannel ? (
          <WebView
            key={`web-${currentIndex}`}
            source={{ uri: mediaUrl }}
            style={{ width, height, backgroundColor: "#000" }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            scrollEnabled={false}
            overScrollMode="never"
          />
        ) : isVideo ? (
          <VideoPlayer
            key={`video-${currentIndex}`}
            uri={mediaUrl}
            onEnd={advance}
            fallbackSeconds={currentItem.durationSeconds ?? 30}
            screenWidth={width}
            screenHeight={height}
            objectFit={(currentItem as any).objectFit ?? "contain"}
          />
        ) : (
          <Image
            key={`image-${currentIndex}`}
            source={{ uri: mediaUrl }}
            style={styles.media}
            contentFit={((currentItem as any).objectFit ?? "contain") as "contain" | "cover" | "fill"}
            transition={0}
          />
        )}
      </Animated.View>

      {/* RSS ticker overlay — only for "ticker" mode RSS items */}
      {showTicker && rssFeed ? (
        <View style={styles.tickerContainer}>
          <RssTicker feedUrl={rssFeed} />
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
