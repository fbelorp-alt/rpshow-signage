import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, screensTable, mediaTable, playlistsTable, activityTable, mediaPlaysTable } from "@workspace/db";
import { sql, desc, gte } from "drizzle-orm";

const TWO_MINUTES_MS = 2 * 60 * 1000;

const router = Router();

router.get("/stats", async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const twoMinutesAgo = new Date(now.getTime() - TWO_MINUTES_MS);

  const [clientCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(clientsTable);
  const [screenCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(screensTable);
  // Count online by lastSeen — same logic as the screens list page
  const [onlineCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(screensTable)
    .where(sql`${screensTable.lastSeen} > ${twoMinutesAgo}`);
  const [offlineCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(screensTable)
    .where(sql`${screensTable.lastSeen} IS NOT NULL AND ${screensTable.lastSeen} <= ${twoMinutesAgo}`);
  const [neverCount] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(screensTable)
    .where(sql`${screensTable.lastSeen} IS NULL`);
  const [mediaCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(mediaTable);
  const [playlistCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(playlistsTable);
  const [playsRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, startOfToday));

  const clientsByType = await db
    .select({
      type: clientsTable.type,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(clientsTable)
    .groupBy(clientsTable.type);

  res.json({
    totalClients: clientCount?.count ?? 0,
    totalScreens: screenCount?.count ?? 0,
    onlineScreens: onlineCount?.count ?? 0,
    offlineScreens: offlineCount?.count ?? 0,
    neverConnected: neverCount?.count ?? 0,
    totalMedia: mediaCount?.count ?? 0,
    totalPlaylists: playlistCount?.count ?? 0,
    playsToday: playsRow?.count ?? 0,
    clientsByType,
  });
});

router.get("/activity", async (req, res) => {
  const items = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(20);

  res.json(items.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

export default router;
