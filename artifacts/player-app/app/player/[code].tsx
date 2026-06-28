import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGetPlayerPlaylist } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function VideoPlayer({
  uri,
  onEnd,
  fallbackSeconds = 30,
  screenWidth,
  screenHeight,
}: {
  uri: string;
  onEnd: () => void;
  fallbackSeconds?: number;
  screenWidth: number;
  screenHeight: number;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  useEffect(() => {
    const sub = player.addListener("playToEnd", () => {
      onEnd();
    });
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

export default function PlayerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isError, refetch } = useGetPlayerPlaylist(code!);

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refetch]);

  const items: PlayerItem[] = data?.items ?? [];
  const currentItem = items[currentIndex];

  const advance = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(items.length, 1));
  }, [items.length]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [data?.screenName]);

  useEffect(() => {
    if (!currentItem || currentItem.mediaType === "video") return;
    const duration = (currentItem.durationSeconds ?? 10) * 1000;
    timerRef.current = setTimeout(advance, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
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

  return (
    <Pressable
      style={[styles.fullscreen, { width, height }]}
      onPress={handleScreenTap}
    >
      <StatusBar hidden />

      {isVideo ? (
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
          transition={500}
        />
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
            <Pressable style={styles.exitBtn} onPress={handleUnpair}>
              <Text style={styles.exitText}>Desparear</Text>
            </Pressable>
          </View>

          <View style={styles.progressBar}>
            {items.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor:
                      i === currentIndex
                        ? "#00b4d8"
                        : "rgba(255,255,255,0.3)",
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
  fullscreen: {
    backgroundColor: "#000",
    position: "relative",
  },
  media: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  loadingText: {
    color: "#8b949e",
    fontSize: 15,
    marginTop: 12,
    fontFamily: "Inter_400Regular",
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    color: "#f0f0f0",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  errorSub: {
    color: "#8b949e",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: "#00b4d8",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: {
    color: "#0d1117",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  backBtn: {
    paddingVertical: 10,
  },
  backText: {
    color: "#8b949e",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "space-between",
    paddingBottom: 32,
  },
  overlayContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
  },
  screenBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(0,180,216,0.4)",
    gap: 2,
    maxWidth: "60%",
  },
  screenBadgeLabel: {
    color: "#8b949e",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  screenBadgeName: {
    color: "#00b4d8",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  exitBtn: {
    backgroundColor: "rgba(248,81,73,0.9)",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  exitText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  progressBar: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 24,
    height: 4,
  },
  progressDot: {
    height: 4,
    borderRadius: 2,
  },
});
