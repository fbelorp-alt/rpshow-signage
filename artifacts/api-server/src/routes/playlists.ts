import { Router } from "express";
import { db } from "@workspace/db";
import { playlistsTable, playlistItemsTable, mediaTable, activityTable } from "@workspace/db";
import { eq, sql, asc, and } from "drizzle-orm";
import {
  UpdatePlaylistBody,
  UpdatePlaylistParams,
  GetPlaylistParams,
  DeletePlaylistParams,
  AddPlaylistItemBody,
  AddPlaylistItemParams,
  RemovePlaylistItemParams,
  ReorderPlaylistItemsBody,
  UpdatePlaylistItemBody,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  fingerprintDraft,
  parsePublishedSnapshot,
  publishPlaylist,
} from "../lib/playlist-publish";

const router = Router();

function requireUser(req: any, res: any): { id: string; role: string } | null {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return { id: String((req.user as any).id), role: String((req.user as any).role) };
}

async function assertPlaylistOwner(
  playlistId: number,
  user: { id: string; role: string },
  res: any,
): Promise<boolean> {
  const [pl] = await db.select({ id: playlistsTable.id, userId: playlistsTable.userId })
    .from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!pl) { res.status(404).json({ error: "Not found" }); return false; }
  if (user.role !== "admin" && pl.userId && pl.userId !== user.id) {
    res.status(404).json({ error: "Not found" }); // 404 to not leak existence
    return false;
  }
  return true;
}

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const rows = await db
    .select({
      id: playlistsTable.id,
      name: playlistsTable.name,
      clientId: playlistsTable.clientId,
      resolutionWidth: playlistsTable.resolutionWidth,
      resolutionHeight: playlistsTable.resolutionHeight,
      createdAt: playlistsTable.createdAt,
      itemCount: sql<number>`(select count(*) from playlist_items where playlist_items.playlist_id = "playlists"."id")`.mapWith(Number),
      totalDurationSeconds: sql<number>`(select coalesce(sum(pi.duration_seconds), 0) from playlist_items pi where pi.playlist_id = "playlists"."id")`.mapWith(Number),
      thumbnailUrl: sql<string | null>`(select m.url from playlist_items pi join media m on m.id = pi.media_id where pi.playlist_id = "playlists"."id" order by pi.position asc limit 1)`,
      screenCount: sql<number>`(select count(*) from schedules where schedules.playlist_id = "playlists"."id" and schedules.active = true)`.mapWith(Number),
      onlineScreenCount: sql<number>`(select count(*) from schedules s join screens sc on sc.id = s.screen_id where s.playlist_id = "playlists"."id" and s.active = true and sc.last_seen > now() - interval '5 minutes')`.mapWith(Number),
      screenDetails: sql<string | null>`(select json_agg(json_build_object('name', sc.name, 'code', sc.code, 'online', (sc.last_seen is not null and sc.last_seen > now() - interval '5 minutes'), 'lastSeen', sc.last_seen, 'currentMedia', (select m.name from media_plays mp join media m on m.id = mp.media_id where mp.screen_id = sc.id order by mp.played_at desc limit 1)) order by sc.name) from schedules s join screens sc on sc.id = s.screen_id where s.playlist_id = "playlists"."id" and s.active = true)`,
      publishedAt: playlistsTable.publishedAt,
    })
    .from(playlistsTable)
    .where(eq(playlistsTable.userId, userId))
    .orderBy(playlistsTable.createdAt);

  res.json(
    rows.map((p) => ({
      ...p,
      clientName: null,
      createdAt: p.createdAt.toISOString(),
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    }))
  );
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = String((req.user as any).id);
  const { name, resolutionWidth, resolutionHeight } = req.body as { name: string; resolutionWidth?: number; resolutionHeight?: number };
  const [playlist] = await db
    .insert(playlistsTable)
    .values({ name, userId, resolutionWidth: resolutionWidth ?? 1920, resolutionHeight: resolutionHeight ?? 1080 })
    .returning();
  await db.insert(activityTable).values({ userId, action: "created", entityType: "playlist", entityName: playlist.name, entityId: playlist.id, playlistId: playlist.id });
  res.status(201).json({ ...playlist, itemCount: 0, totalDurationSeconds: 0, thumbnailUrl: null, clientName: null, createdAt: playlist.createdAt.toISOString() });
});

