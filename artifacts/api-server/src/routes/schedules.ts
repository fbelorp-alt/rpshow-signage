import { Router } from "express";
import { db } from "@workspace/db";
import { schedulesTable, screensTable, playlistsTable, activityTable } from "@workspace/db";
import { eq, and, isNull, inArray as drizzleInArray } from "drizzle-orm";
import {
  UpdateScheduleBody,
  UpdateScheduleParams,
  DeleteScheduleParams,
  ListSchedulesQueryParams,
  BroadcastPlaylistBody,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

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
  const activeFilter = eq(schedulesTable.active, true);
  const whereClause = and(
    activeFilter,
    userScreenFilter,
    screenIdFilter,
  );

  const baseScheduleSelect = {
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
  };

  let rows: any[];
  try {
    rows = await db
      .select({ ...baseScheduleSelect, clientName: schedulesTable.clientName, campaignGroupId: schedulesTable.campaignGroupId })
      .from(schedulesTable)
      .leftJoin(screensTable, eq(schedulesTable.screenId, screensTable.id))
      .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
      .where(whereClause)
      .orderBy(schedulesTable.createdAt);
  } catch {
    // clientName / campaignGroupId podem não existir no VPS — fallback sem elas
    rows = await db
      .select(baseScheduleSelect)
      .from(schedulesTable)
      .leftJoin(screensTable, eq(schedulesTable.screenId, screensTable.id))
      .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
      .where(whereClause)
      .orderBy(schedulesTable.createdAt);
  }

  res.json(rows.map(serializeSchedule));
});

router.post("/broadcast", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { playlistId } = BroadcastPlaylistBody.parse(req.body);
  const u = req.user as any;
  const userId = String(u.parentOperatorId ?? u.id);

  const screens = await db
    .select({ id: screensTable.id, name: screensTable.name })
    .from(screensTable)
    .where(eq(screensTable.userId, userId));

  if (screens.length === 0) { res.json({ count: 0 }); return; }

  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!playlist) { res.status(404).json({ error: "Playlist not found" }); return; }

  let count = 0;
  for (const screen of screens) {
    await db.update(screensTable).set({ defaultPlaylistId: playlistId }).where(eq(screensTable.id, screen.id));
    await db.update(schedulesTable)
      .set({ active: false })
      .where(and(
        eq(schedulesTable.screenId, screen.id),
        eq(schedulesTable.startTime, "00:00"),
        eq(schedulesTable.endTime, "23:59"),
        isNull(schedulesTable.startAt),
        isNull(schedulesTable.endAt),
      ));
    count++;
  }

  await db.insert(activityTable).values({
    userId: String(userId),
    action: "broadcast",
    entityType: "playlist",
    entityName: `${playlist.name} → ${count} tela(s)`,
    playlistId: playlist.id,
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

  await db.update(screensTable).set({ defaultPlaylistId: playlistId }).where(eq(screensTable.id, screenId));
  await db.update(schedulesTable)
    .set({ active: false })
    .where(and(
      eq(schedulesTable.screenId, screenId),
      eq(schedulesTable.startTime, "00:00"),
      eq(schedulesTable.endTime, "23:59"),
      isNull(schedulesTable.startAt),
      isNull(schedulesTable.endAt),
    ));

  await db.insert(activityTable).values({
    userId,
    action: "pushed",
    entityType: "playlist",
    entityName: `${playlist.name} → ${screen.name}`,
    screenId: screen.id,
    playlistId: playlist.id,
    screenStatus: screen.status ?? "unknown",
  });

  res.json({ ok: true, screenName: screen.name, playlistName: playlist.name });
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role = (req.user as any).role;

  const body = req.body as {
    name?: string;
    clientName?: string;
    screenId?: number;
    screenIds?: number[];
    playlistId: number;
    startAt?: string;
    endAt?: string;
    startTime?: string;
    endTime?: string;
    daysOfWeek?: string;
    active?: boolean;
    campaignGroupId?: string; // pass existing groupId when adding screens to an existing campaign
  };

  if (!body.playlistId) { res.status(400).json({ error: "playlistId é obrigatório" }); return; }

  // Resolve target screen IDs
  const targetIds: number[] = body.screenIds?.length
    ? body.screenIds
    : body.screenId
      ? [body.screenId]
      : [];

  if (targetIds.length === 0) { res.status(400).json({ error: "Informe screenId ou screenIds" }); return; }

  // Validate playlist
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, body.playlistId));
  if (!playlist) { res.status(404).json({ error: "Playlist não encontrada" }); return; }

  // Use passed-in groupId (editing existing campaign) or generate a new one for multi-screen creates
  const campaignGroupId = body.campaignGroupId ?? (targetIds.length > 1 ? randomUUID() : null);

  const commonFields = {
    name: body.name ?? null,
    clientName: body.clientName ?? null,
    campaignGroupId,
    playlistId: body.playlistId,
    startAt: body.startAt ? new Date(body.startAt) : null,
    endAt: body.endAt ? new Date(body.endAt) : null,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
    daysOfWeek: body.daysOfWeek ?? null,
    active: body.active !== undefined ? body.active : true,
  };

  const created: any[] = [];

  for (const screenId of targetIds) {
    // Validate screen ownership
    const [screen] = await db.select().from(screensTable).where(eq(screensTable.id, screenId));
    if (!screen) continue;
    if (role !== "admin" && screen.userId !== userId) continue;

    const [schedule] = await db
      .insert(schedulesTable)
      .values({ ...commonFields, screenId } as any)
      .returning();

    await db.insert(activityTable).values({
      userId: screen.userId ?? undefined,
      action: "scheduled",
      entityType: "schedule",
      entityName: `${body.name ?? playlist.name} → ${screen.name}`,
    });

    created.push(serializeSchedule({
      ...schedule,
      screenName: screen.name ?? null,
      playlistName: playlist.name ?? null,
    }));
  }

  if (created.length === 0) { res.status(400).json({ error: "Nenhuma tela válida encontrada" }); return; }

  // Return array for multi-screen, single object for backward compat
  res.status(201).json(created.length === 1 ? created[0] : created);
});

