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
        <ActivityIndicator size="small" color="#00b4d8" />
      </View>
    );
  }

  if (status === "approved") {
    return (
      <View style={styles.fullscreen}>
        <Text style={styles.approvedText}>✓ OK</Text>
      </View>
    );
  }

  return (
    <View style={styles.fullscreen}>
      {/* ── Brand ── */}
      <Text style={styles.brand}>RPShow OnSign</Text>

      {/* ── Device ID ── */}
      <Text style={styles.serial} selectable numberOfLines={1} adjustsFontSizeToFit>
        {serial || "—"}
      </Text>

      {/* ── QR Code ── */}
      {serial ? (
        <View style={styles.qrWrap}>
          <QRCode
            value={`${API_BASE}/devices?serial=${serial}`}
            size={68}
            backgroundColor="#000000"
            color="#ffffff"
          />
        </View>
      ) : null}

      {/* ── Waiting indicator ── */}
      <View style={styles.waitRow}>
        <ActivityIndicator size="small" color="#00b4d8" style={styles.spinner} />
        <Text style={styles.waitText}>aguardando…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    gap: 6,
  },
  brand: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  serial: {
    fontSize: 9,
    fontWeight: "700",
    color: "#00b4d8",
    letterSpacing: 0.5,
    fontFamily: "monospace",
    textAlign: "center",
    maxWidth: 120,
  },
  qrWrap: {
    padding: 3,
    backgroundColor: "#ffffff",
    borderRadius: 3,
  },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  spinner: {
    transform: [{ scale: 0.6 }],
  },
  waitText: {
    fontSize: 8,
    color: "#666666",
    letterSpacing: 0.3,
  },
  approvedText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#22c55e",
    letterSpacing: 2,
  },
});
