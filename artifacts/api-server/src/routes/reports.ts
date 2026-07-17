import { Router } from "express";
import { db } from "@workspace/db";
import { mediaPlaysTable, screensTable, devicesTable, schedulesTable, mediaTable, screenConnectionsTable } from "@workspace/db";
import { sql, desc, eq, gte, lte, and, inArray, or, isNotNull, isNull } from "drizzle-orm";

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
  const campaignGroupId = req.query.campaignGroupId as string | undefined;
  const clientName = req.query.clientName as string | undefined;

  const conditions = [];

  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json({ items: [], total: 0 }); return; }
    conditions.push(inArray(mediaPlaysTable.screenId, screenIds));
  }

  if (screenId) conditions.push(eq(mediaPlaysTable.screenId, screenId));
  if (startDate) conditions.push(gte(mediaPlaysTable.playedAt, brtDateToUtc(startDate)));
  if (endDate) conditions.push(lte(mediaPlaysTable.playedAt, brtDateToUtc(endDate, true)));
  if (campaignGroupId) conditions.push(eq(mediaPlaysTable.campaignGroupId, campaignGroupId));
  if (clientName) conditions.push(eq(mediaPlaysTable.clientName, clientName));

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
  const campaignGroupId = req.query.campaignGroupId as string | undefined;
  const clientName = req.query.clientName as string | undefined;

  const conditions = [];

  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json({ items: [], totalPlays: 0 }); return; }
    conditions.push(inArray(mediaPlaysTable.screenId, screenIds));
  }

  if (screenId) conditions.push(eq(mediaPlaysTable.screenId, screenId));
  if (startDate) conditions.push(gte(mediaPlaysTable.playedAt, brtDateToUtc(startDate)));
  if (endDate) conditions.push(lte(mediaPlaysTable.playedAt, brtDateToUtc(endDate, true)));
  if (campaignGroupId) conditions.push(eq(mediaPlaysTable.campaignGroupId, campaignGroupId));
  if (clientName) conditions.push(eq(mediaPlaysTable.clientName, clientName));

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

