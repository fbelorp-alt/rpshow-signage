import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

const STORAGE_KEY = "rpshow_screen_code";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "https://vnnox-tracker.replit.app";
const POLL_INTERVAL_MS = 30_000;

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
  const [serial, setSerial] = useState<string>("");
  const [serialType, setSerialType] = useState<"serial" | "android_id">("android_id");
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
      // silently ignore network errors, will retry next poll
    }
  };

  useEffect(() => {
    (async () => {
      const { id, type } = await getDeviceSerial();
      setSerial(id);
      setSerialType(type);

      // Sempre consulta o servidor para pegar o código atual do dispositivo.
      // Isso garante que se o admin excluiu a tela e criou uma nova, o player
      // vai usar o código novo em vez de ficar preso no código antigo do AsyncStorage.
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
          // Dispositivo pendente/rejeitado — limpa código salvo e mostra pareamento
          if (!data.approved) {
            await AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        // Sem internet — tenta usar código salvo no cache como fallback
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
        <View style={styles.corner}>
          <ActivityIndicator size="small" color="#00b4d8" />
        </View>
      </View>
    );
  }

  if (status === "approved") {
    return (
      <View style={styles.fullscreen}>
        <View style={styles.corner}>
          <Text style={styles.approvedText}>✓ OK</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullscreen}>
      {/* Compact box fixed to top-left corner — fits in first LED module */}
      <View style={styles.corner}>
        <Text style={styles.label}>
          {serialType === "serial" ? "SERIAL" : "ID"}
        </Text>
        <Text style={styles.serialText} selectable numberOfLines={1} adjustsFontSizeToFit>
          {serial || "—"}
        </Text>
        {serial ? (
          <View style={styles.qrWrap}>
            <QRCode
              value={`${API_BASE}/devices?serial=${serial}`}
              size={80}
              backgroundColor="#000000"
              color="#ffffff"
            />
          </View>
        ) : null}
        <View style={styles.pollRow}>
          <ActivityIndicator size="small" color="#00b4d8" />
          <Text style={styles.pollText}>aguardando…</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  // Compact box pinned to top-left — designed to fit inside the first LED module
  corner: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: "#00b4d8",
    borderRadius: 6,
    padding: 8,
    maxWidth: 200,
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 9,
    color: "#8b949e",
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  serialText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#00b4d8",
    letterSpacing: 1,
    fontFamily: "monospace",
    textAlign: "center",
    maxWidth: 184,
  },
  qrWrap: {
    marginTop: 4,
    padding: 4,
    backgroundColor: "#ffffff",
    borderRadius: 4,
  },
  pollRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  pollText: {
    fontSize: 9,
    color: "#8b949e",
  },
  approvedText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22c55e",
    letterSpacing: 2,
  },
});
