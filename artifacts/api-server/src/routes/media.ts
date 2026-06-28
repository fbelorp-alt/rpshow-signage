import { Router } from "express";
import { db } from "@workspace/db";
import { mediaTable, activityTable, playlistItemsTable } from "@workspace/db";
import { eq, or, isNull } from "drizzle-orm";
import {
  GetMediaParams,
  DeleteMediaParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const userId = req.isAuthenticated() ? req.user.id : undefined;
  const rows = await db
    .select()
    .from(mediaTable)
    .where(userId ? or(eq(mediaTable.userId, userId), isNull(mediaTable.userId)) : undefined)
    .orderBy(mediaTable.createdAt);

  res.json(rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { name, type, url, thumbnailUrl, durationSeconds } = req.body as {
    name: string;
    type: string;
    url: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
  };
  const [media] = await db
    .insert(mediaTable)
    .values({ name, type, url, thumbnailUrl, durationSeconds, userId: req.user.id })
    .returning();
  await db.insert(activityTable).values({ action: "uploaded", entityType: "media", entityName: media.name });
  res.status(201).json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.get("/usage", async (req, res) => {
  const rows = await db
    .selectDistinct({ mediaId: playlistItemsTable.mediaId })
    .from(playlistItemsTable);
  res.json({ usedMediaIds: rows.map((r) => r.mediaId) });
});

router.get("/:id", async (req, res) => {
  const { id } = GetMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body as { name?: string };
  const updates: { name?: string } = {};
  if (name && name.trim()) updates.name = name.trim();

  const [media] = await db
    .update(mediaTable)
    .set(updates)
    .where(eq(mediaTable.id, id))
    .returning();

  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ action: "renamed", entityType: "media", entityName: media.name });
  res.json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db.delete(mediaTable).where(eq(mediaTable.id, id)).returning();
  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ action: "deleted", entityType: "media", entityName: media.name });
  res.status(204).send();
});

export default router;
