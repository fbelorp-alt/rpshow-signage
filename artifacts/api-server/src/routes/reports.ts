import { Router } from "express";
import { db } from "@workspace/db";
import { mediaPlaysTable, screensTable } from "@workspace/db";
import { sql, desc, eq, gte, and } from "drizzle-orm";

const router = Router();

router.get("/plays", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const screenCode = req.query.screenCode as string | undefined;

  const where = screenCode ? eq(mediaPlaysTable.screenCode, screenCode) : undefined;

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

router.get("/summary", async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);

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
    const dateStr = d.toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-");
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
