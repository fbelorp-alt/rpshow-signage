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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import type { PlayerItem } from "@workspace/api-client-react";

const STORAGE_KEY = "rpshow_screen_code";
const POLL_INTERVAL_MS = 60_000;

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
    await customFetch(`/api/player/${screenCode}/play`, {
      method: "POST",
      body: JSON.stringify({
        mediaId: (item as any).mediaId ?? null,
        mediaName: (item as any).mediaName ?? item.mediaType,
        mediaType: item.mediaType,
        durationSeconds: item.durationSeconds ?? null,
      }),
    });
  } catch {
    // silent — fire and forget
  }
}

function VideoPlayer({
  uri, onEnd, fallbackSeconds = 30, screenWidth, screenHeight,
}: {
  uri: string; onEnd: () => void; fallbackSeconds?: number; screenWidth: number; screenHeight: number;
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

  return (
    <VideoView
      player={player}
      style={{ width: screenWidth, height: screenHeight }}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <View style={styles.clockContainer}>
      <Text style={styles.clockTime}>{timeStr}</Text>
      <Text style={styles.clockDate}>{dateStr}</Text>
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

export default function PlayerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLoggedIndex = useRef<number>(-1);
  const fadeAnim = useRef(new Animated.Value(1)).current;

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

  const items: PlayerItem[] = data?.items ?? [];
  const currentItem = items[currentIndex];

  const advance = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex((prev) => (prev + 1) % Math.max(items.length, 1));
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
    if (type === "web_channel") {
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
        <Text style={styles.errorTitle}>Tela não encontrada</Text>
        <Text style={styles.errorSub}>Código: {code}</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </Pressable>
        <Pressable style={styles.backBtn} onPress={handleUnpair}>
          <Text style={styles.backText}>Desparear e voltar</Text>
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: "#0d1117" }]}>
        <StatusBar hidden />
        <Text style={styles.errorIcon}>📺</Text>
        <Text style={styles.errorTitle}>Sem conteúdo</Text>
        <Text style={styles.errorSub}>
          Nenhum item na playlist desta tela.{"\n"}
          Adicione mídia no painel de administração.
        </Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Verificar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const mediaUrl = resolveMediaUrl(currentItem.mediaUrl ?? "");
  const isVideo = currentItem.mediaType === "video";
  const isWebChannel = currentItem.mediaType === "web_channel";
  const isClock = currentItem.mediaType === "clock";
  const isWeather = currentItem.mediaType === "weather";

  const meta = (currentItem as any).metaJson as Record<string, any> | null;
  const cityName = meta?.city ?? currentItem.mediaUrl ?? "São Paulo";
  const rssFeedUrl = meta?.feedUrl ?? currentItem.mediaUrl ?? "";
  const showRss = items.some((it) => it.mediaType === "rss");
  const rssItem = items.find((it) => it.mediaType === "rss");
  const rssFeed = (rssItem as any)?.metaJson?.feedUrl ?? rssItem?.mediaUrl ?? "";

  return (
    <Pressable
      style={[styles.fullscreen, { width, height }]}
      onPress={handleScreenTap}
    >
      <StatusBar hidden />

      {/* Crossfade wrapper — all media content fades in/out on slide change */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {isClock ? (
          <ClockWidget />
        ) : isWeather ? (
          <WeatherWidget cityName={cityName} />
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
          />
        ) : (
          <Image
            key={`image-${currentIndex}`}
            source={{ uri: mediaUrl }}
            style={styles.media}
            contentFit="contain"
            transition={0}
          />
        )}
      </Animated.View>

      {/* RSS ticker overlay — always visible if there's an RSS item in playlist */}
      {showRss && rssFeed ? (
        <View style={styles.tickerContainer}>
          <RssTicker feedUrl={rssFeed} />
        </View>
      ) : null}

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
            <Pressable style={styles.exitBtn} onPress={handleUnpair}>
              <Text style={styles.exitText}>Desparear</Text>
            </Pressable>
          </View>

          <View style={styles.progressBar}>
            {items.filter(i => i.mediaType !== "rss").map((_, i) => (
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
