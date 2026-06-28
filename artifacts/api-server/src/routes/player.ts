import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, schedulesTable, playlistItemsTable, mediaTable, mediaPlaysTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { GetPlayerPlaylistParams } from "@workspace/api-zod";

const router = Router();

router.post("/:screenCode/heartbeat", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });
  const [screen] = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.code, screenCode));
  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }
  const { resolution } = req.body as { resolution?: string };
  const update: { status: string; lastSeen: Date; resolution?: string } = { status: "online", lastSeen: new Date() };
  if (resolution) update.resolution = resolution;
  await db.update(screensTable).set(update).where(eq(screensTable.id, screen.id));
  res.status(204).send();
});

router.post("/:screenCode/play", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });
  const [screen] = await db
    .select({ id: screensTable.id, name: screensTable.name })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode));

  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }

  const { mediaId, mediaName, mediaType, durationSeconds } = req.body as {
    mediaId?: number;
    mediaName: string;
    mediaType: string;
    durationSeconds?: number;
  };

  await db.insert(mediaPlaysTable).values({
    screenId: screen.id,
    screenCode,
    screenName: screen.name,
    mediaId: mediaId ?? null,
    mediaName: mediaName ?? "Desconhecido",
    mediaType: mediaType ?? "image",
    durationSeconds: durationSeconds ?? null,
  });

  res.status(204).send();
});

async function loadPlaylistItems(playlistId: number) {
  return db
    .select({
      mediaId: mediaTable.id,
      mediaUrl: mediaTable.url,
      mediaType: mediaTable.type,
      durationSeconds: playlistItemsTable.durationSeconds,
      mediaName: mediaTable.name,
      metaJson: mediaTable.metaJson,
    })
    .from(playlistItemsTable)
    .leftJoin(mediaTable, eq(playlistItemsTable.mediaId, mediaTable.id))
    .where(eq(playlistItemsTable.playlistId, playlistId))
    .orderBy(asc(playlistItemsTable.position));
}

router.get("/:screenCode", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });

  const [screen] = await db.select().from(screensTable).where(eq(screensTable.code, screenCode));
  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }

  await db.update(screensTable).set({ status: "online", lastSeen: new Date() }).where(eq(screensTable.id, screen.id));

  const now = new Date();

  // Fetch all active schedules for this screen
  const allSchedules = await db
    .select()
    .from(schedulesTable)
    .where(and(eq(schedulesTable.screenId, screen.id), eq(schedulesTable.active, true)));

  // Priority 1: date-specific schedules (startAt is set) — promos/campaigns
  const dateSchedule = allSchedules.find((s) => {
    if (!s.startAt) return false;
    const started = s.startAt <= now;
    const notEnded = !s.endAt || s.endAt >= now;
    return started && notEnded;
  });

  // Priority 2: time-of-day recurring schedules (no startAt)
  const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;
  const nowBRT = new Date(now.getTime() + BRT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const curTimeBRT = `${pad(nowBRT.getUTCHours())}:${pad(nowBRT.getUTCMinutes())}`;
  const curDayBRT = nowBRT.getUTCDay();

  const recurringSchedule = dateSchedule
    ? undefined
    : allSchedules.find((s) => {
        if (s.startAt) return false;

        if (s.daysOfWeek) {
          const allowed = s.daysOfWeek.split(",").map((d) => parseInt(d.trim(), 10));
          if (!allowed.includes(curDayBRT)) return false;
        }

        if (s.startTime && s.endTime) {
          if (curTimeBRT < s.startTime || curTimeBRT > s.endTime) return false;
        }

        return true;
      });

  const schedule = dateSchedule ?? recurringSchedule;

  // Priority 3: fallback to default playlist (24/7 content)
  if (!schedule) {
    if (!screen.defaultPlaylistId) {
      res.json({ screenId: screen.id, screenName: screen.name, items: [] });
      return;
    }
    const items = await loadPlaylistItems(screen.defaultPlaylistId);
    res.json({
      screenId: screen.id,
      screenName: screen.name,
      isDefault: true,
      items: items.map((i) => ({
        mediaId: i.mediaId ?? null,
        mediaUrl: i.mediaUrl ?? "",
        mediaType: i.mediaType ?? "image",
        durationSeconds: i.durationSeconds,
        mediaName: i.mediaName ?? "",
        metaJson: i.metaJson ?? null,
      })),
    });
    return;
  }

  const items = await loadPlaylistItems(schedule.playlistId);

  res.json({
    screenId: screen.id,
    screenName: screen.name,
    isDefault: false,
    items: items.map((i) => ({
      mediaId: i.mediaId ?? null,
      mediaUrl: i.mediaUrl ?? "",
      mediaType: i.mediaType ?? "image",
      durationSeconds: i.durationSeconds,
      mediaName: i.mediaName ?? "",
      metaJson: i.metaJson ?? null,
    })),
  });
});

export default router;
