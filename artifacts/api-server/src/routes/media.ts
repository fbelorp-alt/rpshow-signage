import { Router } from "express";
import { db } from "@workspace/db";
import { mediaTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateMediaBody,
  GetMediaParams,
  DeleteMediaParams,
  ListMediaQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const query = ListMediaQueryParams.parse(req.query);
  const rows = await db
    .select()
    .from(mediaTable)
    .where(query.clientId ? eq(mediaTable.clientId, query.clientId) : undefined)
    .orderBy(mediaTable.createdAt);

  res.json(rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  const body = CreateMediaBody.parse(req.body);
  const [media] = await db.insert(mediaTable).values(body).returning();
  await db.insert(activityTable).values({ action: "uploaded", entityType: "media", entityName: media.name });
  res.status(201).json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.get("/:id", async (req, res) => {
  const { id } = GetMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!media) return res.status(404).json({ error: "Not found" });
  res.json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db.delete(mediaTable).where(eq(mediaTable.id, id)).returning();
  if (!media) return res.status(404).json({ error: "Not found" });
  await db.insert(activityTable).values({ action: "deleted", entityType: "media", entityName: media.name });
  res.status(204).send();
});

export default router;
