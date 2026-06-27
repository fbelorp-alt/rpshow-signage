import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, clientsTable, schedulesTable, playlistsTable, activityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  CreateScreenBody,
  UpdateScreenBody,
  UpdateScreenParams,
  GetScreenParams,
  DeleteScreenParams,
  ListScreensQueryParams,
} from "@workspace/api-zod";

const router = Router();

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

router.get("/", async (req, res) => {
  const query = ListScreensQueryParams.parse(req.query);

  const rows = await db
    .select({
      id: screensTable.id,
      name: screensTable.name,
      clientId: screensTable.clientId,
      clientName: clientsTable.name,
      code: screensTable.code,
      location: screensTable.location,
      status: screensTable.status,
      lastSeen: screensTable.lastSeen,
      createdAt: screensTable.createdAt,
    })
    .from(screensTable)
    .leftJoin(clientsTable, eq(screensTable.clientId, clientsTable.id))
    .where(query.clientId ? eq(screensTable.clientId, query.clientId) : undefined)
    .orderBy(screensTable.createdAt);

  const result = await Promise.all(
    rows.map(async (s) => {
      const schedule = await db
        .select({ playlistName: playlistsTable.name })
        .from(schedulesTable)
        .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
        .where(and(eq(schedulesTable.screenId, s.id), eq(schedulesTable.active, true)))
        .limit(1);
      return {
        ...s,
        activePlaylistName: schedule[0]?.playlistName ?? null,
        lastSeen: s.lastSeen?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/", async (req, res) => {
  const body = CreateScreenBody.parse(req.body);
  const code = generateCode();
  const [screen] = await db.insert(screensTable).values({ ...body, code }).returning();
  await db.insert(activityTable).values({ action: "created", entityType: "screen", entityName: screen.name });
  res.status(201).json({
    ...screen,
    clientName: null,
    activePlaylistName: null,
    lastSeen: null,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.get("/:id", async (req, res) => {
  const { id } = GetScreenParams.parse({ id: Number(req.params.id) });
  const [screen] = await db
    .select({
      id: screensTable.id,
      name: screensTable.name,
      clientId: screensTable.clientId,
      clientName: clientsTable.name,
      code: screensTable.code,
      location: screensTable.location,
      status: screensTable.status,
      lastSeen: screensTable.lastSeen,
      createdAt: screensTable.createdAt,
    })
    .from(screensTable)
    .leftJoin(clientsTable, eq(screensTable.clientId, clientsTable.id))
    .where(eq(screensTable.id, id));

  if (!screen) return res.status(404).json({ error: "Not found" });

  const schedule = await db
    .select({ playlistName: playlistsTable.name })
    .from(schedulesTable)
    .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
    .where(and(eq(schedulesTable.screenId, id), eq(schedulesTable.active, true)))
    .limit(1);

  res.json({
    ...screen,
    activePlaylistName: schedule[0]?.playlistName ?? null,
    lastSeen: screen.lastSeen?.toISOString() ?? null,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdateScreenParams.parse({ id: Number(req.params.id) });
  const body = UpdateScreenBody.parse(req.body);
  const [screen] = await db.update(screensTable).set(body).where(eq(screensTable.id, id)).returning();
  if (!screen) return res.status(404).json({ error: "Not found" });
  await db.insert(activityTable).values({ action: "updated", entityType: "screen", entityName: screen.name });
  res.json({
    ...screen,
    clientName: null,
    activePlaylistName: null,
    lastSeen: screen.lastSeen?.toISOString() ?? null,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteScreenParams.parse({ id: Number(req.params.id) });
  const [screen] = await db.delete(screensTable).where(eq(screensTable.id, id)).returning();
  if (!screen) return res.status(404).json({ error: "Not found" });
  await db.insert(activityTable).values({ action: "deleted", entityType: "screen", entityName: screen.name });
  res.status(204).send();
});

export default router;