// Campaigns summary: unique campaigns from schedules with play counts
router.get("/campaigns", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const screenIdFilter = req.query.screenId ? Number(req.query.screenId) : undefined;

  let scheduleWhere;
  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json([]); return; }
    scheduleWhere = inArray(schedulesTable.screenId, screenIds);
  }

  const rows = await db
    .select({
      campaignGroupId: schedulesTable.campaignGroupId,
      name: schedulesTable.name,
      clientName: schedulesTable.clientName,
      startAt: schedulesTable.startAt,
      endAt: schedulesTable.endAt,
      active: schedulesTable.active,
    })
    .from(schedulesTable)
    .where(scheduleWhere)
    .orderBy(desc(schedulesTable.createdAt));

  // De-duplicate by campaignGroupId, preserving first occurrence (most recent)
  const seen = new Set<string>();
  const campaigns: typeof rows = [];
  for (const r of rows) {
    const key = r.campaignGroupId ?? `single-${r.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      campaigns.push(r);
    }
  }

  res.json(campaigns.map(c => ({
    campaignGroupId: c.campaignGroupId,
    name: c.name,
    clientName: c.clientName,
    startAt: c.startAt ? c.startAt.toISOString() : null,
    endAt: c.endAt ? c.endAt.toISOString() : null,
    active: c.active,
  })));
});

// Clients list: unique clientNames from schedules (for filter dropdown)
router.get("/clients", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  let scheduleWhere;
  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json([]); return; }
    scheduleWhere = and(inArray(schedulesTable.screenId, screenIds), isNotNull(schedulesTable.clientName));
  } else {
    scheduleWhere = isNotNull(schedulesTable.clientName);
  }

  const rows = await db
    .selectDistinct({ clientName: schedulesTable.clientName })
    .from(schedulesTable)
    .where(scheduleWhere)
    .orderBy(schedulesTable.clientName);

  res.json(rows.map(r => r.clientName).filter(Boolean));
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

// ── Comprovante de Veiculação ──────────────────────────────────────────────
router.get("/comprovante", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const campaignGroupId = req.query.campaignGroupId as string | undefined;
  const clientNameQ    = req.query.clientName    as string | undefined;
  const startDate      = req.query.startDate     as string | undefined;
  const endDate        = req.query.endDate       as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [];

  if (role !== "admin") {
    const screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json({ campaignName: null, clientName: null, screens: [], summary: null }); return; }
    conditions.push(inArray(mediaPlaysTable.screenId, screenIds) as any);
  }

  if (campaignGroupId) conditions.push(eq(mediaPlaysTable.campaignGroupId, campaignGroupId) as any);
  if (clientNameQ)    conditions.push(eq(mediaPlaysTable.clientName,      clientNameQ)    as any);
  if (startDate)      conditions.push(gte(mediaPlaysTable.playedAt, brtDateToUtc(startDate))    as any);
  if (endDate)        conditions.push(lte(mediaPlaysTable.playedAt, brtDateToUtc(endDate, true)) as any);

  const where = conditions.length ? and(...(conditions as any)) : undefined;

  // Plays grouped by screen + media + day
  const rows = await db
    .select({
      screenName:      mediaPlaysTable.screenName,
      mediaName:       mediaPlaysTable.mediaName,
      mediaId:         mediaPlaysTable.mediaId,
      clientName:      mediaPlaysTable.clientName,
      campaignGroupId: mediaPlaysTable.campaignGroupId,
      playDate:        sql<string>`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      playCount:       sql<number>`count(*)`.mapWith(Number),
    })
    .from(mediaPlaysTable)
    .where(where)
    .groupBy(
      mediaPlaysTable.screenName, mediaPlaysTable.mediaName, mediaPlaysTable.mediaId,
      mediaPlaysTable.clientName, mediaPlaysTable.campaignGroupId,
      sql`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`,
    )
    .orderBy(mediaPlaysTable.screenName, mediaPlaysTable.mediaName,
      sql`to_char(played_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`);

  if (rows.length === 0) {
    res.json({ campaignName: null, clientName: null, screens: [], summary: null }); return;
  }

  // Media URLs via mediaId
  const mediaIds = [...new Set(rows.map(r => r.mediaId).filter((id): id is number => id != null))];
  const mediaRows = mediaIds.length > 0
    ? await db.select({ id: mediaTable.id, url: mediaTable.url }).from(mediaTable).where(inArray(mediaTable.id, mediaIds))
    : [];
  const urlById = new Map(mediaRows.map(m => [m.id, m.url ?? ""]));

  // Campaign metadata from schedules
  let campaignName: string | null = null;
  let resolvedClient = clientNameQ ?? (rows[0]?.clientName ?? null);
  if (campaignGroupId) {
    const [s] = await db.select({ name: schedulesTable.name, clientName: schedulesTable.clientName })
      .from(schedulesTable).where(eq(schedulesTable.campaignGroupId, campaignGroupId)).limit(1);
    if (s) { campaignName = s.name ?? null; resolvedClient = s.clientName ?? resolvedClient; }
  }

  // Build structure: screenName → mediaName → days[]
  type DayEntry = { playDate: string; playCount: number };
  type MediaEntry = { mediaName: string; mediaId: number | null; days: DayEntry[] };
  const screenMap = new Map<string, Map<string, MediaEntry>>();
  for (const r of rows) {
    if (!screenMap.has(r.screenName)) screenMap.set(r.screenName, new Map());
    const mm = screenMap.get(r.screenName)!;
    if (!mm.has(r.mediaName)) mm.set(r.mediaName, { mediaName: r.mediaName, mediaId: r.mediaId, days: [] });
    mm.get(r.mediaName)!.days.push({ playDate: r.playDate, playCount: r.playCount });
  }

  const screens = Array.from(screenMap.entries()).map(([screenName, mm]) => {
    const medias = Array.from(mm.values()).map(m => {
      const totalPlays = m.days.reduce((s, d) => s + d.playCount, 0);
      const distinctDays = m.days.length;
      const dailyAvg = distinctDays > 0 ? Math.round(totalPlays / distinctDays) : 0;
      const sorted = [...m.days].sort((a, b) => a.playDate.localeCompare(b.playDate));
      const playsByDay: Record<string, number> = {};
      for (const d of sorted) playsByDay[d.playDate] = d.playCount;
      return {
        mediaName: m.mediaName,
        mediaUrl: m.mediaId != null ? (urlById.get(m.mediaId) ?? null) : null,
        periodStart: sorted[0]?.playDate ?? "",
        periodEnd:   sorted[sorted.length - 1]?.playDate ?? "",
        totalDays:   distinctDays,
        totalPlays,
        dailyAvg,
        playsByDay,
        insertionPct: 0, // filled below
      };
    });
    const screenTotal = medias.reduce((s, m) => s + m.totalPlays, 0);
    medias.forEach(m => { m.insertionPct = screenTotal > 0 ? Math.round((m.totalPlays / screenTotal) * 10000) / 100 : 0; });
    return { screenName, medias, totalPlays: screenTotal };
  });

  // Summary across all screens
  const sumMap = new Map<string, { totalPlays: number; totalDays: number; periodStart: string; periodEnd: string; mediaUrl: string | null }>();
  for (const sc of screens) for (const m of sc.medias) {
    const ex = sumMap.get(m.mediaName);
    if (!ex) { sumMap.set(m.mediaName, { totalPlays: m.totalPlays, totalDays: m.totalDays, periodStart: m.periodStart, periodEnd: m.periodEnd, mediaUrl: m.mediaUrl }); }
    else {
      ex.totalPlays += m.totalPlays;
      ex.totalDays = Math.max(ex.totalDays, m.totalDays);
      if (m.periodStart && (!ex.periodStart || m.periodStart < ex.periodStart)) ex.periodStart = m.periodStart;
      if (m.periodEnd   && m.periodEnd   > ex.periodEnd)  ex.periodEnd  = m.periodEnd;
    }
  }
  const summaryMedias = Array.from(sumMap.entries()).map(([mediaName, s]) => ({
    mediaName, ...s, dailyAvg: s.totalDays > 0 ? Math.round(s.totalPlays / s.totalDays) : 0,
  }));
  const totalPlays = summaryMedias.reduce((s, m) => s + m.totalPlays, 0);
  const maxDays    = summaryMedias.reduce((s, m) => Math.max(s, m.totalDays), 0);

  res.json({
    campaignName,
    clientName: resolvedClient,
    issuedAt: new Date().toISOString(),
    screens,
    summary: { medias: summaryMedias, totalPlays, totalDays: maxDays, dailyAvg: maxDays > 0 ? Math.round(totalPlays / maxDays) : 0 },
  });
});

