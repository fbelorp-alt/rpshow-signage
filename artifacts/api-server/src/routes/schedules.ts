import { Router } from "express";
import { db } from "@workspace/db";
import { schedulesTable, screensTable, playlistsTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateScheduleBody,
  UpdateScheduleBody,
  UpdateScheduleParams,
  DeleteScheduleParams,
  ListSchedulesQueryParams,
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
  if (!schedule) return res.status(404).json({ error: "Not found" });
  res.json({ ...schedule, screenName: null, playlistName: null, createdAt: schedule.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteScheduleParams.parse({ id: Number(req.params.id) });
  await db.delete(schedulesTable).where(eq(schedulesTable.id, id));
  res.status(204).send();
});

export default router;
