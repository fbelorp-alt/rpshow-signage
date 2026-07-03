import * as Application from "expo-application";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DeviceInfo from "react-native-device-info";
import QRCode from "react-native-qrcode-svg";

const STORAGE_KEY = "rpshow_screen_code";
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://rpshowonsign.replit.app";
const POLL_INTERVAL_MS = 30_000;

async function getDeviceSerial(): Promise<{ id: string; type: "serial" | "android_id" }> {
  // 1. Try hardware serial (requires permission, works on some devices)
  try {
    const serial = await DeviceInfo.getSerialNumber();
    if (serial && serial.toLowerCase() !== "unknown" && serial !== "") {
      return { id: serial.toUpperCase(), type: "serial" };
    }
  } catch { /* ignore */ }

  // 2. Try expo-application androidId
  if (Application.androidId && Application.androidId.toLowerCase() !== "unknown") {
    return { id: Application.androidId.toUpperCase(), type: "android_id" };
  }

  // 3. Try DeviceInfo.getUniqueId() — works on TV boxes without Google Play
  try {
    const uid = await DeviceInfo.getUniqueId();
    if (uid && uid.toLowerCase() !== "unknown" && uid !== "") {
      return { id: uid.toUpperCase(), type: "android_id" };
    }
  } catch { /* ignore */ }

  // 4. Last resort: generate and persist a random UUID
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
      // 1. Check if already paired
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        router.replace({ pathname: "/player/[code]", params: { code: saved } });
        return;
      }

      // 2. Get device serial (Build.SERIAL preferred, androidId fallback)
      const { id, type } = await getDeviceSerial();
      setSerial(id);
      setSerialType(type);
      setStatus("waiting");

      // 3. Check immediately, then poll every 30s
      await checkApproval(id);
      intervalRef.current = setInterval(() => checkApproval(id), POLL_INTERVAL_MS);
    })();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (status === "loading") {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00b4d8" />
      </View>
    );
  }

  if (status === "approved") {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.approvedText}>✓ LIBERADO</Text>
        <ActivityIndicator size="small" color="#00b4d8" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoSection}>
        <View style={styles.logoClip}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            resizeMode="stretch"
          />
        </View>
        <Text style={styles.subtitle}>SISTEMAS INTEGRADOS</Text>
      </View>

      {/* Waiting card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>AGUARDANDO LIBERAÇÃO</Text>

        <View style={styles.cardBody}>
          {/* Serial info — left column */}
          <View style={styles.serialBox}>
            <Text style={styles.serialLabel}>
              {serialType === "serial" ? "SERIAL DO APARELHO (S/N)" : "ID DO DISPOSITIVO"}
            </Text>
            <Text style={styles.serialText} selectable>{serial || "—"}</Text>
            <Text style={styles.serialTypeHint}>
              {serialType === "serial"
                ? "Visível também na etiqueta física e no Novastar"
                : "Use este ID ao cadastrar no painel"}
            </Text>
          </View>

          {/* QR Code — right column */}
          {serial ? (
            <View style={styles.qrBox}>
              <QRCode
                value={`${API_BASE}/devices?serial=${serial}`}
                size={150}
                backgroundColor="#0d1117"
                color="#00b4d8"
              />
              <Text style={styles.qrLabel}>Escaneie para{"\n"}cadastrar no celular</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.pollRow}>
          <ActivityIndicator size="small" color="#00b4d8" />
          <Text style={styles.pollText}>Verificando aprovação a cada 30s…</Text>
        </View>
      </View>

      <Text style={styles.hint}>
        Escaneie o QR com o celular ou acesse o painel e cadastre o ID acima
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1117",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 28,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoSection: {
    alignItems: "center",
    gap: 8,
  },
  logoClip: {
    width: 220,
    height: 105,
    overflow: "hidden",
  },
  logo: {
    width: 220,
    height: 178,
  },
  subtitle: {
    fontSize: 13,
    color: "#8b949e",
    letterSpacing: 0.2,
  },
  card: {
    width: "100%",
    maxWidth: 620,
    backgroundColor: "#161b22",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#30363d",
    padding: 32,
    alignItems: "center",
    gap: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f0f0f0",
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
  },
  cardBody: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    flexWrap: "wrap",
  },
  cardDesc: {
    fontSize: 13,
    color: "#8b949e",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 400,
  },
  serialBox: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#0d1117",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#00b4d8",
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  qrBox: {
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: "#0d1117",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#30363d",
  },
  qrLabel: {
    fontSize: 10,
    color: "#8b949e",
    textAlign: "center",
    letterSpacing: 0.5,
    lineHeight: 15,
  },
  serialLabel: {
    fontSize: 10,
    color: "#8b949e",
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  serialText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#00b4d8",
    letterSpacing: 4,
    fontFamily: "monospace",
    textAlign: "center",
  },
  serialTypeHint: {
    fontSize: 10,
    color: "#8b949e",
    textAlign: "center",
    marginTop: 4,
  },
  pollRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  pollText: {
    fontSize: 12,
    color: "#8b949e",
  },
  hint: {
    fontSize: 11,
    color: "#8b949e",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 380,
  },
  approvedText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#22c55e",
    letterSpacing: 4,
  },
});
