import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tela não encontrada</Text>
      <Pressable style={styles.btn} onPress={() => router.replace("/")}>
        <Text style={styles.btnText}>Voltar ao início</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1117",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  title: {
    color: "#f0f0f0",
    fontSize: 18,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    backgroundColor: "#00b4d8",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: {
    color: "#0d1117",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
