import { Router } from "express";
import { db } from "@workspace/db";
import { mediaPlaysTable } from "@workspace/db";
import { sql, desc, eq, gte, lte, and } from "drizzle-orm";

const router = Router();

// BRT = UTC-3. Convert a "YYYY-MM-DD" date string (treated as BRT midnight) to UTC Date.
function brtDateToUtc(dateStr: string, endOfDay = false): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  // BRT midnight = UTC 03:00; BRT 23:59:59 = UTC next day 02:59:59
  const utc = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  if (endOfDay) utc.setUTCDate(utc.getUTCDate() + 1); // exclusive upper bound
  return utc;
}

router.get("/plays", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const screenId = req.query.screenId ? Number(req.query.screenId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const conditions = [];
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
  const screenId = req.query.screenId ? Number(req.query.screenId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const conditions = [];
  if (screenId) conditions.push(eq(mediaPlaysTable.screenId, screenId));
  if (startDate) conditions.push(gte(mediaPlaysTable.playedAt, brtDateToUtc(startDate)));
  if (endDate) conditions.push(lte(mediaPlaysTable.playedAt, brtDateToUtc(endDate, true)));

  const where = conditions.length ? and(...conditions) : undefined;

  // Per-media aggregation for the period
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
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
  if (startOfToday > now) startOfToday.setUTCDate(startOfToday.getUTCDate() - 1);

  const startOfWeek = new Date(startOfToday);
  const brtDay = startOfToday.getUTCDay();
  startOfWeek.setUTCDate(startOfToday.getUTCDate() - brtDay);

  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3, 0, 0));

  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setUTCDate(startOfToday.getUTCDate() - 29);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable);

  const [todayRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, startOfToday));

  const [weekRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, startOfWeek));

  const [monthRow] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, startOfMonth));

  const topMedia = await db
    .select({
      mediaName: mediaPlaysTable.mediaName,
      mediaType: mediaPlaysTable.mediaType,
      playCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(mediaPlaysTable)
    .groupBy(mediaPlaysTable.mediaName, mediaPlaysTable.mediaType)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const playsByDayRaw = await db
    .select({
      date: sql<string>`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, thirtyDaysAgo))
    .groupBy(sql`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`);

  const dateMap = new Map(playsByDayRaw.map((r) => [r.date, r.count]));
  const playsByDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
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
