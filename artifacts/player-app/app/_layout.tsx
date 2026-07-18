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
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, StyleSheet, View } from "react-native";
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
  const scale   = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // fase 1 — zoom-in + fade-in rápido (0.55s)
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1.0,  useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(opacity, { toValue: 1,    useNativeDriver: true, duration: 520 }),
        Animated.timing(glow,    { toValue: 1,    useNativeDriver: true, duration: 520 }),
      ]),
      // fase 2 — pausa estável (1.1s)
      Animated.delay(1100),
      // fase 3 — zoom-out suave + fade-out (0.55s)
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.28, useNativeDriver: true, duration: 520 }),
        Animated.timing(opacity, { toValue: 0,    useNativeDriver: true, duration: 480 }),
        Animated.timing(glow,    { toValue: 0,    useNativeDriver: true, duration: 400 }),
      ]),
    ]).start(() => onDone());
  }, []);

  const { width, height } = Dimensions.get("window");
  const logoSize = Math.round(Math.min(width, height) * 0.52);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });

  return (
    <View style={styles.intro}>
      {/* anel de brilho teal por trás do logo */}
      <Animated.View
        style={[
          styles.glowRing,
          { width: logoSize * 1.6, height: logoSize * 1.6, borderRadius: logoSize * 0.8, opacity: glowOpacity },
        ]}
      />
      <Animated.Image
        source={require("../assets/images/logo.png")}
        style={{
          width: logoSize,
          height: logoSize,
          resizeMode: "contain",
          transform: [{ scale }],
          opacity,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    flex: 1,
    backgroundColor: "#0d1117",
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    backgroundColor: "#79B4B0",
  },
});

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
