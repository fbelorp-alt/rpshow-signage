import { Router } from "express";
import { db } from "@workspace/db";
import { mediaTable, activityTable, playlistItemsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

import {
  GetMediaParams,
  DeleteMediaParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const rows = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.userId, userId))
    .orderBy(desc(mediaTable.createdAt));

  res.json(rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name, type, url, thumbnailUrl, durationSeconds, metaJson } = req.body as {
    name: string;
    type: string;
    url: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    metaJson?: string;
  };
  const userId = String((req.user as any).id);
  const [media] = await db
    .insert(mediaTable)
    .values({ name, type, url, thumbnailUrl, durationSeconds, metaJson, userId })
    .returning();
  await db.insert(activityTable).values({ userId, action: "uploaded", entityType: "media", entityName: media.name });
  res.status(201).json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.get("/usage", async (req, res) => {
  const rows = await db
    .selectDistinct({ mediaId: playlistItemsTable.mediaId })
    .from(playlistItemsTable);
  res.json({ usedMediaIds: rows.map((r) => r.mediaId) });
});

router.get("/storage-stats", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const [row] = await db.execute(sql`
    SELECT
      COUNT(*)::integer AS count,
      COALESCE(SUM((meta_json::jsonb->>'fileSize')::bigint), 0)::bigint AS total_bytes
    FROM media
    WHERE user_id = ${userId}
  `);
  res.json({ count: Number(row.count), totalBytes: Number(row.total_bytes) });
});

router.get("/:id", async (req, res) => {
  const { id } = GetMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, url, metaJson } = req.body as { name?: string; url?: string; metaJson?: string | null };
  const updates: { name?: string; url?: string; metaJson?: string | null } = {};
  if (name && name.trim()) updates.name = name.trim();
  if (url && url.trim()) updates.url = url.trim();
  if (metaJson !== undefined) updates.metaJson = metaJson;

  const [media] = await db
    .update(mediaTable)
    .set(updates)
    .where(eq(mediaTable.id, id))
    .returning();

  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  const uid = req.isAuthenticated() ? String((req.user as any).id) : undefined;
  await db.insert(activityTable).values({ userId: uid, action: "renamed", entityType: "media", entityName: media.name });
  res.json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db.delete(mediaTable).where(eq(mediaTable.id, id)).returning();
  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  const uid2 = req.isAuthenticated() ? String((req.user as any).id) : undefined;
  await db.insert(activityTable).values({ userId: uid2, action: "deleted", entityType: "media", entityName: media.name });
  res.status(204).send();
});

export default router;
