import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function EnterCodeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Insira o código da tela");
      return;
    }
    setError(null);
    setLoading(true);
    Keyboard.dismiss();
    try {
      router.push({ pathname: "/player/[code]", params: { code: trimmed } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: "#0d1117" }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <View style={styles.logoSection}>
            <View style={[styles.logoIcon, { backgroundColor: "#00b4d8" }]}>
              <Feather name="monitor" size={40} color="#0d1117" />
            </View>
            <Text style={styles.brand}>SignageOS</Text>
            <Text style={styles.subtitle}>Player de Conteúdo</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Código da Tela</Text>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  borderColor: error ? "#f85149" : "#30363d",
                  color: "#f0f0f0",
                  backgroundColor: "#161b22",
                },
                code.length > 0 && { borderColor: "#00b4d8" },
              ]}
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase());
                setError(null);
              }}
              placeholder="ex: A1B2"
              placeholderTextColor="#8b949e"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="done"
              onSubmitEditing={handleConnect}
              testID="code-input"
            />
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: "#00b4d8", opacity: pressed ? 0.85 : 1 },
                loading && { opacity: 0.6 },
              ]}
              onPress={handleConnect}
              disabled={loading}
              testID="connect-button"
            >
              {loading ? (
                <ActivityIndicator color="#0d1117" />
              ) : (
                <>
                  <Feather name="play-circle" size={20} color="#0d1117" />
                  <Text style={styles.buttonText}>Conectar</Text>
                </>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>
            O código é exibido no painel de administração em{"\n"}
            Telas → código da tela
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 40,
  },
  logoSection: {
    alignItems: "center",
    gap: 12,
  },
  logoIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#f0f0f0",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#8b949e",
    letterSpacing: 0.2,
  },
  form: {
    width: "100%",
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#8b949e",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 18,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: 6,
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    color: "#f85149",
    fontFamily: "Inter_400Regular",
  },
  button: {
    height: 56,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  buttonText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#0d1117",
  },
  hint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#8b949e",
    textAlign: "center",
    lineHeight: 20,
  },
});
