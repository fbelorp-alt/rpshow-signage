import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, mediaTable, playlistsTable, activityTable, mediaPlaysTable } from "@workspace/db";
import { sql, desc, gte, eq, and, inArray } from "drizzle-orm";

const TWO_MINUTES_MS = 2 * 60 * 1000;

const router = Router();

router.get("/stats", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const twoMinutesAgo = new Date(now.getTime() - TWO_MINUTES_MS);

  const [screenCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(screensTable).where(eq(screensTable.userId, userId));
  const [onlineCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(screensTable)
    .where(and(eq(screensTable.userId, userId), sql`${screensTable.lastSeen} > ${twoMinutesAgo}`));
  const [offlineCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(screensTable)
    .where(and(eq(screensTable.userId, userId), sql`${screensTable.lastSeen} IS NOT NULL AND ${screensTable.lastSeen} <= ${twoMinutesAgo}`));
  const [neverCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(screensTable)
    .where(and(eq(screensTable.userId, userId), sql`${screensTable.lastSeen} IS NULL`));
  const [mediaCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(mediaTable).where(eq(mediaTable.userId, userId));
  const [playlistCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(playlistsTable).where(eq(playlistsTable.userId, userId));

  // Only count plays from this operator's screens
  const userScreens = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.userId, userId));
  const screenIds = userScreens.map((s) => s.id);
  let playsToday = 0;
  if (screenIds.length > 0) {
    const [playsRow] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(mediaPlaysTable)
      .where(and(gte(mediaPlaysTable.playedAt, startOfToday), inArray(mediaPlaysTable.screenId, screenIds)));
    playsToday = playsRow?.count ?? 0;
  }

  res.json({
    totalClients: 0,
    totalScreens: screenCount?.count ?? 0,
    onlineScreens: onlineCount?.count ?? 0,
    offlineScreens: offlineCount?.count ?? 0,
    neverConnected: neverCount?.count ?? 0,
    totalMedia: mediaCount?.count ?? 0,
    totalPlaylists: playlistCount?.count ?? 0,
    playsToday,
    clientsByType: [],
  });
});

router.get("/activity", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const items = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.userId, userId))
    .orderBy(desc(activityTable.createdAt))
    .limit(20);

  res.json(items.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

export default router;
