import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePairScreen } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const STORAGE_KEY = "rpshow_screen_code";

export default function EnterCodeScreen() {
  const router = useRouter();
  const codeInputRef = useRef<TextInput>(null);
  const nameInputRef = useRef<TextInput>(null);
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
        setError("Código inválido. Verifique no painel.");
        codeInputRef.current?.focus();
      },
    },
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved) {
        router.replace({ pathname: "/player/[code]", params: { code: saved } });
      } else {
        setCheckingStorage(false);
        setTimeout(() => codeInputRef.current?.focus(), 400);
      }
    });
  }, []);

  const handleConnect = () => {
    const trimmed = pairingCode.trim().toUpperCase();
    if (!trimmed) {
      setError("Insira o código de pareamento");
      codeInputRef.current?.focus();
      return;
    }
    setError(null);
    Keyboard.dismiss();
    pair({ data: { pairingCode: trimmed, name: screenName.trim() || "TV" } });
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.label}>CÓDIGO DE PAREAMENTO</Text>
          <TextInput
            ref={codeInputRef}
            style={[
              styles.input,
              { borderColor: error ? "#f85149" : pairingCode.length > 0 ? "#00b4d8" : "#30363d" },
            ]}
            value={pairingCode}
            onChangeText={(v) => { setPairingCode(v.toUpperCase()); setError(null); }}
            placeholder="Código do painel"
            placeholderTextColor="#8b949e"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="next"
            onSubmitEditing={() => nameInputRef.current?.focus()}
            // Mouse / keyboard support on non-touch Android displays
            focusable={true}
            accessible={true}
            accessibilityLabel="Código de pareamento"
            testID="code-input"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>NOME DA TELA</Text>
          <TextInput
            ref={nameInputRef}
            style={[styles.inputSmall, { borderColor: "#30363d" }]}
            value={screenName}
            onChangeText={setScreenName}
            placeholder="Ex: TV Recepção, Loja Centro"
            placeholderTextColor="#8b949e"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={handleConnect}
            focusable={true}
            accessible={true}
            accessibilityLabel="Nome da tela"
            testID="name-input"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: isPending ? "#0090a8" : "#00b4d8" }]}
            onPress={handleConnect}
            disabled={isPending}
            activeOpacity={0.8}
            focusable={true}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Parear Tela"
            testID="connect-button"
          >
            {isPending
              ? <ActivityIndicator color="#0d1117" />
              : <Text style={styles.buttonText}>Parear Tela</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          O código de pareamento está no painel de administração{"\n"}
          em Início → Código de Pareamento
        </Text>
      </ScrollView>
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
  // ScrollView content: centraliza verticalmente em telas grandes,
  // mas é scrollável em telas pequenas ou com teclado aberto
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 24,
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
    maxWidth: 480,
    backgroundColor: "#161b22",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#30363d",
    padding: 28,
    gap: 6,
  },
  label: {
    fontSize: 11,
    color: "#8b949e",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 18,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 8,
    textAlign: "center",
    color: "#f0f0f0",
    backgroundColor: "#0d1117",
  },
  inputSmall: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 18,
    fontSize: 15,
    color: "#f0f0f0",
    backgroundColor: "#0d1117",
  },
  errorText: {
    fontSize: 12,
    color: "#f85149",
    marginTop: 2,
  },
  button: {
    height: 54,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0d1117",
  },
  hint: {
    fontSize: 12,
    color: "#8b949e",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 380,
  },
});
