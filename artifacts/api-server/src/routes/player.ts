import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, schedulesTable, mediaTable, mediaPlaysTable, emergencyAlertsTable, screenConnectionsTable } from "@workspace/db";
import { eq, and, inArray, lte, gte, or, isNull, desc } from "drizzle-orm";
import { GetPlayerPlaylistParams } from "@workspace/api-zod";
import { loadPublishedOrLiveItems } from "../lib/playlist-publish";

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
  const [screen] = await db
    .select({ id: screensTable.id, status: screensTable.status, targetBrightness: screensTable.targetBrightness })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode));
  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }
  const { resolution } = req.body as { resolution?: string };
  const update: { status: string; lastSeen: Date; resolution?: string; onlineSince?: Date; targetBrightness?: null } = {
    status: "online", lastSeen: new Date(),
  };
  // Track when screen came back online (transition from offline/unknown → online)
  const wasOffline = screen.status !== "online";
  if (wasOffline) update.onlineSince = new Date();
  if (resolution) {
    const normalized = resolution.replace(/(\d+)\.?\d*/g, (m) => String(Math.round(Number(m))));
    update.resolution = normalized;
  }
  await db.update(screensTable).set(update).where(eq(screensTable.id, screen.id));

  // Connection tracking: log connect event when transitioning offline → online
  if (wasOffline) {
    // Close any open connection that may have been left open
    await db.update(screenConnectionsTable)
      .set({ disconnectedAt: new Date() })
      .where(and(
        eq(screenConnectionsTable.screenId, screen.id),
        isNull(screenConnectionsTable.disconnectedAt),
      ));
    // Open a new connection record
    await db.insert(screenConnectionsTable).values({
      screenId: screen.id,
      connectedAt: new Date(),
    });
  }

  // Always return current brightness so player re-applies after restarts
  if (screen.targetBrightness !== null && screen.targetBrightness !== undefined) {
    res.status(200).json({ brightness: screen.targetBrightness });
  } else {
    res.status(204).send();
  }
});

router.post("/:screenCode/play", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });
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
        or(isNull(schedulesTable.endAt), gte(schedulesTable.endAt, now)),
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

  const [screen] = await db.select().from(screensTable).where(eq(screensTable.code, screenCode));
  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }

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

  const activeDateSchedules = allSchedules.filter((s) => {
    if (!s.startAt) return false;
    return s.startAt <= now && (!s.endAt || s.endAt >= now);
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

export default router;
