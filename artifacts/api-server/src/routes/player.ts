import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, schedulesTable, mediaTable, mediaPlaysTable, emergencyAlertsTable, screenConnectionsTable, brightnessSchedulesTable, apkVersionsTable, screenSpeedLogsTable } from "@workspace/db";
import { eq, and, inArray, lte, gte, or, isNull, desc, sql } from "drizzle-orm";
import { GetPlayerPlaylistParams } from "@workspace/api-zod";
import { hitRateLimit } from "../lib/rateLimit";
import { loadPublishedOrLiveItems } from "../lib/playlist-publish";
import { consumePendingApk } from "../lib/pending-apk";
import { assertPlayerAuth } from "../lib/playerAuth";

async function resolveLayoutZones(layoutJson: string | null | undefined): Promise<Record<string, { url: string; type: string }> | undefined> {
  if (!layoutJson) return undefined;
  try {
    const layout = JSON.parse(layoutJson) as { logo?: { mediaId: number }; sidebar?: { mediaId: number } };
    const zoneMap: { key: string; mediaId: number }[] = [];
    if (layout.logo?.mediaId)    zoneMap.push({ key: "logo",    mediaId: layout.logo.mediaId });
    if (layout.sidebar?.mediaId) zoneMap.push({ key: "sidebar", mediaId: layout.sidebar.mediaId });
    if (!zoneMap.length) return undefined;
    const ids = zoneMap.map((z) => z.mediaId);
    const medias = await db.select({ id: mediaTable.id, url: mediaTable.url, type: mediaTable.type })
      .from(mediaTable).where(inArray(mediaTable.id, ids));
    const byId = new Map(medias.map((m) => [m.id, m]));
    const result: Record<string, { url: string; type: string }> = {};
    for (const { key, mediaId } of zoneMap) {
      const m = byId.get(mediaId);
      if (m) result[key] = { url: m.url, type: m.type };
    }
    return Object.keys(result).length ? result : undefined;
  } catch { return undefined; }
}

const router = Router();

router.post("/:screenCode/heartbeat", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });
  const authed = await assertPlayerAuth(req, res, screenCode);
  if (!authed) return;
  const [screen] = await db
    .select({ id: screensTable.id, status: screensTable.status, targetBrightness: screensTable.targetBrightness })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode));
  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }
  const { resolution, networkSpeedMbps } = req.body as { resolution?: string; networkSpeedMbps?: number | null };
  const wasOffline = screen.status !== "online";

  // Safe base update — these columns exist since day one on every VPS
  try {
    await db.execute(
      sql`UPDATE screens SET status = 'online', last_seen = NOW()
          ${wasOffline ? sql`, online_since = NOW()` : sql``}
          ${resolution ? sql`, resolution = ${resolution.replace(/(\d+)\.?\d*/g, (m) => String(Math.round(Number(m))))}` : sql``}
          WHERE id = ${screen.id}`
    );
  } catch {
    // absolute fallback — only status + last_seen
    await db.execute(sql`UPDATE screens SET status='online', last_seen=NOW() WHERE id=${screen.id}`);
  }

  // Optional extras — fire-and-forget, non-fatal if columns/tables missing on VPS
  if (typeof networkSpeedMbps === "number" && networkSpeedMbps > 0) {
    db.execute(sql`UPDATE screens SET network_speed_mbps=${networkSpeedMbps} WHERE id=${screen.id}`).catch(() => {});
    db.execute(sql`INSERT INTO screen_speed_logs (screen_id, speed_mbps, recorded_at) VALUES (${screen.id}, ${networkSpeedMbps}, NOW())`).catch(() => {});
  }

  // Connection tracking — non-fatal
  if (wasOffline) {
    db.execute(sql`UPDATE screen_connections SET disconnected_at=NOW() WHERE screen_id=${screen.id} AND disconnected_at IS NULL`).catch(() => {});
    db.execute(sql`INSERT INTO screen_connections (screen_id, connected_at) VALUES (${screen.id}, NOW())`).catch(() => {});
  }

  // Fetch brightness schedules for this screen
  const brightnessSchedules = await db
    .select({ id: brightnessSchedulesTable.id, startTime: brightnessSchedulesTable.startTime, endTime: brightnessSchedulesTable.endTime, brightness: brightnessSchedulesTable.brightness, days: brightnessSchedulesTable.days })
    .from(brightnessSchedulesTable)
    .where(eq(brightnessSchedulesTable.screenId, screen.id));

  // Check for pending APK install (admin-triggered via dashboard)
  const installApkUrl = consumePendingApk(screen.id);

  const hasBrightness = screen.targetBrightness !== null && screen.targetBrightness !== undefined;
  const hasSchedules  = brightnessSchedules.length > 0;

  // If playerAuth provisioned a new token (legacy screen with no token), echo it
  // back so the player can persist it and authenticate on future requests.
  const provisionedToken: string | undefined = res.locals.provisionedToken;

  if (hasBrightness || hasSchedules || installApkUrl || provisionedToken) {
    res.status(200).json({
      ...(hasBrightness     ? { brightness: screen.targetBrightness }     : {}),
      ...(hasSchedules      ? { brightnessSchedules }                      : {}),
      ...(installApkUrl     ? { installApkUrl }                            : {}),
      ...(provisionedToken  ? { deviceToken: provisionedToken }            : {}),
    });
  } else {
    res.status(204).send();
  }
});

