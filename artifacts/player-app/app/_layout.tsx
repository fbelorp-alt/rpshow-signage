import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { setBaseUrl } from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";

const _domain = process.env.EXPO_PUBLIC_DOMAIN ?? "app.rpshow.com.br";
const _profile = process.env.EXPO_PUBLIC_DEVICE_PROFILE ?? "t10plus";
const _versionCode = parseInt(process.env.EXPO_PUBLIC_VERSION_CODE ?? "0", 10);
setBaseUrl(`https://${_domain}`);

/** Intro hospedado no servidor — NÃO embutir no APK (v145 engordava ~3MB e quebrava install no Taurus). */
const INTRO_URL = "https://app.rpshow.com.br/intro.mp4";
const UPDATE_CHECK_URL = `https://${_domain}/api/player/update/check`;

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

type UpdateStatus = "idle" | "downloading" | "installing" | "error";

function UpdateScreen({ apkUrl, version, onSkip }: { apkUrl: string; version: string; onSkip: () => void }) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [progress, setProgress] = useState(0);

  const doUpdate = useCallback(async () => {
    try {
      setStatus("downloading");
      const localUri = (FileSystem.cacheDirectory ?? "") + "rpshow-update.apk";
      const dl = FileSystem.createDownloadResumable(
        apkUrl,
        localUri,
        {},
        (snap) => {
          if (snap.totalBytesExpectedToWrite > 0) {
            setProgress(Math.round((snap.totalBytesWritten / snap.totalBytesExpectedToWrite) * 100));
          }
        },
      );
      await dl.downloadAsync();
      setStatus("installing");
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1,
        type: "application/vnd.android.package-archive",
      });
      // Se chegou aqui, o usuário cancelou a instalação
      setTimeout(onSkip, 2000);
    } catch {
      setStatus("error");
      setTimeout(onSkip, 3000);
    }
  }, [apkUrl, onSkip]);

  useEffect(() => { void doUpdate(); }, [doUpdate]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color="#79B4B0" />
      <Text style={{ color: "#fff", marginTop: 16, fontSize: 18, fontWeight: "600" }}>
        {status === "downloading" ? `Baixando atualização ${version}... ${progress}%` :
         status === "installing"  ? "Iniciando instalação..." :
         status === "error"       ? "Erro na atualização. Continuando..." :
                                    "Verificando atualização..."}
      </Text>
    </View>
  );
}

async function checkForUpdate(): Promise<{ hasUpdate: boolean; version?: string; versionCode?: number; apkUrl?: string }> {
  try {
    const url = `${UPDATE_CHECK_URL}?profile=${_profile}&versionCode=${_versionCode}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { hasUpdate: false };
    return (await res.json()) as { hasUpdate: boolean; version?: string; versionCode?: number; apkUrl?: string };
  } catch {
    return { hasUpdate: false };
  }
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [introVisible, setIntroVisible] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; apkUrl: string } | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Check for update after intro finishes
  const handleIntroDone = useCallback(() => {
    setIntroVisible(false);
    checkForUpdate().then((result) => {
      if (result.hasUpdate && result.apkUrl && result.version) {
        setUpdateInfo({ version: result.version, apkUrl: result.apkUrl });
      }
    }).catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          {introVisible ? (
            <IntroScreen onDone={handleIntroDone} />
          ) : updateInfo ? (
            <UpdateScreen
              apkUrl={updateInfo.apkUrl}
              version={updateInfo.version}
              onSkip={() => setUpdateInfo(null)}
            />
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
