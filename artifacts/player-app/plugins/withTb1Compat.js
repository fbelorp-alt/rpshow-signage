/**
 * TB1 / T1-4G (ViPlex SW 4.6.x) — limpa o manifesto final.
 *
 * O User Software recusa APK com FOREGROUND_SERVICE_DATA_SYNC / FGS /
 * targetSdk alto como "25 Invalid or incorrect upgrade package".
 * O primeiro APK (v1.9.x, perfil tb1) instalava sem esses extras.
 */
const { withAndroidManifest, createRunOncePlugin } = require("@expo/config-plugins");

const STRIP_PERMS = new Set([
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.READ_PHONE_STATE",
  "android.permission.WRITE_SETTINGS",
  "android.permission.REQUEST_INSTALL_PACKAGES",
]);

function withTb1Compat(config) {
  if (process.env.EXPO_PUBLIC_DEVICE_PROFILE !== "tb1") return config;

  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (Array.isArray(manifest["uses-permission"])) {
      manifest["uses-permission"] = manifest["uses-permission"].filter((p) => {
        const name = p?.$?.["android:name"];
        return name && !STRIP_PERMS.has(name);
      });
    }
    const app = manifest.application?.[0];
    if (app?.service) {
      for (const svc of app.service) {
        if (svc.$) delete svc.$["android:foregroundServiceType"];
      }
    }
    return cfg;
  });
}

module.exports = createRunOncePlugin(withTb1Compat, "withTb1Compat", "1.0.0");
