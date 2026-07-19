import { Router } from "express";
import { db, screensTable, mediaPlaysTable, devicesTable, screenConnectionsTable } from "@workspace/db";
import { eq, desc, gte, and, notInArray, isNull, lte } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { randomUUID } from "crypto";

const router = Router();

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 min

function screenStatus(lastSeen: Date | null): "online" | "offline" | "never" {
  if (!lastSeen) return "never";
  return Date.now() - lastSeen.getTime() < ONLINE_THRESHOLD_MS ? "online" : "offline";
}

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }

  const userId = String((req.user as any).id);
  const isAdmin = (req.user as any).role === "admin";

  const screens = await db.select({
    id: screensTable.id,
    name: screensTable.name,
    code: screensTable.code,
    location: screensTable.location,
    status: screensTable.status,
    lastSeen: screensTable.lastSeen,
    resolution: screensTable.resolution,
    lastScreenshot: screensTable.lastScreenshot,
  }).from(screensTable)
    .where(isAdmin ? undefined : eq(screensTable.userId, userId))
    .orderBy(screensTable.name);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // All plays in last 24h — used for lastPlay + counts
  const recentPlays = await db.select({
    screenId: mediaPlaysTable.screenId,
    mediaName: mediaPlaysTable.mediaName,
    mediaType: mediaPlaysTable.mediaType,
    durationSeconds: mediaPlaysTable.durationSeconds,
    playedAt: mediaPlaysTable.playedAt,
  }).from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, oneDayAgo))
    .orderBy(desc(mediaPlaysTable.playedAt))
    .limit(2000);

  // Per-screen: lastPlay, playsToday count, duration today
  const lastPlayByScreen = new Map<number, typeof recentPlays[0]>();
  const playsTodayByScreen = new Map<number, number>();
  const durationTodayByScreen = new Map<number, number>();

  for (const p of recentPlays) {
    if (!p.screenId) continue;
    if (p.screenId && !lastPlayByScreen.has(p.screenId)) {
      lastPlayByScreen.set(p.screenId, p);
    }
    if (p.playedAt >= todayStart) {
      playsTodayByScreen.set(p.screenId, (playsTodayByScreen.get(p.screenId) ?? 0) + 1);
      durationTodayByScreen.set(p.screenId, (durationTodayByScreen.get(p.screenId) ?? 0) + (p.durationSeconds ?? 0));
    }
  }

  // Global totals for today
  const totalPlaysToday = recentPlays.filter((p) => p.playedAt >= todayStart).length;
  const totalDurationTodaySec = recentPlays
    .filter((p) => p.playedAt >= todayStart)
    .reduce((sum, p) => sum + (p.durationSeconds ?? 0), 0);

  // Most played media today
  const mediaCounts = new Map<string, number>();
  for (const p of recentPlays) {
    if (p.playedAt >= todayStart && p.mediaName) {
      mediaCounts.set(p.mediaName, (mediaCounts.get(p.mediaName) ?? 0) + 1);
    }
  }
  let topMedia: string | null = null;
  let topMediaCount = 0;
  for (const [name, count] of mediaCounts) {
    if (count > topMediaCount) { topMedia = name; topMediaCount = count; }
  }

  const result = screens.map((s) => {
    const lp = lastPlayByScreen.get(s.id);
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      location: s.location ?? null,
      status: screenStatus(s.lastSeen),
      lastSeen: s.lastSeen?.toISOString() ?? null,
      resolution: s.resolution ?? null,
      lastScreenshot: s.lastScreenshot ?? null,
      playsToday: playsTodayByScreen.get(s.id) ?? 0,
      durationTodaySec: durationTodayByScreen.get(s.id) ?? 0,
      lastPlay: lp ? {
        mediaName: lp.mediaName,
        mediaType: lp.mediaType,
        playedAt: lp.playedAt.toISOString(),
      } : null,
    };
  });

  res.json({
    screens: result,
    summary: {
      totalScreens: screens.length,
      onlineCount: result.filter((s) => s.status === "online").length,
      offlineCount: result.filter((s) => s.status === "offline").length,
      neverCount: result.filter((s) => s.status === "never").length,
      totalPlaysToday,
      totalDurationTodayMin: Math.round(totalDurationTodaySec / 60),
      topMedia,
      topMediaCount,
    },
  });
});

