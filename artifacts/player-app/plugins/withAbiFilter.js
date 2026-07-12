/**
 * Force a single ABI into the Android build.
 *
 * Why: expo-build-properties `abiFilters` alone is NOT enough on recent RN —
 * prebuilt AAR .so files (hermes, reactnative, etc.) still land in the APK for
 * every ABI. ViPlex on Novastar TB1 rejects fat/multi-ABI APKs (~75MB) and/or
 * fails install. Setting `reactNativeArchitectures` + packaging excludes fixes it.
 *
 * Reads TARGET_ABI from env (eas profile): "armeabi-v7a" | "arm64-v8a"
 */
const {
  withGradleProperties,
  withAppBuildGradle,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const ALL_ABIS = ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"];

function withAbiFilter(config) {
  const targetAbi = process.env.TARGET_ABI;
  if (!targetAbi || !ALL_ABIS.includes(targetAbi)) {
    return config;
  }

  const others = ALL_ABIS.filter((a) => a !== targetAbi);

  config = withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const idx = props.findIndex(
      (p) => p.type === "property" && p.key === "reactNativeArchitectures",
    );
    const entry = {
      type: "property",
      key: "reactNativeArchitectures",
      value: targetAbi,
    };
    if (idx >= 0) props[idx] = entry;
    else props.push(entry);
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes("// rpshow-abi-filter")) {
      const excludes = others
        .map((a) => `            excludes += "lib/${a}/**"`)
        .join("\n");
      const block = `
    // rpshow-abi-filter — keep only ${targetAbi} (ViPlex/TB1/TB10)
    packaging {
        jniLibs {
${excludes}
        }
    }
    defaultConfig {
        ndk {
            abiFilters.clear()
            abiFilters.add("${targetAbi}")
        }
    }
`;
      if (gradle.includes("android {")) {
        gradle = gradle.replace("android {", `android {${block}`);
      } else {
        gradle += `\nandroid {${block}}\n`;
      }
      cfg.modResults.contents = gradle;
    }
    return cfg;
  });

  return config;
}

module.exports = createRunOncePlugin(withAbiFilter, "withAbiFilter", "1.0.0");