router.post("/:screenCode/play", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });
  const authed = await assertPlayerAuth(req, res, screenCode);
  if (!authed) return;
  const [screen] = await db
    .select({ id: screensTable.id, name: screensTable.name, userId: screensTable.userId })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode));

  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }

  const { mediaId, mediaName, mediaType, durationSeconds, playlistId: bodyPlaylistId } = req.body as {
    mediaId?: number;
    mediaName: string;
    mediaType: string;
    durationSeconds?: number;
    playlistId?: number;
  };

  // Auto-attach active campaign info (campaignGroupId + clientName) for proof-of-play traceability
  const now = new Date();
  const [activeSchedule] = await db
    .select({
      campaignGroupId: schedulesTable.campaignGroupId,
      clientName: schedulesTable.clientName,
      playlistId: schedulesTable.playlistId,
    })
    .from(schedulesTable)
    .where(
      and(
        eq(schedulesTable.screenId, screen.id),
        eq(schedulesTable.active, true),
        or(isNull(schedulesTable.startAt), lte(schedulesTable.startAt, now)),
        // endAt stored as midnight UTC → treat as end-of-day (+24h-1ms)
        or(isNull(schedulesTable.endAt), gte(schedulesTable.endAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))),
      )
    )
    .limit(1);

  await db.insert(mediaPlaysTable).values({
    userId: screen.userId ?? null,
    screenId: screen.id,
    screenCode,
    screenName: screen.name,
    mediaId: mediaId ?? null,
    mediaName: mediaName ?? "Desconhecido",
    mediaType: mediaType ?? "image",
    durationSeconds: durationSeconds ?? null,
    campaignGroupId: activeSchedule?.campaignGroupId ?? null,
    clientName: activeSchedule?.clientName ?? null,
    playlistId: bodyPlaylistId ?? activeSchedule?.playlistId ?? null,
  });

  // Atualiza preview da tela com a URL da mídia atual (imagens)
  const { currentMediaUrl } = req.body as { currentMediaUrl?: string };
  if (currentMediaUrl && (mediaType === "image" || mediaType === "video")) {
    await db.update(screensTable).set({ lastScreenshot: currentMediaUrl }).where(eq(screensTable.id, screen.id));
  }

  res.status(204).send();
});

async function loadPlaylistPayload(playlistId: number) {
  const loaded = await loadPublishedOrLiveItems(playlistId);
  const layoutZones = await resolveLayoutZones(loaded.layoutJson);
  return {
    layoutZones,
    transitionEffect: loaded.transitionEffect,
    publishedAt: loaded.publishedAt ? loaded.publishedAt.toISOString() : null,
    fromPublished: loaded.fromPublished,
    items: loaded.items.map((i) => ({
      mediaId: i.mediaId ?? null,
      mediaUrl: i.mediaUrl ?? "",
      mediaType: i.mediaType ?? "image",
      durationSeconds: i.durationSeconds,
      mediaName: i.mediaName ?? "",
      metaJson: i.metaJson ?? null,
      objectFit: i.objectFit ?? "contain",
    })),
  };
}

