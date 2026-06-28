import { Router } from "express";
import { db } from "@workspace/db";
import { playlistsTable, playlistItemsTable, mediaTable, activityTable } from "@workspace/db";
import { eq, sql, asc } from "drizzle-orm";
import {
  UpdatePlaylistBody,
  UpdatePlaylistParams,
  GetPlaylistParams,
  DeletePlaylistParams,
  AddPlaylistItemBody,
  AddPlaylistItemParams,
  RemovePlaylistItemParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const userId = req.isAuthenticated() ? req.user.id : undefined;

  const rows = await db
    .select({
      id: playlistsTable.id,
      name: playlistsTable.name,
      clientId: playlistsTable.clientId,
      createdAt: playlistsTable.createdAt,
      itemCount: sql<number>`(select count(*) from playlist_items where playlist_items.playlist_id = ${playlistsTable.id})`.mapWith(Number),
      totalDurationSeconds: sql<number>`(select coalesce(sum(pi.duration_seconds), 0) from playlist_items pi where pi.playlist_id = ${playlistsTable.id})`.mapWith(Number),
    })
    .from(playlistsTable)
    .where(userId ? eq(playlistsTable.userId, userId) : undefined)
    .orderBy(playlistsTable.createdAt);

  res.json(rows.map((p) => ({ ...p, clientName: null, createdAt: p.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name } = req.body as { name: string };
  const [playlist] = await db
    .insert(playlistsTable)
    .values({ name, userId: req.user.id })
    .returning();
  await db.insert(activityTable).values({ action: "created", entityType: "playlist", entityName: playlist.name });
  res.status(201).json({ ...playlist, itemCount: 0, totalDurationSeconds: 0, clientName: null, createdAt: playlist.createdAt.toISOString() });
});

router.get("/:id", async (req, res) => {
  const { id } = GetPlaylistParams.parse({ id: Number(req.params.id) });
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, id));
  if (!playlist) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db
    .select({
      id: playlistItemsTable.id,
      playlistId: playlistItemsTable.playlistId,
      mediaId: playlistItemsTable.mediaId,
      mediaName: mediaTable.name,
      mediaUrl: mediaTable.url,
      mediaType: mediaTable.type,
      position: playlistItemsTable.position,
      durationSeconds: playlistItemsTable.durationSeconds,
    })
    .from(playlistItemsTable)
    .leftJoin(mediaTable, eq(playlistItemsTable.mediaId, mediaTable.id))
    .where(eq(playlistItemsTable.playlistId, id))
    .orderBy(asc(playlistItemsTable.position));

  res.json({ ...playlist, items });
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdatePlaylistParams.parse({ id: Number(req.params.id) });
  const body = UpdatePlaylistBody.parse(req.body);
  const [playlist] = await db.update(playlistsTable).set(body).where(eq(playlistsTable.id, id)).returning();
  if (!playlist) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ action: "updated", entityType: "playlist", entityName: playlist.name });
  res.json({ ...playlist, itemCount: 0, totalDurationSeconds: 0, clientName: null, createdAt: playlist.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePlaylistParams.parse({ id: Number(req.params.id) });
  const [playlist] = await db.delete(playlistsTable).where(eq(playlistsTable.id, id)).returning();
  if (!playlist) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ action: "deleted", entityType: "playlist", entityName: playlist.name });
  res.status(204).send();
});

router.post("/:id/items", async (req, res) => {
  const { id } = AddPlaylistItemParams.parse({ id: Number(req.params.id) });
  const body = AddPlaylistItemBody.parse(req.body);

  const existing = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(playlistItemsTable)
    .where(eq(playlistItemsTable.playlistId, id));
  const position = body.position ?? (existing[0]?.count ?? 0);

  const [item] = await db.insert(playlistItemsTable).values({ ...body, playlistId: id, position }).returning();

  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, item.mediaId));
  res.status(201).json({
    ...item,
    mediaName: media?.name ?? null,
    mediaUrl: media?.url ?? null,
    mediaType: media?.type ?? null,
  });
});

router.delete("/:id/items/:itemId", async (req, res) => {
  const { id, itemId } = RemovePlaylistItemParams.parse({
    id: Number(req.params.id),
    itemId: Number(req.params.itemId),
  });
  await db.delete(playlistItemsTable).where(eq(playlistItemsTable.id, itemId));
  res.status(204).send();
});

export default router;
