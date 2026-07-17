import { Router } from "express";
import { db } from "@workspace/db";
import { playlistItemsTable, playlistsTable, mediaTable, schedulesTable, screensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

// Helper — screen IDs owned by this user
async function getUserScreenIds(userId: string): Promise<number[]> {
  const rows = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.userId, userId));
  return rows.map(r => r.id);
}

// Derive status from startAt / endAt
function itemStatus(startAt: Date | null, endAt: Date | null): "ativo" | "agendado" | "expirado" {
  const now = new Date();
  if (endAt && endAt < now) return "expirado";
  if (startAt && startAt > now) return "agendado";
  return "ativo";
}

// GET /api/publications
// Returns all playlist items from the operator's playlists, with joins to media + playlist
// Optional query params: screenId, playlistId, status (ativo|agendado|expirado)
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);

  // All playlists owned by this operator
  const playlists = await db.select().from(playlistsTable).where(eq(playlistsTable.userId, userId));
  if (playlists.length === 0) { res.json([]); return; }

  const playlistIds = playlists.map(p => p.id);

  // Optional filter: playlistId
  const filterPlaylistId = req.query.playlistId ? Number(req.query.playlistId) : null;
  const filteredPlaylistIds = filterPlaylistId ? [filterPlaylistId].filter(id => playlistIds.includes(id)) : playlistIds;

  if (filteredPlaylistIds.length === 0) { res.json([]); return; }

  // Join playlist_items → media
  const rows = await db
    .select({
      id: playlistItemsTable.id,
      playlistId: playlistItemsTable.playlistId,
      mediaId: playlistItemsTable.mediaId,
      position: playlistItemsTable.position,
      durationSeconds: playlistItemsTable.durationSeconds,
      title: playlistItemsTable.title,
      clientName: playlistItemsTable.clientName,
      startAt: playlistItemsTable.startAt,
      endAt: playlistItemsTable.endAt,
      mediaName: mediaTable.name,
      mediaUrl: mediaTable.url,
      mediaType: mediaTable.type,
      playlistName: playlistsTable.name,
    })
    .from(playlistItemsTable)
    .innerJoin(mediaTable, eq(playlistItemsTable.mediaId, mediaTable.id))
    .innerJoin(playlistsTable, eq(playlistItemsTable.playlistId, playlistsTable.id))
    .where(inArray(playlistItemsTable.playlistId, filteredPlaylistIds))
    .orderBy(playlistsTable.name, playlistItemsTable.position);

  // For each playlist, find which screens it's assigned to (via schedules)
  const schedules = await db
    .select({ playlistId: schedulesTable.playlistId, screenId: schedulesTable.screenId })
    .from(schedulesTable)
    .where(inArray(schedulesTable.playlistId, filteredPlaylistIds));

  // optional screenId filter
  const filterScreenId = req.query.screenId ? Number(req.query.screenId) : null;

  // map playlistId → screenIds
  const playlistToScreens = new Map<number, number[]>();
  for (const s of schedules) {
    if (!playlistToScreens.has(s.playlistId)) playlistToScreens.set(s.playlistId, []);
    playlistToScreens.get(s.playlistId)!.push(s.screenId);
  }

  // resolve screen names
  const allScreenIds = [...new Set(schedules.map(s => s.screenId))];
  const screens = allScreenIds.length > 0
    ? await db.select({ id: screensTable.id, name: screensTable.name }).from(screensTable).where(inArray(screensTable.id, allScreenIds))
    : [];
  const screenMap = new Map(screens.map(s => [s.id, s.name]));

  const filterStatus = req.query.status as string | undefined;

  const result = rows
    .map(row => {
      const screenIds = playlistToScreens.get(row.playlistId) ?? [];
      const screenNames = screenIds.map(id => screenMap.get(id) ?? "").filter(Boolean);
      const status = itemStatus(row.startAt, row.endAt);
      return {
        id: row.id,
        playlistId: row.playlistId,
        playlistName: row.playlistName,
        mediaId: row.mediaId,
        mediaName: row.mediaName,
        mediaUrl: row.mediaUrl,
        mediaType: row.mediaType,
        position: row.position,
        ordem: (row.position + 1) * 100,
        durationSeconds: row.durationSeconds,
        title: row.title ?? row.mediaName,
        clientName: row.clientName,
        startAt: row.startAt?.toISOString() ?? null,
        endAt: row.endAt?.toISOString() ?? null,
        status,
        screenIds,
        screenNames,
      };
    })
    .filter(row => {
      if (filterScreenId && !row.screenIds.includes(filterScreenId)) return false;
      if (filterStatus && row.status !== filterStatus) return false;
      return true;
    });

  res.json(result);
});

// PATCH /api/publications/:id — update publication metadata
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body ?? {};
  const parsed = {
    success: true,
    data: {
      title:           typeof body.title === "string"        ? body.title           : undefined,
      clientName:      body.clientName !== undefined         ? (body.clientName || null) : undefined,
      startAt:         body.startAt !== undefined            ? (body.startAt || null)    : undefined,
      endAt:           body.endAt   !== undefined            ? (body.endAt   || null)    : undefined,
      durationSeconds: typeof body.durationSeconds === "number" && body.durationSeconds > 0 ? body.durationSeconds : undefined,
    },
  };
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }

  // verify ownership via playlist
  const [item] = await db.select({ playlistId: playlistItemsTable.playlistId }).from(playlistItemsTable).where(eq(playlistItemsTable.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }

  const [pl] = await db.select({ userId: playlistsTable.userId }).from(playlistsTable).where(eq(playlistsTable.id, item.playlistId));
  if (!pl || pl.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { startAt, endAt, ...rest } = parsed.data;
  await db.update(playlistItemsTable).set({
    ...rest,
    ...(startAt !== undefined ? { startAt: startAt ? new Date(startAt) : null } : {}),
    ...(endAt !== undefined ? { endAt: endAt ? new Date(endAt) : null } : {}),
  }).where(eq(playlistItemsTable.id, id));

  res.json({ ok: true });
});

// GET /api/publications/playlists — list operator's playlists (for filter dropdown)
router.get("/playlists", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const rows = await db
    .select({ id: playlistsTable.id, name: playlistsTable.name })
    .from(playlistsTable)
    .where(eq(playlistsTable.userId, userId))
    .orderBy(playlistsTable.name);
  res.json(rows);
});

export default router;
