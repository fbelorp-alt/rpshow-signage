/**
 * withWatchdogService — Foreground Service sticky que ressuscita o app em ~10s se fechar.
 *
 * O que faz:
 *  1. WatchdogService.java (START_STICKY) com notificação mínima
 *  2. Timer interno: a cada 10s verifica se o app está em foreground; se não → relança
 *  3. onTaskRemoved + onDestroy: agenda alarme exato em 10s → relança
 *  4. BootReceiver atualizado: inicia o serviço no boot também
 *  5. MainActivity.onResume: (re)inicia o serviço sempre que o app volta ao foco
 *  6. AndroidManifest: <service> + permissões FOREGROUND_SERVICE / POST_NOTIFICATIONS
 */
const { withAndroidManifest, withMainActivity, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// ─── Código Java do WatchdogService ────────────────────────────────────────
function watchdogServiceJava(pkg) {
  return `package ${pkg};

import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import java.util.List;

public class WatchdogService extends Service {
    private static final String CHANNEL_ID  = "rpshow_watchdog";
    private static final int    NOTIF_ID    = 0xAB01;
    private static final long   CHECK_MS    = 10_000L;   // verifica a cada 10s
    private static final long   RELAUNCH_MS = 10_000L;   // relança em 10s após fechar
    private static final int    ALARM_REQ   = 0xAB02;

    private final Handler        handler = new Handler(Looper.getMainLooper());
    private final Runnable       ticker  = new Runnable() {
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
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
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

    // ── helpers ──────────────────────────────────────────────────────────────

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
        long at = System.currentTimeMillis() + RELAUNCH_MS;
        if (Build.VERSION.SDK_INT >= 23)
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else
            am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "RPShow OnSign", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Player em execução");
        ch.setShowBadge(false);
        ch.enableLights(false);
        ch.enableVibration(false);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    private Notification buildNotif() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        int piFlags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent tap = launch != null
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
            @SuppressWarnings("deprecation")
            Notification.Builder b = new Notification.Builder(this)
                .setContentTitle("RPShow OnSign")
                .setContentText("Player em execução")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setPriority(Notification.PRIORITY_LOW)
                .setOngoing(true)
                .setContentIntent(tap);
            return b.build();
        }
    }
}
`;
}

// ─── BootReceiver atualizado: inicia app + serviço no boot ─────────────────
function bootReceiverJava(pkg) {
  return `package ${pkg};

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
            // Abre o app principal
            Intent launch = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(launch);
            }
            // Inicia o WatchdogService
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
}

// ─── Plugin principal ───────────────────────────────────────────────────────
function withWatchdogService(config) {

  // 1. AndroidManifest: <service> + permissões
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application[0];

    // <service android:name=".WatchdogService" stopWithTask="false" ...>
    if (!app.service) app.service = [];
    const alreadySvc = app.service.some((s) => s.$["android:name"] === ".WatchdogService");
    if (!alreadySvc) {
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

    // Permissões necessárias
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

  // 2. Arquivos Java: WatchdogService.java + BootReceiver.java (atualizado)
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
      fs.writeFileSync(path.join(javaDir, "WatchdogService.java"), watchdogServiceJava(pkg));
      fs.writeFileSync(path.join(javaDir, "BootReceiver.java"),    bootReceiverJava(pkg));
      return cfg;
    },
  ]);

  // 3. MainActivity: (re)inicia o serviço em onResume — sentinel evita duplicata
  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes("WatchdogService")) return cfg; // já injetado

    const isKotlin = cfg.modResults.language === "kt";

    if (isKotlin) {
      if (!src.includes("import android.content.Intent")) {
        src = src.replace(
          "import com.facebook.react.ReactActivity",
          "import android.content.Intent\nimport com.facebook.react.ReactActivity"
        );
      }
      const startLine = "    startService(Intent(this, WatchdogService::class.java)) // WatchdogService\n";
      if (src.includes("override fun onResume()")) {
        src = src.replace("override fun onResume() {", `override fun onResume() {\n${startLine}`);
      } else {
        const block = `\n  override fun onResume() {\n    super.onResume()\n${startLine}  }\n`;
        src = src.replace(/}\s*$/, `${block}}\n`);
      }
    } else {
      if (!src.includes("import android.content.Intent;")) {
        src = src.replace(
          "import com.facebook.react.ReactActivity;",
          "import android.content.Intent;\nimport com.facebook.react.ReactActivity;"
        );
      }
      const startLine = "    startService(new Intent(this, WatchdogService.class)); // WatchdogService\n";
      if (src.includes("public void onResume()")) {
        src = src.replace("public void onResume() {", `public void onResume() {\n${startLine}`);
      } else {
        const block = `\n  @Override\n  public void onResume() {\n    super.onResume();\n${startLine}  }\n`;
        src = src.replace(/}\s*$/, `${block}}\n`);
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withWatchdogService;
