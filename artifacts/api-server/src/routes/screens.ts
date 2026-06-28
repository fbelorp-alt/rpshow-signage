import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, schedulesTable, playlistsTable, activityTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  UpdateScreenBody,
  UpdateScreenParams,
  GetScreenParams,
  DeleteScreenParams,
  PairScreenBody,
} from "@workspace/api-zod";

const router = Router();

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

router.post("/pair", async (req, res) => {
  const body = PairScreenBody.parse(req.body);

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.pairingCode, body.pairingCode))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Código de pareamento inválido" });
    return;
  }

  const code = generateCode();
  const [screen] = await db
    .insert(screensTable)
    .values({ name: body.name, location: body.location, code, userId: user.id })
    .returning();

  await db.insert(activityTable).values({
    action: "paired",
    entityType: "screen",
    entityName: screen.name,
  });

  res.status(201).json({
    id: screen.id,
    name: screen.name,
    code: screen.code,
    location: screen.location ?? null,
    status: screen.status,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.get("/", async (req, res) => {
  const userId = req.isAuthenticated() ? req.user.id : undefined;

  const rows = await db
    .select({
      id: screensTable.id,
      name: screensTable.name,
      clientId: screensTable.clientId,
      code: screensTable.code,
      location: screensTable.location,
      status: screensTable.status,
      lastSeen: screensTable.lastSeen,
      createdAt: screensTable.createdAt,
    })
    .from(screensTable)
    .where(userId ? eq(screensTable.userId, userId) : undefined)
    .orderBy(screensTable.createdAt);

  const TWO_MINUTES = 2 * 60 * 1000;
  const now = Date.now();

  const result = await Promise.all(
    rows.map(async (s) => {
      const schedule = await db
        .select({ playlistName: playlistsTable.name })
        .from(schedulesTable)
        .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
        .where(and(eq(schedulesTable.screenId, s.id), eq(schedulesTable.active, true)))
        .limit(1);

      const computedStatus = s.lastSeen
        ? (now - s.lastSeen.getTime() < TWO_MINUTES ? "online" : "offline")
        : "unknown";

      return {
        ...s,
        status: computedStatus,
        clientName: null,
        activePlaylistName: schedule[0]?.playlistName ?? null,
        lastSeen: s.lastSeen?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name, location } = req.body as { name: string; location?: string };
  const code = generateCode();
  const [screen] = await db
    .insert(screensTable)
    .values({ name, location, code, userId: req.user.id })
    .returning();
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
    .select()
    .from(screensTable)
    .where(eq(screensTable.id, id));

  if (!screen) { res.status(404).json({ error: "Not found" }); return; }

  const schedule = await db
    .select({ playlistName: playlistsTable.name })
    .from(schedulesTable)
    .leftJoin(playlistsTable, eq(schedulesTable.playlistId, playlistsTable.id))
    .where(and(eq(schedulesTable.screenId, id), eq(schedulesTable.active, true)))
    .limit(1);

  res.json({
    ...screen,
    clientName: null,
    activePlaylistName: schedule[0]?.playlistName ?? null,
    lastSeen: screen.lastSeen?.toISOString() ?? null,
    createdAt: screen.createdAt.toISOString(),
  });
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdateScreenParams.parse({ id: Number(req.params.id) });
  const body = UpdateScreenBody.parse(req.body);
  const [screen] = await db.update(screensTable).set(body).where(eq(screensTable.id, id)).returning();
  if (!screen) { res.status(404).json({ error: "Not found" }); return; }
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
  if (!screen) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ action: "deleted", entityType: "screen", entityName: screen.name });
  res.status(204).send();
});

export default router;
