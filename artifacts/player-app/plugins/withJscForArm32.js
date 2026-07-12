/**
 * For 32-bit (armeabi-v7a) builds: force JSC and disable Hermes in Gradle.
 *
 * Why: app.config.js `jsEngine: "jsc"` alone is NOT enough on Expo 54 / RN 0.81.
 * Field crash on T10 Plus (armeabi-v7a):
 *   "Unable to load Hermes. Your application is not built correctly"
 * APK had libjsc.so but NO libhermes.so — Java still had Hermes enabled.
 *
 * This plugin sets gradle.properties hermesEnabled=false when TARGET_ABI=armeabi-v7a.
 */
const {
  withGradleProperties,
  withAppBuildGradle,
  createRunOncePlugin,
} = require("@expo/config-plugins");

function withJscForArm32(config) {
  const targetAbi = process.env.TARGET_ABI;
  if (targetAbi !== "armeabi-v7a") {
    return config;
  }

  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const setProp = (key, value) => {
      const idx = props.findIndex((p) => p.type === "property" && p.key === key);
      const entry = { type: "property", key, value };
      if (idx >= 0) props[idx] = entry;
      else props.push(entry);
    };
    setProp("hermesEnabled", "false");
    // RN / Expo sometimes read this too
    setProp("expo.jsEngine", "jsc");
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("// rpshow-jsc-arm32")) {
      return cfg;
    }
    // Ensure project ext / react block does not force hermes
    const marker = `
    // rpshow-jsc-arm32 — T10 Plus 32-bit: JSC only (no Hermes .so for v7a on RN 0.81)
    project.ext.react = [
        enableHermes: false
    ]
`;
    if (gradle.includes("android {")) {
      gradle = gradle.replace("android {", `${marker}\nandroid {`);
    } else {
      gradle = marker + "\n" + gradle;
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });

  return config;
}

module.exports = createRunOncePlugin(withJscForArm32, "withJscForArm32", "1.0.0");
