/**
 * withWatchdogService — Foreground Service sticky (START_STICKY).
 *
 * NÃO toca em MainActivity para evitar "Conflicting overloads" no Kotlin.
 * O serviço é iniciado via BootReceiver (ver withBootReceiver.js) e se
 * mantém vivo por START_STICKY. Após instalar o APK, basta reiniciar o
 * dispositivo uma vez para ativar o watchdog.
 *
 * WatchdogService:
 *  - startForeground com notificação "RPShow OnSign / Player em execução"
 *  - Timer a cada 10s: se o app não estiver em foreground → relança
 *  - onTaskRemoved + onDestroy → AlarmManager.setExactAndAllowWhileIdle em 10s
 */
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
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

  // ── 2. WatchdogService.java + BootReceiver.java atualizado ────────────────
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

      // ── WatchdogService.java ──────────────────────────────────────────────
      const watchdogJava = `package ${pkg};

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
            startForeground(NOTIF_ID, n,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
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
        String p = getPackageName();
        for (ActivityManager.RunningAppProcessInfo info : ps) {
            if (p.equals(info.processName)
                    && info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND)
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
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, ALARM_REQ, i, flags);
        long at = System.currentTimeMillis() + CHECK_MS;
        if (Build.VERSION.SDK_INT >= 23)
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else
            am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
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
        int flags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent tap = (launch != null)
            ? PendingIntent.getActivity(this, 0, launch, flags) : null;
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
      fs.writeFileSync(path.join(javaDir, "WatchdogService.java"), watchdogJava);

      // ── BootReceiver.java: inicia app + WatchdogService no boot ──────────
      const bootJava = `package ${pkg};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Intent launch = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(launch);
            }
            Intent svc = new Intent(context, WatchdogService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        }
    }
}
`;
      fs.writeFileSync(path.join(javaDir, "BootReceiver.java"), bootJava);

      return cfg;
    },
  ]);

  return config;
}

module.exports = withWatchdogService;