router.get("/:screenCode", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });

  const authed = await assertPlayerAuth(req, res, screenCode);
  if (!authed) return;

  const [screen] = await db.select().from(screensTable).where(eq(screensTable.code, screenCode));
  if (!screen) {
    const ip = ((req.ip ?? req.socket.remoteAddress ?? "unknown").split(",")[0]).trim();
    if (hitRateLimit(`player-404:${ip}`, 60, 10 * 60 * 1000)) {
      res.status(429).json({ error: "Muitas requisições" }); return;
    }
    res.status(404).json({ error: "Screen not found" }); return;
  }

  // Check if this specific screen is blocked by admin
  if (screen.blocked) {
    // Still mark lastSeen so admin sees it online (but blocked)
    await db.update(screensTable).set({ lastSeen: new Date() }).where(eq(screensTable.id, screen.id));
    res.json({ blocked: true, items: [], screenName: screen.name, layoutZones: null, emergencyAlert: null });
    return;
  }

  await db.update(screensTable).set({ status: "online", lastSeen: new Date() }).where(eq(screensTable.id, screen.id));

  // Check for active emergency alert (highest priority — overrides everything)
  let emergencyAlert: { id: number; message: string; bgColor: string; textColor: string } | null = null;
  if (screen.userId) {
    const now2 = new Date();
    const alerts = await db.select().from(emergencyAlertsTable)
      .where(and(eq(emergencyAlertsTable.userId, screen.userId), eq(emergencyAlertsTable.isActive, true)));
    const active = alerts.find(a => !a.expiresAt || a.expiresAt > now2);
    if (active) {
      emergencyAlert = { id: active.id, message: active.message, bgColor: active.bgColor, textColor: active.textColor };
    }
  }

  const now = new Date();

  // Fetch all active schedules for this screen — newest first so a freshly-sent
  // playlist always wins over an older one that covers the same time window.
  const allSchedules = await db
    .select()
    .from(schedulesTable)
    .where(and(eq(schedulesTable.screenId, screen.id), eq(schedulesTable.active, true)))
    .orderBy(desc(schedulesTable.createdAt));

  // Shared time helpers (BRT = UTC-3, hardcoded — Brazil no longer has DST)
  const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
  const nowBRT = new Date(now.getTime() + BRT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const curTimeBRT = `${pad(nowBRT.getUTCHours())}:${pad(nowBRT.getUTCMinutes())}`;
  const curDayBRT = nowBRT.getUTCDay();
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const curM = toMins(curTimeBRT);
  const isInTimeWindow = (startTime: string | null, endTime: string | null): boolean => {
    if (!startTime || !endTime) return true; // no time restriction → always in window
    const startM = toMins(startTime);
    const endM   = endTime === "00:00" ? 24 * 60 : toMins(endTime);
    return curM >= startM && curM < endM;
  };

  // Priority 1a: date-specific campaign with a matching time window (most specific)
  // Priority 1b: date-specific campaign without time restriction (all-day fallback)
  // Priority 2:  recurring schedule (day-of-week + time-of-day, no startAt)
  // Priority 3:  default playlist (handled below)

  // endAt is stored as midnight UTC of the chosen day. Treat it as end-of-day
  // (add 24 h – 1 ms) so campaigns remain active throughout their whole day.
  const endOfDay = (d: Date) => new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
  const activeDateSchedules = allSchedules.filter((s) => {
    if (!s.startAt) return false;
    const effEnd = s.endAt ? endOfDay(s.endAt) : null;
    return s.startAt <= now && (!effEnd || effEnd >= now);
  });

  // Among active date schedules, prefer timed ones that match right now
  const timedDateSchedule = activeDateSchedules.find((s) =>
    s.startTime && s.endTime && isInTimeWindow(s.startTime, s.endTime)
  );
  // Fall back to an all-day date schedule (no time window set)
  const allDayDateSchedule = activeDateSchedules.find((s) => !s.startTime && !s.endTime);

  const dateSchedule = timedDateSchedule ?? allDayDateSchedule;

  // Recurring schedules only evaluated when no dateSchedule wins
  const recurringSchedule = dateSchedule
    ? undefined
    : allSchedules.find((s) => {
        if (s.startAt) return false;

        if (s.daysOfWeek) {
          const allowed = s.daysOfWeek.split(",").map((d) => parseInt(d.trim(), 10));
          if (!allowed.includes(curDayBRT)) return false;
        }

        return isInTimeWindow(s.startTime, s.endTime);
      });

  const schedule = dateSchedule ?? recurringSchedule;

  // Priority 3: fallback to default playlist (24/7 content)
  const powerOnTime  = screen.powerOnTime  ?? null;
  const powerOffTime = screen.powerOffTime ?? null;
  const powerScheduleJson = screen.powerScheduleJson ?? null;

  const timezone = screen.timezone ?? "America/Sao_Paulo";

  const panelWidth    = screen.panelWidth    ?? null;
  const panelHeight   = screen.panelHeight   ?? null;
  const panelRotation = screen.panelRotation ?? 0;

  const basePayload = { screenId: screen.id, screenName: screen.name, timezone, powerOnTime, powerOffTime, powerScheduleJson, emergencyAlert, panelWidth, panelHeight, panelRotation };

  if (!schedule) {
    if (!screen.defaultPlaylistId) {
      res.json({ ...basePayload, items: [] });
      return;
    }
    const payload = await loadPlaylistPayload(screen.defaultPlaylistId);
    res.json({
      ...basePayload,
      playlistId: screen.defaultPlaylistId,
      layoutZones: payload.layoutZones,
      transitionEffect: payload.transitionEffect,
      publishedAt: payload.publishedAt,
      isDefault: true,
      items: payload.items,
    });
    return;
  }

  const payload = await loadPlaylistPayload(schedule.playlistId);

  res.json({
    ...basePayload,
    playlistId: schedule.playlistId,
    layoutZones: payload.layoutZones,
    transitionEffect: payload.transitionEffect,
    publishedAt: payload.publishedAt,
    isDefault: false,
    items: payload.items,
  });
});

// GET /api/player/update/check?profile=t10plus&versionCode=151
router.get("/update/check", async (req, res) => {
  const profile = String(req.query["profile"] ?? "t10plus");
  const versionCode = parseInt(String(req.query["versionCode"] ?? "0"), 10);
  const [latest] = await db.select().from(apkVersionsTable)
    .where(and(eq(apkVersionsTable.profile, profile), eq(apkVersionsTable.active, true)))
    .orderBy(desc(apkVersionsTable.versionCode))
    .limit(1);
  if (!latest || latest.versionCode <= versionCode) {
    res.json({ hasUpdate: false });
    return;
  }
  res.json({ hasUpdate: true, version: latest.version, versionCode: latest.versionCode, apkUrl: latest.apkUrl });
});

export default router;
