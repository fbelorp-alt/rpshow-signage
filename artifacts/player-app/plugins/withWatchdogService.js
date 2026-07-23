/**
 * withWatchdogService v3 — AlarmReceiver em processo separado (:alarm)
 *
 * Por que o WatchdogService interno falha no Taurus TB10 Plus:
 *   O OEM mata o processo inteiro (SIGKILL). START_STICKY só funciona se o
 *   Android decide reiniciar o processo — OEMs agressivos não fazem isso.
 *
 * Solução definitiva — AlarmReceiver em processo separado:
 *   AlarmManager é um serviço do SISTEMA OPERACIONAL. O alarme fica na fila do
 *   sistema, fora do processo do app. Quando dispara, o SO cria um processo novo
 *   (:alarm) só pra rodar o onReceive(). Esse processo verifica se o processo
 *   PRINCIPAL (com.rpshow.signageplayer) está vivo; se não estiver, lança o app.
 *
 * Dupla camada de proteção:
 *   1. AlarmReceiver (:alarm) — processo externo, 10s, ressuscita o app
 *   2. WatchdogService (interno) — START_STICKY, onTaskRemoved, timer 10s
 *   3. BootReceiver — sobe tudo no boot
 */

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const path = require("path");
const fs   = require("fs");

function withWatchdogService(config) {

  // ── 1. AndroidManifest ───────────────────────────────────────────────────
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app      = manifest.application[0];

    // <service> WatchdogService
    if (!app.service) app.service = [];
    if (!app.service.some((s) => s.$["android:name"] === ".WatchdogService")) {
      app.service.push({
        $: {
          "android:name":              ".WatchdogService",
          "android:enabled":           "true",
          "android:exported":          "false",
          "android:stopWithTask":      "false",
          "android:foregroundServiceType": "dataSync",
        },
      });
    }

    // <receiver> AlarmReceiver — processo separado :alarm
    if (!app.receiver) app.receiver = [];
    if (!app.receiver.some((r) => r.$["android:name"] === ".AlarmReceiver")) {
      app.receiver.push({
        $: {
          "android:name":     ".AlarmReceiver",
          "android:enabled":  "true",
          "android:exported": "false",
          "android:process":  ":alarm",
        },
        "intent-filter": [
          { action: [{ $: { "android:name": "com.rpshow.WATCHDOG_CHECK" } }] },
        ],
      });
    }

    // <receiver> BootReceiver
    if (!app.receiver.some((r) => r.$["android:name"] === ".BootReceiver")) {
      app.receiver.push({
        $: {
          "android:name":     ".BootReceiver",
          "android:enabled":  "true",
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              { $: { "android:name": "android.intent.action.QUICKBOOT_POWERON" } },
            ],
          },
        ],
      });
    }

    // permissões
    if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
    const perms = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.RECEIVE_BOOT_COMPLETED",
    ];
    for (const perm of perms) {
      if (!manifest["uses-permission"].some((p) => p.$["android:name"] === perm))
        manifest["uses-permission"].push({ $: { "android:name": perm } });
    }

    return cfg;
  });

  // ── 2. Arquivos Java ─────────────────────────────────────────────────────
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const pkg     = cfg.android?.package ?? "com.rpshow.signageplayer";
      const pkgPath = pkg.replace(/\./g, "/");
      const javaDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app", "src", "main", "java", pkgPath
      );
      fs.mkdirSync(javaDir, { recursive: true });

      // ── AlarmReceiver.java ───────────────────────────────────────────────
      // Roda em processo separado (:alarm). O SO acorda esse processo
      // independentemente de o app principal estar vivo ou morto.
      fs.writeFileSync(path.join(javaDir, "AlarmReceiver.java"), `package ${pkg};

import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import java.util.List;

public class AlarmReceiver extends BroadcastReceiver {

    static final String ACTION   = "com.rpshow.WATCHDOG_CHECK";
    static final int    REQ_CODE = 0xAB04;
    static final long   INTERVAL = 10_000L; // 10 segundos

    @Override
    public void onReceive(Context context, Intent intent) {
        // Se processo principal não está vivo → lança o app
        if (!isMainProcessAlive(context)) {
            launchApp(context);
        }
        // Agenda o próximo alarme (cadeia perpétua)
        scheduleNext(context);
    }

    /**
     * Verifica se o processo PRINCIPAL (sem sufixo :alarm) está rodando.
     * Como este receiver roda em :alarm, podemos distinguir os dois processos
     * pelo nome exato do package (sem sufixo).
     */
    private boolean isMainProcessAlive(Context context) {
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        String mainProc = context.getPackageName(); // "com.rpshow.signageplayer" (sem sufixo)
        List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
        if (procs == null) return false;
        for (ActivityManager.RunningAppProcessInfo info : procs) {
            if (mainProc.equals(info.processName)) return true;
        }
        return false;
    }

    private void launchApp(Context context) {
        Intent launch = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launch == null) return;
        launch.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        context.startActivity(launch);
    }

    /** Agenda o próximo check via AlarmManager do sistema. */
    static void scheduleNext(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(context, AlarmReceiver.class);
        i.setAction(ACTION);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
            | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(context, REQ_CODE, i, flags);
        long triggerAt = System.currentTimeMillis() + INTERVAL;
        if (Build.VERSION.SDK_INT >= 23) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
        }
    }
}
`);

      // ── WatchdogService.java (camada interna de backup) ──────────────────
      fs.writeFileSync(path.join(javaDir, "WatchdogService.java"), `package ${pkg};

import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import java.util.List;

public class WatchdogService extends Service {
    private static final String CHANNEL_ID = "rpshow_watchdog";
    private static final int    NOTIF_ID   = 0xAB01;
    private static final long   CHECK_MS   = 10_000L;

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
        AlarmReceiver.scheduleNext(this);
        super.onTaskRemoved(root);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(ticker);
        AlarmReceiver.scheduleNext(this);
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

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "RPShow OnSign", NotificationManager.IMPORTANCE_LOW);
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
`);

      // ── BootReceiver.java ─────────────────────────────────────────────────
      fs.writeFileSync(path.join(javaDir, "BootReceiver.java"), `package ${pkg};

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
            // Lança o app
            Intent launch = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(launch);
            }
            // Inicia WatchdogService (camada interna)
            Intent svc = new Intent(context, WatchdogService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
            // Inicia cadeia de alarmes externos (camada externa :alarm)
            AlarmReceiver.scheduleNext(context);
        }
    }
}
`);

      // ── Injeta em MainApplication (Java ou Kotlin) ────────────────────────
      // Inicia WatchdogService + cadeia de alarmes na primeira abertura do app.
      const sentinel = "// RPShow-WatchdogService-v3";
      const javaApp  = path.join(javaDir, "MainApplication.java");
      const ktApp    = path.join(javaDir, "MainApplication.kt");

      if (fs.existsSync(javaApp)) {
        let src = fs.readFileSync(javaApp, "utf8");
        if (!src.includes(sentinel)) {
          const inject = [
            `    ${sentinel}`,
            `    try {`,
            `      android.content.Intent _wdSvc = new android.content.Intent(this, WatchdogService.class);`,
            `      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {`,
            `        startForegroundService(_wdSvc);`,
            `      } else {`,
            `        startService(_wdSvc);`,
            `      }`,
            `    } catch (Exception _e) {}`,
            `    try { AlarmReceiver.scheduleNext(this); } catch (Exception _e) {}`,
          ].join("\n");
          src = src.replace("super.onCreate();", `super.onCreate();\n${inject}`);
          fs.writeFileSync(javaApp, src);
        }
      } else if (fs.existsSync(ktApp)) {
        let src = fs.readFileSync(ktApp, "utf8");
        if (!src.includes(sentinel)) {
          const inject = [
            `    ${sentinel}`,
            `    try {`,
            `      val _wdSvc = android.content.Intent(this, WatchdogService::class.java)`,
            `      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {`,
            `        startForegroundService(_wdSvc)`,
            `      } else {`,
            `        startService(_wdSvc)`,
            `      }`,
            `    } catch (_e: Exception) {}`,
            `    try { AlarmReceiver.scheduleNext(this) } catch (_e: Exception) {}`,
          ].join("\n");
          src = src.replace("super.onCreate()", `super.onCreate()\n${inject}`);
          fs.writeFileSync(ktApp, src);
        }
      }

      return cfg;
    },
  ]);

  return config;
}

module.exports = withWatchdogService;