// ── Por Player ──────────────────────────────────────────────────────────────
// Agrupa plays por tela e retorna top conteúdos + status atual de cada tela
router.get("/by-player", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;
  const startDate = req.query.startDate as string | undefined;
  const endDate   = req.query.endDate   as string | undefined;

  const conditions: any[] = [];
  let screenIds: number[] = [];
  if (role !== "admin") {
    screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json([]); return; }
    conditions.push(inArray(mediaPlaysTable.screenId, screenIds));
  }
  if (startDate) conditions.push(gte(mediaPlaysTable.playedAt, brtDateToUtc(startDate)));
  if (endDate)   conditions.push(lte(mediaPlaysTable.playedAt, brtDateToUtc(endDate, true)));
  const where = conditions.length ? and(...conditions) : undefined;

  // Plays por tela
  const screenPlays = await db
    .select({
      screenId:     mediaPlaysTable.screenId,
      screenName:   mediaPlaysTable.screenName,
      totalPlays:   sql<number>`count(*)`.mapWith(Number),
      totalSeconds: sql<number>`coalesce(sum(duration_seconds),0)`.mapWith(Number),
      distinctMedia: sql<number>`count(distinct media_name)`.mapWith(Number),
    })
    .from(mediaPlaysTable)
    .where(where)
    .groupBy(mediaPlaysTable.screenId, mediaPlaysTable.screenName)
    .orderBy(desc(sql`count(*)`));

  // Top 3 conteúdos por tela
  const topContent = await db
    .select({
      screenId:   mediaPlaysTable.screenId,
      mediaName:  mediaPlaysTable.mediaName,
      mediaType:  mediaPlaysTable.mediaType,
      playCount:  sql<number>`count(*)`.mapWith(Number),
    })
    .from(mediaPlaysTable)
    .where(where)
    .groupBy(mediaPlaysTable.screenId, mediaPlaysTable.mediaName, mediaPlaysTable.mediaType)
    .orderBy(desc(sql`count(*)`));

  const topByScreen = new Map<number, typeof topContent>();
  for (const r of topContent) {
    const sid = r.screenId ?? 0;
    if (!topByScreen.has(sid)) topByScreen.set(sid, []);
    if (topByScreen.get(sid)!.length < 3) topByScreen.get(sid)!.push(r);
  }

  // Status das telas
  const screenStatusRows = await db
    .select({ id: screensTable.id, status: screensTable.status, lastSeen: screensTable.lastSeen })
    .from(screensTable)
    .where(role !== "admin" && screenIds.length > 0 ? inArray(screensTable.id, screenIds) : undefined as any);
  const statusById = new Map(screenStatusRows.map(s => [s.id, s]));

  const result = screenPlays.map(sp => {
    const sc = statusById.get(sp.screenId ?? 0);
    return {
      screenId:     sp.screenId,
      screenName:   sp.screenName,
      totalPlays:   sp.totalPlays,
      totalSeconds: sp.totalSeconds,
      distinctMedia: sp.distinctMedia,
      status:       sc?.status ?? "unknown",
      lastSeen:     sc?.lastSeen ? sc.lastSeen.toISOString() : null,
      topContent:   (topByScreen.get(sp.screenId ?? 0) ?? []).map(c => ({ mediaName: c.mediaName, mediaType: c.mediaType, playCount: c.playCount })),
    };
  });

  res.json(result);
});