// All plays today grouped by hour — for the timeline chart
router.get("/plays/today", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const user = req.user as any;
  const isAdmin = user?.role === "admin";

  const plays = await db.select({
    id: mediaPlaysTable.id,
    screenId: mediaPlaysTable.screenId,
    mediaName: mediaPlaysTable.mediaName,
    mediaType: mediaPlaysTable.mediaType,
    durationSeconds: mediaPlaysTable.durationSeconds,
    playedAt: mediaPlaysTable.playedAt,
  }).from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, todayStart))
    .orderBy(desc(mediaPlaysTable.playedAt))
    .limit(2000);

  // Filter by userId if not admin
  let screenIds: Set<number> | null = null;
  if (!isAdmin) {
    const userScreens = await db.select({ id: screensTable.id })
      .from(screensTable)
      .where(eq(screensTable.userId, user.id));
    screenIds = new Set(userScreens.map((s) => s.id));
  }

  const filtered = screenIds
    ? plays.filter((p) => p.screenId && screenIds!.has(p.screenId))
    : plays;

  // Group by hour
  const byHour: Record<number, { plays: number; durationSec: number }> = {};
  for (let h = 0; h < 24; h++) byHour[h] = { plays: 0, durationSec: 0 };

  for (const p of filtered) {
    const h = new Date(p.playedAt).getHours();
    byHour[h].plays++;
    byHour[h].durationSec += p.durationSeconds ?? 0;
  }

  const hourly = Object.entries(byHour).map(([hour, data]) => ({
    hour: Number(hour),
    label: `${String(hour).padStart(2, "0")}h`,
    plays: data.plays,
    durationMin: Math.round(data.durationSec / 60),
  }));

  res.json({ hourly, total: filtered.length, rows: filtered.slice(0, 500).map((p) => ({ ...p, playedAt: p.playedAt.toISOString() })) });
});

// Request screenshot from a specific screen (dashboard → player command)
const screenshotRequests = new Map<string, number>(); // screenCode → requestedAt timestamp

router.post("/screenshot-request/:screenCode", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const userId = String((req.user as any).id);
  const isAdmin = (req.user as any).role === "admin";
  const { screenCode } = req.params;
  const [screen] = await db.select({ id: screensTable.id, code: screensTable.code, userId: screensTable.userId })
    .from(screensTable).where(eq(screensTable.code, screenCode)).limit(1);
  if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return; }
  if (!isAdmin && screen.userId !== userId) { res.status(404).json({ error: "Tela não encontrada" }); return; }
  screenshotRequests.set(screenCode, Date.now());
  res.json({ ok: true, requested: true });
});

// Player polls this to know if a screenshot was requested
router.get("/screenshot-pending/:screenCode", async (req, res) => {
  const { screenCode } = req.params;
  const ts = screenshotRequests.get(screenCode);
  if (ts && Date.now() - ts < 60_000) {
    screenshotRequests.delete(screenCode);
    res.json({ pending: true });
  } else {
    res.json({ pending: false });
  }
});

router.get("/:id/plays", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const userId = String((req.user as any).id);
  const isAdmin = (req.user as any).role === "admin";
  const id = Number(req.params.id);
  const [screen] = await db.select({ id: screensTable.id, userId: screensTable.userId })
    .from(screensTable)
    .where(eq(screensTable.id, id))
    .limit(1);
  if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return; }
  if (!isAdmin && screen.userId !== userId) { res.status(404).json({ error: "Tela não encontrada" }); return; }

  const plays = await db.select({
    id: mediaPlaysTable.id,
    mediaName: mediaPlaysTable.mediaName,
    mediaType: mediaPlaysTable.mediaType,
    durationSeconds: mediaPlaysTable.durationSeconds,
    playedAt: mediaPlaysTable.playedAt,
  }).from(mediaPlaysTable)
    .where(eq(mediaPlaysTable.screenId, id))
    .orderBy(desc(mediaPlaysTable.playedAt))
    .limit(50);

  res.json(plays.map((p) => ({ ...p, playedAt: p.playedAt.toISOString() })));
});

