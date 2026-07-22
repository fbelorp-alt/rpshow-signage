/**
 * withWatchdogService — Foreground Service sticky que ressuscita o app em ~10s se fechar.
 *
 * Padrão idêntico ao withAlarmWatchdog (que compila com sucesso):
 *  - withDangerousMod escreve APENAS WatchdogService.java (não toca em BootReceiver)
 *  - withMainActivity injeta startWatchdog() via método auxiliar (mesmo padrão de scheduleWatchdog)
 *  - withAndroidManifest registra <service> + permissões
 *
 * WatchdogService (START_STICKY):
 *  - Timer a cada 10s: se o app não estiver em foreground → relança
 *  - onTaskRemoved + onDestroy → alarme exato em 10s via AlarmManager
 *  - startForeground com notificação "RPShow OnSign / Player em execução"
 */
const { withAndroidManifest, withMainActivity, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withWatchdogService(config) {

  // ── 1. AndroidManifest: <service> + permissões ────────────────────────────
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application[0];

    if (!app.service) app.service = [];
    const hasSvc = app.service.some((s) => s.$["android:name"] === ".WatchdogService");
    if (!hasSvc) {
      app.service.push({
        $: {
          "android:name": ".WatchdogService",
          "android:enabled": "true",
          "android:exported": "false",
          "android:stopWithTask": "false",
          "android:foregroundServiceType": "dataSync",
        },
      });
    }

    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
    const perms = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
      "android.permission.POST_NOTIFICATIONS",
    ];
    for (const perm of perms) {
      const has = manifest["uses-permission"].some((p) => p.$["android:name"] === perm);
      if (!has) manifest["uses-permission"].push({ $: { "android:name": perm } });
    }
    return cfg;
  });

  // ── 2. WatchdogService.java ────────────────────────────────────────────────
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
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import java.util.List;

public class WatchdogService extends Service {
    private static final String CHANNEL_ID = "rpshow_watchdog";
    private static final int    NOTIF_ID   = 0xAB01;
    private static final long   CHECK_MS   = 10000L;
    private static final int    ALARM_REQ  = 0xAB02;

    private final Handler  handler = new Handler(Looper.getMainLooper());
    private final Runnable ticker  = new Runnable() {
        @Override public void run() {
            if (!isForeground()) bringToFront();
            handler.postDelayed(this, CHECK_MS);
        }
    };

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannel();
        Notification n = buildNotif();
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                startForeground(NOTIF_ID, n,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } catch (Exception e) {
                startForeground(NOTIF_ID, n);
            }
        } else {
            startForeground(NOTIF_ID, n);
        }
        handler.removeCallbacks(ticker);
        handler.postDelayed(ticker, CHECK_MS);
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent root) {
        scheduleAlarm();
        super.onTaskRemoved(root);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(ticker);
        scheduleAlarm();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent i) { return null; }

    private boolean isForeground() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am == null) return false;
        List<ActivityManager.RunningAppProcessInfo> ps = am.getRunningAppProcesses();
        if (ps == null) return false;
        String pkg = getPackageName();
        for (ActivityManager.RunningAppProcessInfo p : ps) {
            if (pkg.equals(p.processName)
                    && p.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND)
                return true;
        }
        return false;
    }

    private void bringToFront() {
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i == null) return;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        getApplicationContext().startActivity(i);
    }

    private void scheduleAlarm() {
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (am == null) return;
        Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (i == null) return;
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, ALARM_REQ, i, piFlags);
        long at = System.currentTimeMillis() + CHECK_MS;
        if (Build.VERSION.SDK_INT >= 23)
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else
            am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "RPShow OnSign", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Player em execução");
        ch.setShowBadge(false);
        ch.enableLights(false);
        ch.enableVibration(false);
        nm.createNotificationChannel(ch);
    }

    private Notification buildNotif() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        int piFlags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent tap = (launch != null)
            ? PendingIntent.getActivity(this, 0, launch, piFlags) : null;
        if (Build.VERSION.SDK_INT >= 26) {
            return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("RPShow OnSign")
                .setContentText("Player em execução")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .setContentIntent(tap)
                .build();
        } else {
            return new Notification.Builder(this)
                .setContentTitle("RPShow OnSign")
                .setContentText("Player em execução")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setPriority(Notification.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(tap)
                .build();
        }
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "WatchdogService.java"), java);
      return cfg;
    },
  ]);

  // ── 3. MainActivity: startWatchdog() — mesmo padrão do withAlarmWatchdog ──
  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("startWatchdog") || src.includes("WatchdogService")) return cfg;

    const isKotlin = cfg.modResults.language === "kt";

    if (isKotlin) {
      const imports = [
        "import android.content.Intent",
        "import android.os.Build",
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
  private fun startWatchdog() {
    val intent = Intent(this, WatchdogService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(intent)
    } else {
      startService(intent)
    }
  }
`;
      const onResumeCall = `    startWatchdog()\n`;
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
      if (!src.includes("fun startWatchdog")) {
        src = src.replace(/}\s*$/, `${method}}\n`);
      }
    } else {
      // Java
      const imports = [
        "import android.content.Intent;",
        "import android.os.Build;",
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
  private void startWatchdog() {
    Intent intent = new Intent(this, WatchdogService.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(intent);
    } else {
      startService(intent);
    }
  }
`;
      const onResumeCall = `    startWatchdog();\n`;
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
      if (!src.includes("void startWatchdog")) {
        src = src.replace(/}\s*$/, `${method}}\n`);
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withWatchdogService;
