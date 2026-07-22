// Dynamic config — allows per-profile ABI selection via TARGET_ABI env var.
// EAS profiles set TARGET_ABI to "armeabi-v7a" (TB1/T10Plus) or "arm64-v8a" (TB10).
// When TARGET_ABI is not set, no ABI filter is applied (universal build).

const targetAbi = process.env.TARGET_ABI; // "armeabi-v7a" | "arm64-v8a" | undefined
// TB50: fat ARM APK with both ABIs so ViPlex installs without issues
const targetAbis = process.env.TARGET_ABIS ? process.env.TARGET_ABIS.split(",") : null;

// Taurus custom Android (TB50/TB10/T10Plus/TB1) trava com New Architecture —
// módulos nativos como react-native-view-shot e safe-area crasham no Fabric.
// SEMPRE desabilitado para todos os perfis de build.
const isArm32 = targetAbi === "armeabi-v7a";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "RPSHOW TV",
  slug: "player-app",
  owner: "rpshow-vnnox-on",
  version: "1.15.35",
  orientation: "landscape",
  icon: "./assets/images/icon.png",
  scheme: "rpshow-player",
  userInterfaceStyle: "dark",
  // Hermes funciona em armeabi-v7a (confirmado em campo: V59 OK). JSC crashava.
  jsEngine: "hermes",
  newArchEnabled: false, // Taurus: New Arch causa tela preta (crash em módulos nativos)
  splash: {
    image: "./assets/images/splash-logo.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.rpshow.signageplayer",
  },
  android: {
    package: "com.rpshow.signageplayer",
    versionCode: 155,
    usesCleartextTraffic: true,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },
    softwareKeyboardLayoutMode: "pan",
    permissions: [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.WAKE_LOCK",
      "android.permission.DISABLE_KEYGUARD",
      "android.permission.READ_PHONE_STATE",
      "android.permission.WRITE_SETTINGS",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
      "android.permission.POST_NOTIFICATIONS",
      // NÃO pedir REQUEST_INSTALL_PACKAGES — ViPlex/Taurus (TB50) rejeita/trava o APK na instalação.
      // Auto-update fica pra depois (instalação manual via ViPlex/ADB).
    ],
    intentFilters: [
      {
        action: "android.intent.action.MAIN",
        category: [
          "android.intent.category.LAUNCHER",
          "android.intent.category.LEANBACK_LAUNCHER",
        ],
      },
      {
        action: "android.intent.action.BOOT_COMPLETED",
        category: ["android.intent.category.DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/images/icon.png",
  },
  plugins: [
    [
      "expo-router",
      {
        origin: "https://replit.com/",
      },
    ],
    "expo-font",
    "expo-web-browser",
    "./plugins/withBootReceiver",
    "./plugins/withAbiFilter",
    "./plugins/withV1Signing",
    "./plugins/withKeepScreenOn",
    "./plugins/withPreventClose",
    "./plugins/withWatchdogService",
    // ABI filter: slim single-ABI (targetAbi) or fat dual-ARM (targetAbis)
    ...((targetAbi || targetAbis)
      ? [
          [
            "expo-build-properties",
            {
              android: {
                abiFilters: targetAbis ?? [targetAbi],
              },
            },
          ],
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "b114afb8-b7ac-4b6e-b1e7-1e7335cf0b92",
    },
  },
  // EXPO_PUBLIC_DEVICE_PROFILE e EXPO_PUBLIC_VERSION_CODE são injetados
  // pelo GitHub Actions via --build-arg / eas.json env no momento do build.
  // Defaults: t10plus / 0 (desativa auto-update em builds sem perfil definido)
};

export default config;