router.post("/screenshot/:screenCode", async (req, res) => {
  const { screenCode } = req.params;
  const { imageBase64, contentType = "image/jpeg" } = req.body as {
    imageBase64?: string;
    contentType?: string;
  };

  if (!imageBase64) { res.status(400).json({ error: "imageBase64 obrigatório" }); return; }

  const [screen] = await db.select({ id: screensTable.id, userId: screensTable.userId })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode))
    .limit(1);
  if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return; }

  try {
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateDir) { res.status(500).json({ error: "Object storage não configurado" }); return; }

    const objectId = `screenshots/${randomUUID()}.jpg`;
    const fullPath = `${privateDir}/${objectId}`;
    const parts = fullPath.replace(/^\//, "").split("/");
    const bucketName = parts[0];
    const objectName = parts.slice(1).join("/");

    const buffer = Buffer.from(imageBase64, "base64");
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType, resumable: false });

    const screenshotPath = `/objects/${objectId}`;
    await db.update(screensTable).set({ lastScreenshot: screenshotPath }).where(eq(screensTable.id, screen.id));

    res.json({ ok: true, path: screenshotPath });
  } catch (err) {
    res.status(500).json({ error: "Falha ao salvar screenshot" });
  }
});

// GET /api/monitoring/:id/connections — last 7 days of connect/disconnect events
router.get("/:id/connections", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const userId = String((req.user as any).id);
  const isAdmin = (req.user as any).role === "admin";
  const id = Number(req.params.id);

  // Close stale open connections (screen was offline for > 5 min)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const [screen] = await db.select({ lastSeen: screensTable.lastSeen, userId: screensTable.userId })
    .from(screensTable).where(eq(screensTable.id, id)).limit(1);
  if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return; }
  if (!isAdmin && screen.userId !== userId) { res.status(404).json({ error: "Tela não encontrada" }); return; }
  if (screen?.lastSeen && screen.lastSeen < fiveMinAgo) {
    await db.update(screenConnectionsTable)
      .set({ disconnectedAt: screen.lastSeen })
      .where(and(
        eq(screenConnectionsTable.screenId, id),
        isNull(screenConnectionsTable.disconnectedAt),
      ));
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const connections = await db.select()
    .from(screenConnectionsTable)
    .where(and(
      eq(screenConnectionsTable.screenId, id),
      gte(screenConnectionsTable.connectedAt, sevenDaysAgo),
    ))
    .orderBy(desc(screenConnectionsTable.connectedAt))
    .limit(200);

  res.json(connections.map(c => ({
    id: c.id,
    connectedAt: c.connectedAt.toISOString(),
    disconnectedAt: c.disconnectedAt?.toISOString() ?? null,
    durationSec: c.disconnectedAt
      ? Math.round((c.disconnectedAt.getTime() - c.connectedAt.getTime()) / 1000)
      : null,
  })));
});

// DELETE /api/monitoring/orphan-screens — admin only
// Removes screens that have no approved device linked (orphan/test screens).
router.delete("/orphan-screens", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  if ((req.user as any).role !== "admin") { res.status(403).json({ error: "Apenas administradores" }); return; }

  // Get all screen codes that belong to an approved device
  const approvedDevices = await db
    .select({ screenCode: devicesTable.screenCode })
    .from(devicesTable)
    .where(eq(devicesTable.status, "approved"));

  const approvedCodes = approvedDevices
    .map(d => d.screenCode)
    .filter((c): c is string => !!c);

  if (approvedCodes.length === 0) {
    res.json({ deleted: 0, message: "Nenhum dispositivo aprovado encontrado — operação cancelada por segurança." });
    return;
  }

  // Find orphan screens (not linked to any approved device)
  const orphans = await db
    .select({ id: screensTable.id, name: screensTable.name })
    .from(screensTable)
    .where(notInArray(screensTable.code, approvedCodes));

  if (orphans.length === 0) {
    res.json({ deleted: 0, message: "Nenhuma tela órfã encontrada." });
    return;
  }

  // Delete orphan screens in one query (same condition used to find them)
  await db.delete(screensTable).where(notInArray(screensTable.code, approvedCodes));

  req.log.info({ count: orphans.length, names: orphans.map(s => s.name) }, "Orphan screens deleted by admin");
  res.json({ deleted: orphans.length, screens: orphans.map(s => s.name) });
});

export default router;
