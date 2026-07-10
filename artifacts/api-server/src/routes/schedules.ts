import { Router } from "express";
import { db } from "@workspace/db";
import { schedulesTable, screensTable, playlistsTable, activityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateScheduleBody,
  UpdateScheduleBody,
  UpdateScheduleParams,
  DeleteScheduleParams,
  ListSchedulesQueryParams,
  BroadcastPlaylistBody,
} from "@workspace/api-zod";

const router = Router();

function serializeSchedule(s: {
  createdAt: Date;
  startAt?: Date | null;
  endAt?: Date | null;
  [k: string]: unknown;
}) {
  return {
    ...s,
    startAt: s.startAt ? s.startAt.toISOString() : null,
    endAt: s.endAt ? s.endAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;
  const query = ListSchedulesQueryParams.parse(req.query);

  const userScreenFilter = role === "admin" ? undefined : eq(screensTable.userId, userId);
  const screenIdFilter = query.screenId ? eq(schedulesTable.screenId, query.screenId) : undefined;
  const whereClause = userScreenFilter && screenIdFilter
    ? and(userScreenFilter, screenIdFilter)
    : userScreenFilter ?? screenIdFilter;

  const rows = await db
    .select({
      id: schedulesTable.id,
      name: schedulesTable.name,
      screenId: schedulesTable.screenId,
      screenName: screensTable.name,
      playlistId: schedulesTable.playlistId,
      playlistName: playlistsTable.name,
      startAt: schedulesTable.startAt,
      endAt: schedulesTable.endAt,
      startTime: schedulesTable.startTime,
      endTime: schedulesTable.endTime,
      daysOfWeek: schedulesTable.daysOfWeek,
      active: schedulesTable.active,
      createdAt: schedulesTable.createdAt,
    })
    .from(schedulesTable)
    .leftJoin(screensTable, eq(schedulesTable.screenId, screensTable.id))
    .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
    .where(whereClause)
    .orderBy(schedulesTable.createdAt);

  res.json(rows.map(serializeSchedule));
});

router.post("/broadcast", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { playlistId } = BroadcastPlaylistBody.parse(req.body);
  const userId = req.user.id;

  const screens = await db
    .select({ id: screensTable.id, name: screensTable.name })
    .from(screensTable)
    .where(eq(screensTable.userId, userId));

  if (screens.length === 0) { res.json({ count: 0 }); return; }

  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!playlist) { res.status(404).json({ error: "Playlist not found" }); return; }

  // Playlist "enviada" = default 24h; schedules são apenas agendamentos por horário
  let count = 0;
  for (const screen of screens) {
    await db.update(screensTable).set({ defaultPlaylistId: playlistId }).where(eq(screensTable.id, screen.id));
    count++;
  }

  await db.insert(activityTable).values({
    userId: String(userId),
    action: "broadcast",
    entityType: "playlist",
    entityName: `${playlist.name} → ${count} tela(s)`,
  });

  res.json({ count });
});

// Atribui playlist a uma tela específica (atualiza schedule ativo ou cria novo)
router.post("/push-screen", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { screenId, playlistId } = req.body as { screenId: number; playlistId: number };
  if (!screenId || !playlistId) { res.status(400).json({ error: "screenId e playlistId são obrigatórios" }); return; }

  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const [screen] = await db.select().from(screensTable).where(eq(screensTable.id, screenId));
  if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return; }
  if (role !== "admin" && screen.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!playlist) { res.status(404).json({ error: "Playlist não encontrada" }); return; }

  const [existing] = await db
    .select()
    .from(schedulesTable)
    .where(and(eq(schedulesTable.screenId, screenId), eq(schedulesTable.active, true)))
    .limit(1);

  // Playlist "enviada" = default 24h; não cria schedule
  await db.update(screensTable).set({ defaultPlaylistId: playlistId }).where(eq(screensTable.id, screenId));

  await db.insert(activityTable).values({
    userId,
    action: "pushed",
    entityType: "playlist",
    entityName: `${playlist.name} → ${screen.name}`,
  });

  res.json({ ok: true, screenName: screen.name, playlistName: playlist.name });
});

router.post("/", async (req, res) => {
  const body = CreateScheduleBody.parse(req.body);

  // Deactivate any existing active schedule for this screen before inserting
  await db.update(schedulesTable)
    .set({ active: false })
    .where(and(eq(schedulesTable.screenId, body.screenId), eq(schedulesTable.active, true)));

  // Convert ISO string dates to Date objects for Drizzle timestamp columns
  const insertData: Record<string, unknown> = { ...body };
  if (body.startAt) insertData.startAt = new Date(body.startAt);
  if (body.endAt) insertData.endAt = new Date(body.endAt);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedule] = await db.insert(schedulesTable).values(insertData as any).returning();
  const [screen] = await db.select().from(screensTable).where(eq(screensTable.id, schedule.screenId));
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, schedule.playlistId));

  const label = body.name ?? playlist?.name ?? "?";
  if (screen) {
    await db.insert(activityTable).values({
      userId: screen.userId ?? undefined,
      action: "scheduled",
      entityType: "schedule",
      entityName: `${label} → ${screen.name}`,
    });
  }

  res.status(201).json(serializeSchedule({
    ...schedule,
    screenName: screen?.name ?? null,
    playlistName: playlist?.name ?? null,
  }));
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdateScheduleParams.parse({ id: Number(req.params.id) });
  const body = UpdateScheduleBody.parse(req.body);

  const updateData: Record<string, unknown> = { ...body };
  if (body.startAt !== undefined) updateData.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) updateData.endAt = body.endAt ? new Date(body.endAt) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedule] = await db.update(schedulesTable).set(updateData as any).where(eq(schedulesTable.id, id)).returning();
  if (!schedule) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSchedule({ ...schedule, screenName: null, playlistName: null }));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteScheduleParams.parse({ id: Number(req.params.id) });
  await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  res.status(204).send();
});

export default router;
