import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePairScreen } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

const STORAGE_KEY = "rpshow_screen_code";

export default function EnterCodeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [screenName, setScreenName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkingStorage, setCheckingStorage] = useState(true);

  const { mutate: pair, isPending } = usePairScreen({
    mutation: {
      onSuccess: async (data) => {
        await AsyncStorage.setItem(STORAGE_KEY, data.code);
        router.replace({ pathname: "/player/[code]", params: { code: data.code } });
      },
      onError: () => {
        setError("Código de pareamento inválido. Verifique no painel.");
      },
    },
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) {
        router.replace({ pathname: "/player/[code]", params: { code: saved } });
      } else {
        setCheckingStorage(false);
      }
    });
  }, []);

  const handleConnect = () => {
    const trimmed = pairingCode.trim().toUpperCase();
    if (!trimmed) {
      setError("Insira o código de pareamento");
      return;
    }
    setError(null);
    Keyboard.dismiss();
    pair({
      data: {
        pairingCode: trimmed,
        name: screenName.trim() || "TV",
      },
    });
  };

  if (checkingStorage) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00b4d8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={styles.logoSection}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.subtitle}>Signage-on · Player de Conteúdo</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Código de Pareamento</Text>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  borderColor: error ? "#f85149" : "#30363d",
                  color: "#f0f0f0",
                  backgroundColor: "#161b22",
                },
                pairingCode.length > 0 && { borderColor: "#00b4d8" },
              ]}
              value={pairingCode}
              onChangeText={(v) => {
                setPairingCode(v.toUpperCase());
                setError(null);
              }}
              placeholder="Código do painel"
              placeholderTextColor="#8b949e"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="next"
              testID="code-input"
            />

            <Text style={[styles.label, { marginTop: 8 }]}>Nome da Tela</Text>
            <TextInput
              style={[
                styles.inputSmall,
                {
                  borderColor: "#30363d",
                  color: "#f0f0f0",
                  backgroundColor: "#161b22",
                },
                screenName.length > 0 && { borderColor: "#30363d" },
              ]}
              value={screenName}
              onChangeText={setScreenName}
              placeholder="Ex: TV Recepção, Loja Centro"
              placeholderTextColor="#8b949e"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={handleConnect}
              testID="name-input"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: "#00b4d8", opacity: pressed ? 0.85 : 1 },
                isPending && { opacity: 0.6 },
              ]}
              onPress={handleConnect}
              disabled={isPending}
              testID="connect-button"
            >
              {isPending ? (
                <ActivityIndicator color="#0d1117" />
              ) : (
                <Text style={styles.buttonText}>Parear Tela</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>
            O código de pareamento está no painel de administração{"\n"}
            em Início → Código de Pareamento
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1117",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  logoSection: {
    alignItems: "center",
    gap: 6,
  },
  logo: {
    width: 160,
    height: 126,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#8b949e",
    letterSpacing: 0.2,
  },
  form: {
    width: "100%",
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#8b949e",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 18,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 6,
    textAlign: "center",
  },
  inputSmall: {
    height: 42,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 18,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 12,
    color: "#f85149",
    fontFamily: "Inter_400Regular",
  },
  button: {
    height: 48,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0d1117",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#8b949e",
    textAlign: "center",
    lineHeight: 18,
  },
});
