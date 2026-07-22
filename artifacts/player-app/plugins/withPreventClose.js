/**
 * withPreventClose — prevents the Android back button from exiting the app.
 * In signage/kiosk mode, pressing back moves the app to background (not kill).
 * The WatchdogAlarm will bring it back to foreground within 5 minutes if that happens.
 */
const { withMainActivity, createRunOncePlugin } = require("@expo/config-plugins");

function withPreventClose(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("onBackPressed") || src.includes("moveTaskToBack")) return cfg;

    const isKotlin = cfg.modResults.language === "kt";

    if (isKotlin) {
      if (!src.includes("import android.view.KeyEvent")) {
        src = src.replace(
          "import com.facebook.react.ReactActivity",
          "import android.view.KeyEvent\nimport com.facebook.react.ReactActivity"
        );
      }
      const override = `
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    moveTaskToBack(true)
  }
`;
      src = src.replace(/}\s*$/, `${override}}\n`);
    } else {
      if (!src.includes("import android.view.KeyEvent")) {
        src = src.replace(
          "import com.facebook.react.ReactActivity;",
          "import android.view.KeyEvent;\nimport com.facebook.react.ReactActivity;"
        );
      }
      const override = `
  @Override
  @SuppressWarnings("deprecation")
  public void onBackPressed() {
    moveTaskToBack(true);
  }
`;
      src = src.replace(/}\s*$/, `${override}}\n`);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = createRunOncePlugin(withPreventClose, "withPreventClose", "1.0.0");
