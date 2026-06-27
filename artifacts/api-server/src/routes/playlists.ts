import { Router } from "express";
import { db } from "@workspace/db";
import { playlistsTable, playlistItemsTable, mediaTable, clientsTable, activityTable } from "@workspace/db";
import { eq, sql, asc } from "drizzle-orm";
import {
  CreatePlaylistBody,
  UpdatePlaylistBody,
  UpdatePlaylistParams,
  GetPlaylistParams,
  DeletePlaylistParams,
  AddPlaylistItemBody,
  AddPlaylistItemParams,
  RemovePlaylistItemParams,
  ListPlaylistsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const query = ListPlaylistsQueryParams.parse(req.query);

  const rows = await db
    .select({
      id: playlistsTable.id,
      name: playlistsTable.name,
      clientId: playlistsTable.clientId,
      clientName: clientsTable.name,
      createdAt: playlistsTable.createdAt,
      itemCount: sql<number>`(select count(*) from playlist_items where playlist_items.playlist_id = ${playlistsTable.id})`.mapWith(Number),
      totalDurationSeconds: sql<number>`(select coalesce(sum(pi.duration_seconds), 0) from playlist_items pi where pi.playlist_id = ${playlistsTable.id})`.mapWith(Number),
    })
    .from(playlistsTable)
    .leftJoin(clientsTable, eq(playlistsTable.clientId, clientsTable.id))
    .where(query.clientId ? eq(playlistsTable.clientId, query.clientId) : undefined)
    .orderBy(playlistsTable.createdAt);

  res.json(rows.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  const body = CreatePlaylistBody.parse(req.body);
  const [playlist] = await db.insert(playlistsTable).values(body).returning();
  await db.insert(activityTable).values({ action: "created", entityType: "playlist", entityName: playlist.name });
  res.status(201).json({ ...playlist, itemCount: 0, totalDurationSeconds: 0, clientName: null, createdAt: playlist.createdAt.toISOString() });
});

router.get("/:id", async (req, res) => {
  const { id } = GetPlaylistParams.parse({ id: Number(req.params.id) });
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, id));
  if (!playlist) return res.status(404).json({ error: "Not found" });

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
  if (!playlist) return res.status(404).json({ error: "Not found" });
  await db.insert(activityTable).values({ action: "updated", entityType: "playlist", entityName: playlist.name });
  res.json({ ...playlist, itemCount: 0, totalDurationSeconds: 0, clientName: null, createdAt: playlist.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePlaylistParams.parse({ id: Number(req.params.id) });
  const [playlist] = await db.delete(playlistsTable).where(eq(playlistsTable.id, id)).returning();
  if (!playlist) return res.status(404).json({ error: "Not found" });
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
