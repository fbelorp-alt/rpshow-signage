/**
 * withAlarmWatchdog — registers a repeating AlarmManager alarm every 5 minutes.
 * The AlarmReceiver checks if the app is visible; if not, it relaunches it.
 * This covers the case where the app is killed by Android or closed by the user.
 */
const { withAndroidManifest, withMainActivity, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withAlarmWatchdog(config) {
  // 1. Register the AlarmReceiver in AndroidManifest
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    if (!app.receiver) app.receiver = [];
    const already = app.receiver.some(
      (r) => r.$["android:name"] === ".AlarmReceiver"
    );
    if (!already) {
      app.receiver.push({
        $: {
          "android:name": ".AlarmReceiver",
          "android:enabled": "true",
          "android:exported": "false",
        },
      });
    }

    // Also add FOREGROUND_SERVICE permission if not present
    const manifest = cfg.modResults.manifest;
    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
    const hasWatchdog = manifest["uses-permission"].some(
      (p) => p.$["android:name"] === "android.permission.RECEIVE_BOOT_COMPLETED"
    );
    if (!hasWatchdog) {
      manifest["uses-permission"].push({
        $: { "android:name": "android.permission.RECEIVE_BOOT_COMPLETED" },
      });
    }

    return cfg;
  });

  // 2. Write AlarmReceiver.java
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const pkg = cfg.android?.package ?? "com.rpshow.signageplayer";
      const pkgPath = pkg.replace(/\./g, "/");
      const javaDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app", "src", "main", "java", pkgPath
      );
      fs.mkdirSync(javaDir, { recursive: true });

      const java = `package ${pkg};

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.List;

public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!isAppInForeground(context, "${pkg}")) {
            Intent launch = context.getPackageManager()
                .getLaunchIntentForPackage("${pkg}");
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                context.startActivity(launch);
            }
        }
    }

    private boolean isAppInForeground(Context context, String packageName) {
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
        if (processes == null) return false;
        for (ActivityManager.RunningAppProcessInfo proc : processes) {
            if (proc.processName.equals(packageName)
                    && proc.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                return true;
            }
        }
        return false;
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "AlarmReceiver.java"), java);
      return cfg;
    },
  ]);

  // 3. Register the repeating alarm in MainActivity.onResume()
  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("AlarmManager") || src.includes("scheduleWatchdog")) return cfg;

    const isKotlin = cfg.modResults.language === "kt";
    const pkg = config.android?.package ?? "com.rpshow.signageplayer";

    if (isKotlin) {
      const imports = [
        "import android.app.AlarmManager",
        "import android.app.PendingIntent",
        "import android.content.Intent",
      ];
      for (const imp of imports) {
        if (!src.includes(imp)) {
          src = src.replace(
            "import com.facebook.react.ReactActivity",
            `${imp}\nimport com.facebook.react.ReactActivity`
          );
        }
      }
      const method = `
  private fun scheduleWatchdog() {
    val am = getSystemService(ALARM_SERVICE) as AlarmManager
    val intent = Intent(this, AlarmReceiver::class.java)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val pi = PendingIntent.getBroadcast(this, 0xD06, intent, flags)
    am.setRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 300_000L, 300_000L, pi)
  }
`;
      const onResumeCall = `    scheduleWatchdog()\n`;
      // Inject scheduleWatchdog call into existing onResume if present, or add both
      if (src.includes("override fun onResume()")) {
        src = src.replace(
          "override fun onResume() {",
          `override fun onResume() {\n${onResumeCall}`
        );
      } else {
        const onResumeOverride = `
  override fun onResume() {
    super.onResume()
${onResumeCall}  }
`;
        src = src.replace(/}\s*$/, `${method}${onResumeOverride}}\n`);
      }
      if (!src.includes("fun scheduleWatchdog")) {
        src = src.replace(/}\s*$/, `${method}}\n`);
      }
    } else {
      const imports = [
        "import android.app.AlarmManager;",
        "import android.app.PendingIntent;",
        "import android.content.Intent;",
      ];
      for (const imp of imports) {
        if (!src.includes(imp)) {
          src = src.replace(
            "import com.facebook.react.ReactActivity;",
            `${imp}\nimport com.facebook.react.ReactActivity;`
          );
        }
      }
      const method = `
  private void scheduleWatchdog() {
    AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
    Intent intent = new Intent(this, AlarmReceiver.class);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    PendingIntent pi = PendingIntent.getBroadcast(this, 0xD06, intent, flags);
    am.setRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 300000L, 300000L, pi);
  }
`;
      const onResumeCall = `    scheduleWatchdog();\n`;
      if (src.includes("public void onResume()")) {
        src = src.replace(
          "public void onResume() {",
          `public void onResume() {\n${onResumeCall}`
        );
      } else {
        const onResumeOverride = `
  @Override
  public void onResume() {
    super.onResume();
${onResumeCall}  }
`;
        src = src.replace(/}\s*$/, `${method}${onResumeOverride}}\n`);
      }
      if (!src.includes("void scheduleWatchdog")) {
        src = src.replace(/}\s*$/, `${method}}\n`);
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withAlarmWatchdog;
