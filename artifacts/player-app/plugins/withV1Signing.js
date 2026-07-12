/**
 * Force APK Signature Scheme v1 + v2 on ALL signingConfigs.
 *
 * Why: ViPlex on T10 Plus (SW 5.x) can reject v2-only APKs with
 * "25 Invalid or incorrect upgrade package".
 *
 * IMPORTANT: must target SigningConfig, NEVER BuildType.
 * A previous withDangerousMod line-parser incorrectly injected into
 * buildTypes.release and broke Gradle:
 *   Could not find method v1SigningEnabled() on BuildType
 *
 * Uses enableV1Signing/enableV2Signing (AGP 8 Property API).
 */
const { withAppBuildGradle, createRunOncePlugin } = require("@expo/config-plugins");

function withV1Signing(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("// rpshow-v1-signing")) {
      return cfg;
    }

    const block = `
    // rpshow-v1-signing — ViPlex/Taurus: JAR (v1) + APK (v2) on SigningConfig only
    signingConfigs.configureEach { sc ->
        try {
            sc.enableV1Signing.set(true)
            sc.enableV2Signing.set(true)
        } catch (Throwable ignored) {
            // Older AGP fallback
            sc.v1SigningEnabled = true
            sc.v2SigningEnabled = true
        }
    }
`;

    if (gradle.includes("android {")) {
      gradle = gradle.replace("android {", `android {${block}`);
    } else {
      gradle += `\nandroid {${block}}\n`;
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
}

module.exports = createRunOncePlugin(withV1Signing, "withV1Signing", "1.1.0");
