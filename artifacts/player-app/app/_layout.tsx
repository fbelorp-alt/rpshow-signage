import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { setBaseUrl } from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";

const _domain = process.env.EXPO_PUBLIC_DOMAIN ?? "app.rpshow.com.br";
setBaseUrl(`https://${_domain}`);

/** Intro hospedado no servidor — NÃO embutir no APK (v145 engordava ~3MB e quebrava install no Taurus). */
const INTRO_URL = "https://app.rpshow.com.br/intro.mp4";

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

/**
 * Intro de vídeo (efeito do v145) usando expo-av — o mesmo motor do player de playlist.
 * NÃO usa expo-video (módulo extra). NÃO usa require(intro.mp4) no bundle.
 * Se a rede falhar, segue pro app em poucos segundos (fallback).
 */
function IntroScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get("window");
  const doneFiredRef = useRef(false);

  const fireDone = useCallback(() => {
    if (doneFiredRef.current) return;
    doneFiredRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    // Fallback absoluto — nunca travar boot se o vídeo não carregar
    const fallback = setTimeout(fireDone, 12_000);
    return () => clearTimeout(fallback);
  }, [fireDone]);

  const onStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        // erro de load → pula intro
        if ("error" in status && status.error) fireDone();
        return;
      }
      if (status.didJustFinish) fireDone();
    },
    [fireDone],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <Video
        source={{ uri: INTRO_URL }}
        style={{ width, height }}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        useNativeControls={false}
        onPlaybackStatusUpdate={onStatus}
        onError={() => fireDone()}
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
