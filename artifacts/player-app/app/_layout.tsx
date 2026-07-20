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

function IntroScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get("window");
  const doneFiredRef = useRef(false);

  const fireDone = useCallback(() => {
    if (doneFiredRef.current) return;
    doneFiredRef.current = true;
    onDone();
  }, [onDone]);

  const player = useVideoPlayer(
    "https://app.rpshow.com.br/intro.mp4",
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  useEffect(() => {
    const fallback = setTimeout(fireDone, 20_000);

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