router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role   = (req.user as any).role;
  const { id } = UpdateScheduleParams.parse({ id: Number(req.params.id) });
  const body = UpdateScheduleBody.parse(req.body);

  // Load schedule to validate screen ownership
  const [existing] = await db
    .select({ id: schedulesTable.id, screenId: schedulesTable.screenId })
    .from(schedulesTable).where(eq(schedulesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  if (role !== "admin") {
    const [screen] = await db.select({ userId: screensTable.userId })
      .from(screensTable).where(eq(screensTable.id, existing.screenId)).limit(1);
    if (!screen || screen.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
  }

  const updateData: Record<string, unknown> = { ...body };
  if (body.startAt !== undefined) updateData.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) updateData.endAt = body.endAt ? new Date(body.endAt) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [schedule] = await db.update(schedulesTable).set(updateData as any).where(eq(schedulesTable.id, id)).returning();
  if (!schedule) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeSchedule({ ...schedule, screenName: null, playlistName: null }));
});

// Cleanup: delete inactive (phantom) schedules + true duplicates (same screen+time+name)
router.delete("/cleanup", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const role   = (req.user as any).role;

  const userScreens = await db
    .select({ id: screensTable.id })
    .from(screensTable)
    .where(role === "admin" ? undefined : eq(screensTable.userId, userId));
  const screenIds = userScreens.map(s => s.id);
  if (screenIds.length === 0) { res.json({ deleted: 0 }); return; }

  // 1. Delete all inactive schedules for this user's screens
  const inactiveDeleted = await db
    .delete(schedulesTable)
    .where(and(
      eq(schedulesTable.active, false),
      drizzleInArray(schedulesTable.screenId, screenIds),
    ))
    .returning({ id: schedulesTable.id });

  // 2. Find true duplicates among active: same screenId+startTime+endTime+name, keep lowest id
  const active = await db
    .select({ id: schedulesTable.id, screenId: schedulesTable.screenId, startTime: schedulesTable.startTime, endTime: schedulesTable.endTime, name: schedulesTable.name })
    .from(schedulesTable)
    .where(and(eq(schedulesTable.active, true), drizzleInArray(schedulesTable.screenId, screenIds)));

  const seen = new Map<string, number>();
  const dupIds: number[] = [];
  for (const row of active) {
    const key = `${row.screenId}|${row.startTime}|${row.endTime}|${row.name}`;
    if (seen.has(key)) {
      dupIds.push(row.id); // mark the later duplicate for deletion
    } else {
      seen.set(key, row.id);
    }
  }

  let dupDeleted = 0;
  if (dupIds.length > 0) {
    const res2 = await db.delete(schedulesTable).where(drizzleInArray(schedulesTable.id, dupIds)).returning({ id: schedulesTable.id });
    dupDeleted = res2.length;
  }

  res.json({ deleted: inactiveDeleted.length + dupDeleted, inactive: inactiveDeleted.length, duplicates: dupDeleted });
});

router.delete("/group/:groupId", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const groupId = req.params.groupId;
  if (!groupId) { res.status(400).json({ error: "Missing groupId" }); return; }
  const userId = String((req.user as any).id);
  const role   = (req.user as any).role;
  // Only delete schedules belonging to screens owned by this user
  const userScreens = await db
    .select({ id: screensTable.id })
    .from(screensTable)
    .where(role === "admin" ? undefined : eq(screensTable.userId, userId));
  const screenIds = userScreens.map(s => s.id);
  if (screenIds.length === 0) { res.status(204).send(); return; }
  const { inArray } = await import("drizzle-orm");
  await db
    .delete(schedulesTable)
    .where(and(eq(schedulesTable.campaignGroupId, groupId), inArray(schedulesTable.screenId, screenIds)));
  res.status(204).send();
});

router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = DeleteScheduleParams.parse({ id: Number(req.params.id) });
  const userId = String((req.user as any).id);
  const role   = (req.user as any).role;
  if (role === "admin") {
    await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  } else {
    const userScreens = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.userId, userId));
    const screenIds = userScreens.map(s => s.id);
    if (screenIds.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db.delete(schedulesTable).where(and(eq(schedulesTable.id, id), inArray(schedulesTable.screenId, screenIds)));
    }
  }
  res.status(204).send();
});

export default router;
