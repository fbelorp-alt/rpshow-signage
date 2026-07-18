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
import { Animated, Dimensions, StyleSheet, View } from "react-native";
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
  const scale   = useRef(new Animated.Value(1.0)).current;  // começa igual ao splash nativo
  const opacity = useRef(new Animated.Value(1)).current;    // já visível — sem flash

  useEffect(() => {
    Animated.sequence([
      // pausa curta — logo parado (igual ao splash nativo, transição imperceptível)
      Animated.delay(800),
      // zoom-out suave + fade para sair (~0.6s)
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.18, useNativeDriver: true, duration: 580 }),
        Animated.timing(opacity, { toValue: 0,    useNativeDriver: true, duration: 520 }),
      ]),
    ]).start(() => onDone());
  }, []);

  const { width, height } = Dimensions.get("window");
  // mesmo tamanho visual que o splash nativo (contain numa tela landscape)
  const logoSize = Math.round(Math.min(width, height) * 0.70);

  return (
    <View style={styles.intro}>
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
