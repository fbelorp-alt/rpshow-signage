import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, mediaTable, playlistsTable, activityTable, mediaPlaysTable, schedulesTable } from "@workspace/db";
import { sql, desc, gte, eq, and, inArray, lte } from "drizzle-orm";

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

// ── Plays chart — last 30 days ─────────────────────────────────────────────────
router.get("/plays-chart", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);

  const userScreens = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.userId, userId));
  const screenIds = userScreens.map((s) => s.id);

  const days: { date: string; plays: number }[] = [];
  const now = new Date();

  // build last 30 days array (BRT = UTC-3)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    days.push({ date: `${y}-${m}-${day}`, plays: 0 });
  }

  if (screenIds.length > 0) {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 29);
    cutoff.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        day: sql<string>`to_char(${mediaPlaysTable.playedAt} AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(mediaPlaysTable)
      .where(and(gte(mediaPlaysTable.playedAt, cutoff), inArray(mediaPlaysTable.screenId, screenIds)))
      .groupBy(sql`to_char(${mediaPlaysTable.playedAt} AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`);

    const map = new Map(rows.map(r => [r.day, r.count]));
    for (const d of days) d.plays = map.get(d.date) ?? 0;
  }

  res.json(days);
});

// ── Active campaigns with play counts ─────────────────────────────────────────
router.get("/active-campaigns", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const now = new Date();

  const userScreens = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.userId, userId));
  const screenIds = userScreens.map((s) => s.id);
  if (screenIds.length === 0) { res.json([]); return; }

  // active schedules with an end date in the future
  const schedules = await db
    .select()
    .from(schedulesTable)
    .where(
      and(
        inArray(schedulesTable.screenId, screenIds),
        eq(schedulesTable.active, true),
        gte(schedulesTable.endAt, now),
      )
    )
    .orderBy(schedulesTable.endAt);

  if (schedules.length === 0) { res.json([]); return; }

  // group by campaignGroupId (or fallback to name+client)
  const groups = new Map<string, { name: string; clientName: string | null; startAt: Date | null; endAt: Date | null; screenIds: Set<number>; scheduleIds: number[] }>();

  for (const sc of schedules) {
    const key = sc.campaignGroupId ?? `${sc.name}__${sc.clientName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        name: sc.name ?? "Campanha",
        clientName: sc.clientName,
        startAt: sc.startAt,
        endAt: sc.endAt,
        screenIds: new Set(),
        scheduleIds: [],
      });
    }
    const g = groups.get(key)!;
    g.screenIds.add(sc.screenId);
    g.scheduleIds.push(sc.id);
  }

  // count plays per campaign
  const allScreenIds = Array.from(new Set(schedules.map(s => s.screenId)));
  const playsRows = await db
    .select({
      screenId: mediaPlaysTable.screenId,
      campaignGroupId: mediaPlaysTable.campaignGroupId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(mediaPlaysTable)
    .where(inArray(mediaPlaysTable.screenId, allScreenIds))
    .groupBy(mediaPlaysTable.screenId, mediaPlaysTable.campaignGroupId);

  const playsMap = new Map<string, number>();
  for (const r of playsRows) {
    const k = r.campaignGroupId ?? `screen_${r.screenId}`;
    playsMap.set(k, (playsMap.get(k) ?? 0) + r.count);
  }

  const result = Array.from(groups.entries()).slice(0, 10).map(([key, g]) => {
    const daysTotal = g.startAt && g.endAt
      ? Math.max(1, Math.round((g.endAt.getTime() - g.startAt.getTime()) / 86400000))
      : null;
    const daysLeft = g.endAt
      ? Math.max(0, Math.ceil((g.endAt.getTime() - now.getTime()) / 86400000))
      : null;
    const plays = playsMap.get(key) ?? 0;
    const pct = daysTotal && daysLeft !== null && daysTotal > 0
      ? Math.round(((daysTotal - daysLeft) / daysTotal) * 100)
      : 0;

    return {
      key,
      name: g.name,
      clientName: g.clientName,
      screenCount: g.screenIds.size,
      plays,
      daysLeft,
      pct,
      onTime: daysLeft === null || daysLeft > 0,
    };
  });

  res.json(result);
});

export default router;
