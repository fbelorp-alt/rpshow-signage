// Dynamic config — allows per-profile ABI selection via TARGET_ABI env var.
// EAS profiles set TARGET_ABI to "armeabi-v7a" (TB1/T10Plus) or "arm64-v8a" (TB10).
// When TARGET_ABI is not set, no ABI filter is applied (universal build).

const targetAbi = process.env.TARGET_ABI; // "armeabi-v7a" | "arm64-v8a" | undefined
// TB50: fat ARM APK with both ABIs so ViPlex installs without issues
const targetAbis = process.env.TARGET_ABIS ? process.env.TARGET_ABIS.split(",") : null;

// For ARM32 (T10 Plus / TB1) we must disable New Architecture — it requires 64-bit.
const isArm32 = targetAbi === "armeabi-v7a";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "RPSHOW TV",
  slug: "player-app",
  owner: "rpshow-vnnox-on",
  version: "1.14.94",
  orientation: "landscape",
  icon: "./assets/images/icon.png",
  scheme: "rpshow-player",
  userInterfaceStyle: "dark",
  // Hermes funciona em armeabi-v7a (confirmado em campo: V59 OK). JSC crashava.
  jsEngine: "hermes",
  newArchEnabled: !isArm32,
  splash: {
    image: "./assets/images/icon.png",
    resizeMode: "contain",
    backgroundColor: "#0d1117",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.rpshow.signageplayer",
  },
  android: {
    package: "com.rpshow.signageplayer",
    versionCode: 112,
    usesCleartextTraffic: true,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0d1117",
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
    [
      "expo-video",
      {
        supportsBackgroundPlayback: false,
        supportsPictureInPicture: false,
      },
    ],
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
};

export default config;
