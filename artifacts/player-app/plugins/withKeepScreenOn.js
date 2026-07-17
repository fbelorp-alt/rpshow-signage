/**
 * Sets FLAG_KEEP_SCREEN_ON via MainActivity override.
 * Replaces expo-keep-awake which crashes on Taurus/NovaStar custom Android
 * before the JS engine loads (same class of issue as expo-brightness).
 *
 * Adds onResume() override that calls:
 *   getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
 */
const { withMainActivity, createRunOncePlugin } = require("@expo/config-plugins");

function withKeepScreenOn(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("FLAG_KEEP_SCREEN_ON")) return cfg;

    const isKotlin = cfg.modResults.language === "kt";

    if (isKotlin) {
      // Add import
      if (!src.includes("import android.view.WindowManager")) {
        src = src.replace(
          "import com.facebook.react.ReactActivity",
          "import android.view.WindowManager\nimport com.facebook.react.ReactActivity"
        );
      }
      // Add onResume override before last closing brace
      const override = `
  override fun onResume() {
    super.onResume()
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }
`;
      src = src.replace(/}\s*$/, `${override}}\n`);
    } else {
      // Java
      if (!src.includes("import android.view.WindowManager")) {
        src = src.replace(
          "import com.facebook.react.ReactActivity;",
          "import android.view.WindowManager;\nimport com.facebook.react.ReactActivity;"
        );
      }
      const override = `
  @Override
  public void onResume() {
    super.onResume();
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  }
`;
      src = src.replace(/}\s*$/, `${override}}\n`);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = createRunOncePlugin(withKeepScreenOn, "withKeepScreenOn", "1.0.0");
