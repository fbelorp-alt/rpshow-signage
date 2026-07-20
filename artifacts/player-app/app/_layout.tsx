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
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
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

// ── IntroScreen — zoom de impacto cinematográfico ──────────────────────────────
// Timeline (tela normal ~2.4s):
//   0→900ms  zoom 0.18→1.12 (overshoot) + fade-in + glow sobe
//   900→1200ms settle 1.12→1.0 ("bate e encaixa")
//   ~900ms   flash branco sutil ~180ms
//   1200→1900ms hold + pulse no glow
//   1900→2400ms zoom-out 1.0→1.35 + fade-out → onDone()
//
// LED tiny (min≤200): total ~1.8s — não travar o player
function IntroScreen({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get("window");
  const shortest = Math.min(width, height);
  const isTiny = shortest <= 200;

  const logoSize = Math.round(shortest * 0.58);
  const glowBase = logoSize * 1.6;

  // Animated values — todos nativeDriver-safe (opacity + transform)
  const scale       = useRef(new Animated.Value(0.18)).current;
  const opacity     = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ── LED tiny: intro rápido ~1.8s ─────────────────────────────────────────
    if (isTiny) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,       { toValue: 1.0, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity,     { toValue: 1,   duration: 550, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
        ]),
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(scale,       { toValue: 1.25, duration: 380, useNativeDriver: true }),
          Animated.timing(opacity,     { toValue: 0,    duration: 380, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0,    duration: 280, useNativeDriver: true }),
        ]),
      ]).start(() => onDone());
      return;
    }

    // ── Flash branco no pico do overshoot (~850ms) ────────────────────────────
    const flashTimer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.12, duration: 90,  useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0,    duration: 100, useNativeDriver: true }),
      ]).start();
    }, 850);

    // ── Sequência principal ───────────────────────────────────────────────────
    Animated.sequence([
      // Fase 1 (0→900ms): zoom-in overshoot 0.18→1.12 + fade-in + glow forte
      Animated.parallel([
        Animated.timing(scale,       { toValue: 1.12, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity,     { toValue: 1,    duration: 680, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.72, duration: 900, useNativeDriver: true }),
      ]),
      // Fase 2 (900→1200ms): settle — "bate e encaixa"
      Animated.parallel([
        Animated.timing(scale,       { toValue: 1.0,  duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.32, duration: 300, useNativeDriver: true }),
      ]),
      // Fase 3 (1200→1900ms): pulse no glow
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.45, duration: 350, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.22, duration: 350, useNativeDriver: true }),
      ]),
      // Fase 4 (1900→2400ms): zoom-out + fade-out
      Animated.parallel([
        Animated.timing(scale,       { toValue: 1.35, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity,     { toValue: 0,    duration: 480, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0,    duration: 320, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());

    return () => clearTimeout(flashTimer);
  }, []);

  return (
    <View style={styles.intro}>
      {/* Glow radial teal — 3 anéis concêntricos, opacidade decrescente */}
      <Animated.View style={[styles.glowRing, {
        width: glowBase * 1.4, height: glowBase * 1.4,
        borderRadius: glowBase * 0.7,
        opacity: Animated.multiply(glowOpacity, 0.45),
        transform: [{ scale }],
      }]} />
      <Animated.View style={[styles.glowRing, {
        width: glowBase * 0.95, height: glowBase * 0.95,
        borderRadius: glowBase * 0.475,
        opacity: Animated.multiply(glowOpacity, 0.75),
        transform: [{ scale }],
      }]} />
      <Animated.View style={[styles.glowRing, {
        width: glowBase * 0.55, height: glowBase * 0.55,
        borderRadius: glowBase * 0.275,
        opacity: glowOpacity,
        transform: [{ scale }],
      }]} />

      {/* Logo — única imagem, sem texto */}
      <Animated.Image
        source={require("../assets/images/splash-logo.png")}
        style={{
          width: logoSize,
          height: logoSize,
          resizeMode: "contain",
          transform: [{ scale }],
          opacity,
        }}
      />

      {/* Flash branco full-screen — sensação de impacto no overshoot */}
      <Animated.View style={[styles.flash, { opacity: flashOpacity }]} pointerEvents="none" />
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
  flash: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#ffffff",
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
