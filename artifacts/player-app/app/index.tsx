import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const STORAGE_KEY = "rpshow_screen_code";
const TOKEN_KEY = "rpshow_device_token";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://app.rpshow.com.br";
const POLL_INTERVAL_MS = 30_000;

const LED_MODULE_FIT = 100;
const SMALL_FULLSCREEN_BP = 200;

async function getDeviceSerial(): Promise<{ id: string; type: "serial" | "android_id" }> {
  const androidId = Application.getAndroidId();
  if (androidId && androidId.toLowerCase() !== "unknown" && androidId !== "") {
    return { id: androidId.toUpperCase(), type: "android_id" };
  }

  try {
    const FALLBACK_KEY = "rpshow_device_uuid";
    const stored = await AsyncStorage.getItem(FALLBACK_KEY);
    if (stored) return { id: stored.toUpperCase(), type: "android_id" };
    const uuid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    await AsyncStorage.setItem(FALLBACK_KEY, uuid);
    return { id: uuid, type: "android_id" };
  } catch { /* ignore */ }

  return { id: "UNKNOWN", type: "android_id" };
}


export default function PairingScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const androidIsTiny = shortest <= SMALL_FULLSCREEN_BP;

  const cornerQrSize = 52;
  const tinyQrSize = useMemo(
    () => Math.max(64, Math.floor(shortest * 0.7)),
    [shortest],
  );

  const [serial, setSerial] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "waiting" | "approved" | "pairing" | "error">("loading");
  const [pairingCode, setPairingCode] = useState("");
  const [pairingError, setPairingError] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkApproval = async (deviceSerial: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/devices/check/${deviceSerial}`, { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { approved: boolean; status?: string; screenCode?: string; deviceToken?: string };
      if (data.approved) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Auto-pair: server already linked screen + generated token — navigate directly
        if (data.screenCode && data.deviceToken) {
          await AsyncStorage.setItem(STORAGE_KEY, data.screenCode);
          await AsyncStorage.setItem(TOKEN_KEY, data.deviceToken);
          setAuthTokenGetter(() => data.deviceToken!);
          setStatus("pairing");
          setTimeout(() => {
            router.replace({ pathname: "/player/[code]", params: { code: data.screenCode! } });
          }, 600);
          return;
        }
        setStatus("approved");
      }
    } catch {
      // retry next poll
    }
  };

  const submitPairingCode = async () => {
    const code = pairingCode.trim().toUpperCase();
    if (!code) return;
    setPairingLoading(true);
    setPairingError("");
    try {
      const r = await fetch(`${API_BASE}/api/screens/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode: code }),
        credentials: "include",
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setPairingError(body.error ?? "Código inválido. Verifique e tente novamente.");
        setPairingLoading(false);
        return;
      }
      const data = (await r.json()) as { code: string; deviceToken: string };
      await AsyncStorage.setItem(STORAGE_KEY, data.code);
      await AsyncStorage.setItem(TOKEN_KEY, data.deviceToken);
      setAuthTokenGetter(() => data.deviceToken);
      setStatus("pairing");
      setTimeout(() => {
        router.replace({ pathname: "/player/[code]", params: { code: data.code } });
      }, 600);
    } catch {
      setPairingError("Erro de conexão. Tente novamente.");
      setPairingLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { id } = await getDeviceSerial();
      setSerial(id);

      // Check if already paired with a token
      try {
        const [savedCode, savedToken] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(TOKEN_KEY),
        ]);

        if (savedCode && savedToken) {
          setAuthTokenGetter(() => savedToken);
          setStatus("pairing");
          setTimeout(() => {
            router.replace({ pathname: "/player/[code]", params: { code: savedCode } });
          }, 100);
          return;
        }

        // Migrating from old APK: has screenCode but no token → navigate anyway
        // Player will get 401 and re-pair automatically
        if (savedCode && !savedToken) {
          setStatus("pairing");
          setTimeout(() => {
            router.replace({ pathname: "/player/[code]", params: { code: savedCode } });
          }, 100);
          return;
        }
      } catch {
        // AsyncStorage error — fall through to pairing flow
      }

      // No saved code — check approval via serial
      try {
        const r = await fetch(`${API_BASE}/api/devices/check/${id}`, { cache: "no-store" });
        if (r.ok) {
          const data = (await r.json()) as { approved: boolean; status?: string; screenCode?: string; deviceToken?: string };
          if (data.approved) {
            // Auto-pair: navigate directly without manual code entry
            if (data.screenCode && data.deviceToken) {
              await AsyncStorage.setItem(STORAGE_KEY, data.screenCode);
              await AsyncStorage.setItem(TOKEN_KEY, data.deviceToken);
              setAuthTokenGetter(() => data.deviceToken!);
              setStatus("pairing");
              setTimeout(() => {
                router.replace({ pathname: "/player/[code]", params: { code: data.screenCode! } });
              }, 600);
              return;
            }
            setStatus("approved");
            return;
          }
        }
      } catch {
        // Network error — wait for next poll
      }

      setStatus("waiting");
      intervalRef.current = setInterval(() => checkApproval(id), POLL_INTERVAL_MS);
    })();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (status === "loading") {
    return (
      <View style={styles.fullscreen}>
        <View style={androidIsTiny ? styles.tinyCenter : styles.cornerFit}>
          <ActivityIndicator size="small" color="#00b4d8" />
        </View>
      </View>
    );
  }

  if (status === "pairing") {
    return (
      <View style={styles.fullscreen}>
        <View style={androidIsTiny ? styles.tinyCenter : styles.cornerFit}>
          <Text style={styles.approvedText}>✓ OK</Text>
        </View>
      </View>
    );
  }

  // Device approved — show pairing code input
  if (status === "approved") {
    return (
      <View style={styles.pairScreen}>
        <Text style={styles.pairTitle}>Aprovado!</Text>
        <Text style={styles.pairSubtitle}>Cole o código da tela (dashboard → Telas)</Text>
        <TextInput
          style={styles.pairInput}
          value={pairingCode}
          onChangeText={setPairingCode}
          placeholder="Ex: A1B2C3D4"
          placeholderTextColor="#4a5568"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {!!pairingError && <Text style={styles.pairError}>{pairingError}</Text>}
        <TouchableOpacity
          style={[styles.pairBtn, pairingLoading && { opacity: 0.5 }]}
          onPress={submitPairingCode}
          disabled={pairingLoading}
        >
          <Text style={styles.pairBtnText}>{pairingLoading ? "Conectando..." : "Conectar"}</Text>
        </TouchableOpacity>
        <Text style={styles.pairSerial}>{serial ? `Serial: ${serial.slice(-8)}` : ""}</Text>
      </View>
    );
  }

  // Android reportou tela miúda de verdade
  if (androidIsTiny) {
    return (
      <View style={styles.tinyScreen}>
        <Text
          style={styles.tinySerial}
          selectable
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.45}
        >
          {serial || "—"}
        </Text>
        {serial ? (
          <View style={styles.tinyQrWrap}>
            <QRCode
              value={`${API_BASE}/devices?serial=${serial}`}
              size={tinyQrSize}
              backgroundColor="#ffffff"
              color="#000000"
              ecl="M"
            />
          </View>
        ) : null}
      </View>
    );
  }

  // Padrão Taurus: framebuffer grande, LED NovaLCT ~168x168 no canto → box ≤160
  return (
    <View style={styles.fullscreen}>
      <View style={styles.cornerFit}>
        <Text
          style={styles.serialText}
          selectable
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {serial ? serial.slice(-8) : "—"}
        </Text>
        {serial ? (
          <View style={styles.qrWrap}>
            <QRCode
              value={`${API_BASE}/devices?serial=${serial}`}
              size={cornerQrSize}
              backgroundColor="#ffffff"
              color="#000000"
              ecl="M"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cornerFit: {
    position: "absolute",
    top: 4,
    left: 4,
    width: LED_MODULE_FIT,
    maxWidth: LED_MODULE_FIT,
    maxHeight: LED_MODULE_FIT,
    backgroundColor: "rgba(0,0,0,0.92)",
    borderWidth: 1,
    borderColor: "#00b4d8",
    borderRadius: 4,
    padding: 4,
    alignItems: "center",
    overflow: "hidden",
  },
  serialText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#00b4d8",
    letterSpacing: 1,
    fontFamily: "monospace",
    textAlign: "center",
    width: "100%",
    marginBottom: 3,
  },
  qrWrap: {
    padding: 1,
    backgroundColor: "#ffffff",
    borderRadius: 2,
  },
  approvedText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#22c55e",
    letterSpacing: 1,
  },
  pairScreen: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  pairTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#22c55e",
    marginBottom: 8,
  },
  pairSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
  },
  pairInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#2d3748",
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    fontFamily: "monospace",
    color: "#f8fafc",
    backgroundColor: "#111827",
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 12,
  },
  pairError: {
    fontSize: 13,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 12,
  },
  pairBtn: {
    backgroundColor: "#79B4B0",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 20,
  },
  pairBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  pairSerial: {
    fontSize: 10,
    color: "#475569",
    fontFamily: "monospace",
  },
  tinyScreen: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  tinyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tinySerial: {
    fontSize: 10,
    fontWeight: "800",
    color: "#00b4d8",
    fontFamily: "monospace",
    textAlign: "center",
    maxWidth: "100%",
    marginBottom: 2,
  },
  tinyQrWrap: {
    padding: 2,
    backgroundColor: "#ffffff",
  },
});