// ── Ativação dos Players ─────────────────────────────────────────────────────
// Uptime por tela usando screen_connections (connectedAt / disconnectedAt)
router.get("/activation", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role   = (req.user as any).role;
  const startDate = req.query.startDate as string | undefined;
  const endDate   = req.query.endDate   as string | undefined;

  const periodStart = startDate ? brtDateToUtc(startDate)         : new Date(Date.now() - 7 * 86400_000);
  const periodEnd   = endDate   ? brtDateToUtc(endDate, true)      : new Date();
  const periodMs    = periodEnd.getTime() - periodStart.getTime();

  let screenIds: number[] = [];
  let screenWhere: any;
  if (role !== "admin") {
    screenIds = await getOperatorScreenIds(userId);
    if (screenIds.length === 0) { res.json([]); return; }
    screenWhere = inArray(screensTable.id, screenIds);
  }

  const allScreens = await db
    .select({ id: screensTable.id, name: screensTable.name, status: screensTable.status, lastSeen: screensTable.lastSeen })
    .from(screensTable)
    .where(screenWhere);

  const allScreenIdsList = allScreens.map(s => s.id);
  if (allScreenIdsList.length === 0) { res.json([]); return; }

  // Conexões que se sobrepõem com o período
  const connWhere = and(
    inArray(screenConnectionsTable.screenId, allScreenIdsList),
    lte(screenConnectionsTable.connectedAt, periodEnd),
    or(isNull(screenConnectionsTable.disconnectedAt), gte(screenConnectionsTable.disconnectedAt, periodStart))
  );
  const conns = await db.select().from(screenConnectionsTable).where(connWhere);

  // Agrupa por screenId
  const connsByScreen = new Map<number, typeof conns>();
  for (const c of conns) {
    if (!connsByScreen.has(c.screenId)) connsByScreen.set(c.screenId, []);
    connsByScreen.get(c.screenId)!.push(c);
  }

  const result = allScreens.map(screen => {
    const screenConns = connsByScreen.get(screen.id) ?? [];
    let onlineMs = 0;
    for (const c of screenConns) {
      const from = Math.max(c.connectedAt.getTime(), periodStart.getTime());
      const to   = c.disconnectedAt ? Math.min(c.disconnectedAt.getTime(), periodEnd.getTime()) : periodEnd.getTime();
      if (to > from) onlineMs += to - from;
    }
    const uptimePct   = periodMs > 0 ? Math.round((onlineMs / periodMs) * 1000) / 10 : 0;
    const offlineMs   = Math.max(0, periodMs - onlineMs);
    return {
      screenId:        screen.id,
      screenName:      screen.name,
      status:          screen.status,
      lastSeen:        screen.lastSeen ? screen.lastSeen.toISOString() : null,
      connectionCount: screenConns.length,
      onlineSeconds:   Math.round(onlineMs / 1000),
      offlineSeconds:  Math.round(offlineMs / 1000),
      uptimePct,
      periodSeconds:   Math.round(periodMs / 1000),
    };
  }).sort((a, b) => b.uptimePct - a.uptimePct);

  res.json(result);
});

export default router;
