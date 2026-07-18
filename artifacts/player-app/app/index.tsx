import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

const STORAGE_KEY = "rpshow_screen_code";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://app.rpshow.com.br";
const POLL_INTERVAL_MS = 30_000;

/**
 * NovaLCT mapeia o LED (ex.: 168x168), mas o Android do Taurus muitas vezes
 * reporta framebuffer grande (720p/1080p). Só o canto superior-esquerdo aparece
 * na placa. Por isso o box de pareamento TEM que caber em ~100x100 SEMPRE,
 * independente de Dimensions. (confirmado em campo: T10 Plus)
 */
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
  const [status, setStatus] = useState<"loading" | "waiting" | "approved" | "error">("loading");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkApproval = async (deviceSerial: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/devices/check/${deviceSerial}`);
      if (!r.ok) return;
      const data = (await r.json()) as { approved: boolean; screenCode: string | null };
      if (data.approved && data.screenCode) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        await AsyncStorage.setItem(STORAGE_KEY, data.screenCode);
        setStatus("approved");
        setTimeout(() => {
          router.replace({ pathname: "/player/[code]", params: { code: data.screenCode! } });
        }, 800);
      }
    } catch {
      // retry next poll
    }
  };

  useEffect(() => {
    (async () => {
      const { id } = await getDeviceSerial();
      setSerial(id);

      try {
        const r = await fetch(`${API_BASE}/api/devices/check/${id}`);
        if (r.ok) {
          const data = (await r.json()) as { approved: boolean; screenCode: string | null };
          if (data.approved && data.screenCode) {
            await AsyncStorage.setItem(STORAGE_KEY, data.screenCode);
            setStatus("approved");
            setTimeout(() => {
              router.replace({ pathname: "/player/[code]", params: { code: data.screenCode! } });
            }, 800);
            return;
          }
          if (!data.approved) {
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          router.replace({ pathname: "/player/[code]", params: { code: saved } });
          return;
        }
      }

      setStatus("waiting");
      await checkApproval(id);
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

  if (status === "approved") {
    return (
      <View style={styles.fullscreen}>
        <View style={androidIsTiny ? styles.tinyCenter : styles.cornerFit}>
          <Text style={styles.approvedText}>✓ OK</Text>
        </View>
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
      {/* Box 100x100 no canto — ID do dispositivo + QR para painel LED NovaLCT */}
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
  /** Box 100x100 — confirmado em campo no T10 Plus */
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
