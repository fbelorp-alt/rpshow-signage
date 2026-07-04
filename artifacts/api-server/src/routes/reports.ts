import { Router } from "express";
import { db } from "@workspace/db";
import { mediaPlaysTable, screensTable, devicesTable } from "@workspace/db";
import { sql, desc, eq, gte, lte, and, inArray, or, isNotNull } from "drizzle-orm";

const router = Router();

function brtDateToUtc(dateStr: string, endOfDay = false): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  if (endOfDay) utc.setUTCDate(utc.getUTCDate() + 1);
  return utc;
}

async function getOperatorScreenIds(userId: string): Promise<number[]> {
  const userDevices = await db
    .select({ screenCode: devicesTable.screenCode })
    .from(devicesTable)
    .where(and(eq(devicesTable.userId, userId), isNotNull(devicesTable.screenCode)));
  const deviceCodes = userDevices.map(d => d.screenCode!).filter(Boolean);

  const whereClause = deviceCodes.length > 0
    ? or(eq(screensTable.userId, userId), inArray(screensTable.code, deviceCodes))
    : eq(screensTable.userId, userId);

  const screens = await db.select({ id: screensTable.id }).from(screensTable).where(whereClause);
  return screens.map(s => s.id);
}

router.get("/plays", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const screenId = req.query.screenId ? Number(req.query.screenId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const conditions = [];

  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json({ items: [], total: 0 }); return; }
    conditions.push(inArray(mediaPlaysTable.screenId, screenIds));
  }

  if (screenId) conditions.push(eq(mediaPlaysTable.screenId, screenId));
  if (startDate) conditions.push(gte(mediaPlaysTable.playedAt, brtDateToUtc(startDate)));
  if (endDate) conditions.push(lte(mediaPlaysTable.playedAt, brtDateToUtc(endDate, true)));

  const where = conditions.length ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(where);

  const items = await db
    .select()
    .from(mediaPlaysTable)
    .where(where)
    .orderBy(desc(mediaPlaysTable.playedAt))
    .limit(limit)
    .offset(offset);

  res.json({
    items: items.map((p) => ({ ...p, playedAt: p.playedAt.toISOString() })),
    total: countRow?.total ?? 0,
  });
});

router.get("/period-summary", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const screenId = req.query.screenId ? Number(req.query.screenId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const conditions = [];

  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json({ items: [], totalPlays: 0 }); return; }
    conditions.push(inArray(mediaPlaysTable.screenId, screenIds));
  }

  if (screenId) conditions.push(eq(mediaPlaysTable.screenId, screenId));
  if (startDate) conditions.push(gte(mediaPlaysTable.playedAt, brtDateToUtc(startDate)));
  if (endDate) conditions.push(lte(mediaPlaysTable.playedAt, brtDateToUtc(endDate, true)));

  const where = conditions.length ? and(...conditions) : undefined;

  const items = await db
    .select({
      mediaName: mediaPlaysTable.mediaName,
      mediaType: mediaPlaysTable.mediaType,
      screenName: mediaPlaysTable.screenName,
      playCount: sql<number>`count(*)`.mapWith(Number),
      totalSeconds: sql<number>`sum(duration_seconds)`.mapWith(Number),
      firstPlayedAt: sql<Date>`min(played_at)`,
      lastPlayedAt: sql<Date>`max(played_at)`,
      distinctDays: sql<number>`count(distinct date_trunc('day', played_at at time zone 'America/Sao_Paulo'))`.mapWith(Number),
    })
    .from(mediaPlaysTable)
    .where(where)
    .groupBy(mediaPlaysTable.mediaName, mediaPlaysTable.mediaType, mediaPlaysTable.screenName)
    .orderBy(desc(sql`count(*)`));

  const totalPlays = items.reduce((acc, i) => acc + i.playCount, 0);

  res.json({
    items: items.map((i) => ({
      ...i,
      firstPlayedAt: i.firstPlayedAt instanceof Date ? i.firstPlayedAt.toISOString() : i.firstPlayedAt,
      lastPlayedAt: i.lastPlayedAt instanceof Date ? i.lastPlayedAt.toISOString() : i.lastPlayedAt,
    })),
    totalPlays,
  });
});

router.get("/summary", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
  if (startOfToday > now) startOfToday.setUTCDate(startOfToday.getUTCDate() - 1);
  const startOfWeek = new Date(startOfToday);
  const brtDay = startOfToday.getUTCDay();
  startOfWeek.setUTCDate(startOfToday.getUTCDate() - brtDay);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3, 0, 0));
  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setUTCDate(startOfToday.getUTCDate() - 29);

  let screenFilter: ReturnType<typeof inArray> | undefined;
  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) {
      res.json({ playsToday: 0, playsThisWeek: 0, playsThisMonth: 0, totalPlays: 0, topMedia: [], playsByDay: [] });
      return;
    }
    screenFilter = inArray(mediaPlaysTable.screenId, screenIds);
  }

  const baseWhere = screenFilter ? screenFilter : undefined;

  const [totalRow] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable).where(baseWhere);

  const [todayRow] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(baseWhere ? and(baseWhere, gte(mediaPlaysTable.playedAt, startOfToday)) : gte(mediaPlaysTable.playedAt, startOfToday));

  const [weekRow] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(baseWhere ? and(baseWhere, gte(mediaPlaysTable.playedAt, startOfWeek)) : gte(mediaPlaysTable.playedAt, startOfWeek));

  const [monthRow] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(baseWhere ? and(baseWhere, gte(mediaPlaysTable.playedAt, startOfMonth)) : gte(mediaPlaysTable.playedAt, startOfMonth));

  const topMedia = await db.select({
    mediaName: mediaPlaysTable.mediaName,
    mediaType: mediaPlaysTable.mediaType,
    playCount: sql<number>`count(*)`.mapWith(Number),
  })
    .from(mediaPlaysTable)
    .where(baseWhere)
    .groupBy(mediaPlaysTable.mediaName, mediaPlaysTable.mediaType)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const playsByDayRaw = await db.select({
    date: sql<string>`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
    count: sql<number>`count(*)`.mapWith(Number),
  })
    .from(mediaPlaysTable)
    .where(baseWhere ? and(baseWhere, gte(mediaPlaysTable.playedAt, thirtyDaysAgo)) : gte(mediaPlaysTable.playedAt, thirtyDaysAgo))
    .groupBy(sql`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`);

  const dateMap = new Map(playsByDayRaw.map((r) => [r.date, r.count]));
  const playsByDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).split("/").reverse().join("-");
    playsByDay.push({ date: dateStr, count: dateMap.get(dateStr) ?? 0 });
  }

  res.json({
    playsToday: todayRow?.count ?? 0,
    playsThisWeek: weekRow?.count ?? 0,
    playsThisMonth: monthRow?.count ?? 0,
    totalPlays: totalRow?.count ?? 0,
    topMedia,
    playsByDay,
  });
});

export default router;
