import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { setBaseUrl } from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";

const _domain = process.env.EXPO_PUBLIC_DOMAIN ?? "app.rpshow.com.br";
setBaseUrl(`https://${_domain}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: 2000,
      staleTime: 30_000,
    },
  },
});

// ── IntroScreen — toca o vídeo intro.mp4 e chama onDone ao terminar ───────────
function IntroScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get("window");
  const shortest = Math.min(width, height);
  const isTiny = shortest <= 200;
  const doneFiredRef = useRef(false);

  const fireDone = useCallback(() => {
    if (doneFiredRef.current) return;
    doneFiredRef.current = true;
    onDone();
  }, [onDone]);

  const player = useVideoPlayer(
    require("../assets/intro.mp4"),
    (p) => {
      p.loop = false;
      if (!isTiny) p.play();
    }
  );

  useEffect(() => {
    // Telas LED pequenas: pula o intro
    if (isTiny) {
      fireDone();
      return;
    }

    // Fallback: máximo 20s — garante que o app nunca trava no intro
    const fallback = setTimeout(fireDone, 20_000);

    // Detecta fim do vídeo: isPlaying vira false depois que currentTime > 0
    const sub = player.addListener("playingChange", ({ isPlaying }: { isPlaying: boolean }) => {
      if (!isPlaying && player.currentTime > 0.5) {
        fireDone();
      }
    });

    return () => {
      clearTimeout(fallback);
      sub.remove();
    };
  }, []);

  if (isTiny) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <VideoView
        player={player}
        style={{ width, height }}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {introVisible ? (
            <IntroScreen onDone={() => setIntroVisible(false)} />
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
