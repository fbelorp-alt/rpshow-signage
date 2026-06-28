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

router.get("/", async (req, res) => {
  const query = ListSchedulesQueryParams.parse(req.query);
  const rows = await db
    .select({
      id: schedulesTable.id,
      screenId: schedulesTable.screenId,
      screenName: screensTable.name,
      playlistId: schedulesTable.playlistId,
      playlistName: playlistsTable.name,
      startTime: schedulesTable.startTime,
      endTime: schedulesTable.endTime,
      daysOfWeek: schedulesTable.daysOfWeek,
      active: schedulesTable.active,
      createdAt: schedulesTable.createdAt,
    })
    .from(schedulesTable)
    .leftJoin(screensTable, eq(schedulesTable.screenId, screensTable.id))
    .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
    .where(query.screenId ? eq(schedulesTable.screenId, query.screenId) : undefined)
    .orderBy(schedulesTable.createdAt);

  res.json(rows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
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

  if (screens.length === 0) {
    res.json({ count: 0 });
    return;
  }

  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!playlist) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }

  let count = 0;
  for (const screen of screens) {
    const [existing] = await db
      .select()
      .from(schedulesTable)
      .where(and(eq(schedulesTable.screenId, screen.id), eq(schedulesTable.active, true)))
      .limit(1);

    if (existing) {
      await db
        .update(schedulesTable)
        .set({ playlistId, active: true })
        .where(eq(schedulesTable.id, existing.id));
    } else {
      await db
        .insert(schedulesTable)
        .values({ screenId: screen.id, playlistId, active: true });
    }
    count++;
  }

  await db.insert(activityTable).values({
    action: "broadcast",
    entityType: "playlist",
    entityName: `${playlist.name} → ${count} tela(s)`,
  });

  res.json({ count });
});

router.post("/", async (req, res) => {
  const body = CreateScheduleBody.parse(req.body);
  const [schedule] = await db.insert(schedulesTable).values(body).returning();
  const [screen] = await db.select().from(screensTable).where(eq(screensTable.id, schedule.screenId));
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, schedule.playlistId));
  if (screen) {
    await db.insert(activityTable).values({ action: "scheduled", entityType: "schedule", entityName: `${playlist?.name ?? "?"} → ${screen.name}` });
  }
  res.status(201).json({
    ...schedule,
    screenName: screen?.name ?? null,
    playlistName: playlist?.name ?? null,
    createdAt: schedule.createdAt.toISOString(),
  });
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdateScheduleParams.parse({ id: Number(req.params.id) });
  const body = UpdateScheduleBody.parse(req.body);
  const [schedule] = await db.update(schedulesTable).set(body).where(eq(schedulesTable.id, id)).returning();
  if (!schedule) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...schedule, screenName: null, playlistName: null, createdAt: schedule.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteScheduleParams.parse({ id: Number(req.params.id) });
  await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  res.status(204).send();
});

export default router;