router.get("/:id", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { id } = GetPlaylistParams.parse({ id: Number(req.params.id) });
  if (!await assertPlaylistOwner(id, user, res)) return;
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, id));
  if (!playlist) { res.status(404).json({ error: "Not found" }); return; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[];

  try {
    items = await db
      .select({
        id: playlistItemsTable.id,
        playlistId: playlistItemsTable.playlistId,
        mediaId: playlistItemsTable.mediaId,
        mediaName: mediaTable.name,
        mediaUrl: mediaTable.url,
        mediaType: mediaTable.type,
        mediaMetaJson: mediaTable.metaJson,
        position: playlistItemsTable.position,
        durationSeconds: playlistItemsTable.durationSeconds,
        objectFit: playlistItemsTable.objectFit,
        transitionType: playlistItemsTable.transitionType,
      })
      .from(playlistItemsTable)
      .leftJoin(mediaTable, eq(playlistItemsTable.mediaId, mediaTable.id))
      .where(eq(playlistItemsTable.playlistId, id))
      .orderBy(asc(playlistItemsTable.position));
  } catch {
    // Fallback: transition_type column may not exist yet on the VPS DB
    const rows = await db
      .select({
        id: playlistItemsTable.id,
        playlistId: playlistItemsTable.playlistId,
        mediaId: playlistItemsTable.mediaId,
        mediaName: mediaTable.name,
        mediaUrl: mediaTable.url,
        mediaType: mediaTable.type,
        mediaMetaJson: mediaTable.metaJson,
        position: playlistItemsTable.position,
        durationSeconds: playlistItemsTable.durationSeconds,
        objectFit: playlistItemsTable.objectFit,
      })
      .from(playlistItemsTable)
      .leftJoin(mediaTable, eq(playlistItemsTable.mediaId, mediaTable.id))
      .where(eq(playlistItemsTable.playlistId, id))
      .orderBy(asc(playlistItemsTable.position));
    items = rows.map((r) => ({ ...r, transitionType: "cut" }));
  }

  const draftFp = fingerprintDraft({
    items,
    layoutJson: playlist.layoutJson,
    transitionEffect: playlist.transitionEffect,
  });
  const snap = parsePublishedSnapshot(playlist.publishedSnapshotJson);
  const publishedFp = snap
    ? fingerprintDraft({
        items: snap.items,
        layoutJson: snap.layoutJson,
        transitionEffect: snap.transitionEffect,
      })
    : null;

  const { publishedSnapshotJson: _publishedSnapshotJson, ...playlistPublic } = playlist;

  res.json({
    ...playlistPublic,
    items,
    publishedAt: playlist.publishedAt ? playlist.publishedAt.toISOString() : null,
    hasUnpublishedChanges: !publishedFp || draftFp !== publishedFp,
  });
});

/** Publica o rascunho atual (playlist_items + layout) para as telas. */
router.post("/:id/publish", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { id } = GetPlaylistParams.parse({ id: Number(req.params.id) });
  if (!await assertPlaylistOwner(id, user, res)) return;
  const [existing] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const result = await publishPlaylist(id);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const uid = String((req.user as any).id);
  await db.insert(activityTable).values({
    userId: uid,
    action: "published",
    entityType: "playlist",
    entityName: existing.name,
  });

  res.json({
    ok: true,
    publishedAt: result.publishedAt.toISOString(),
    itemCount: result.itemCount,
    hasUnpublishedChanges: false,
  });
});

router.patch("/:id", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { id } = UpdatePlaylistParams.parse({ id: Number(req.params.id) });
  if (!await assertPlaylistOwner(id, user, res)) return;
  const body = UpdatePlaylistBody.parse(req.body);
  const [playlist] = await db.update(playlistsTable).set(body).where(eq(playlistsTable.id, id)).returning();
  if (!playlist) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ userId: user.id, action: "updated", entityType: "playlist", entityName: playlist.name, entityId: playlist.id, playlistId: playlist.id });
  res.json({ ...playlist, itemCount: 0, totalDurationSeconds: 0, thumbnailUrl: null, clientName: null, createdAt: playlist.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id } = DeletePlaylistParams.parse({ id: Number(req.params.id) });
  const userId = String((req.user as any).id);
  const isAdmin = (req.user as any).role === "admin";

  const [existing] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!isAdmin && existing.userId && existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [playlist] = await db.delete(playlistsTable).where(eq(playlistsTable.id, id)).returning();
  if (!playlist) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ userId, action: "deleted", entityType: "playlist", entityName: playlist.name, entityId: id, playlistId: id });
  res.status(204).send();
});

router.post("/:id/items", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { id } = AddPlaylistItemParams.parse({ id: Number(req.params.id) });
  if (!await assertPlaylistOwner(id, user, res)) return;
  const body = AddPlaylistItemBody.parse(req.body);

  // Confirm media belongs to same user (if mediaId provided)
  if (body.mediaId) {
    const [m] = await db.select({ userId: mediaTable.userId }).from(mediaTable).where(eq(mediaTable.id, body.mediaId));
    if (!m || (user.role !== "admin" && m.userId !== user.id)) {
      res.status(404).json({ error: "Not found" }); return;
    }
  }

  const existing = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(playlistItemsTable)
    .where(eq(playlistItemsTable.playlistId, id));
  const position = body.position ?? (existing[0]?.count ?? 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let item: any;
  try {
    const [row] = await db.insert(playlistItemsTable).values({ ...body, playlistId: id, position }).returning();
    item = row;
  } catch {
    // Fallback: transition_type column may not exist yet on the VPS DB
    const { transitionType: _t, ...bodyWithout } = body as any;
    const [row] = await db.insert(playlistItemsTable).values({ ...bodyWithout, playlistId: id, position }).returning();
    item = { ...row, transitionType: "cut" };
  }

  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, item.mediaId));
  res.status(201).json({
    ...item,
    mediaName: media?.name ?? null,
    mediaUrl: media?.url ?? null,
    mediaType: media?.type ?? null,
    mediaMetaJson: media?.metaJson ?? null,
  });
});

router.patch("/:id/items/reorder", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { id } = GetPlaylistParams.parse({ id: Number(req.params.id) });
  if (!await assertPlaylistOwner(id, user, res)) return;
  const { items } = ReorderPlaylistItemsBody.parse(req.body);

  await Promise.all(
    items.map(({ itemId, position }) =>
      db
        .update(playlistItemsTable)
        .set({ position })
        .where(eq(playlistItemsTable.id, itemId))
    )
  );

  res.json({ ok: true });
});

router.patch("/:id/items/:itemId", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { id } = GetPlaylistParams.parse({ id: Number(req.params.id) });
  if (!await assertPlaylistOwner(id, user, res)) return;
  const itemId = Number(req.params.itemId);
  const body = UpdatePlaylistItemBody.parse(req.body);

  const [updated] = await db
    .update(playlistItemsTable)
    .set(body)
    .where(eq(playlistItemsTable.id, itemId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, updated.mediaId));
  res.json({
    ...updated,
    mediaName: media?.name ?? null,
    mediaUrl: media?.url ?? null,
    mediaType: media?.type ?? null,
    mediaMetaJson: media?.metaJson ?? null,
  });
});

router.delete("/:id/items/:itemId", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { id, itemId } = RemovePlaylistItemParams.parse({
    id: Number(req.params.id),
    itemId: Number(req.params.itemId),
  });
  if (!await assertPlaylistOwner(id, user, res)) return;
  await db.delete(playlistItemsTable).where(eq(playlistItemsTable.id, itemId));
  res.status(204).send();
});

export default router;
