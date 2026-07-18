import { Router } from "express";
import { db } from "@workspace/db";
import { mediaTable, activityTable, playlistItemsTable, playlistsTable, operatorsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

import {
  GetMediaParams,
  DeleteMediaParams,
} from "@workspace/api-zod";

const router = Router();

// ── Pexels stock search proxy ─────────────────────────────────────────────────
router.get("/stock-search", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const key = process.env.PEXELS_API_KEY;
  if (!key) { res.status(503).json({ error: "PEXELS_API_KEY not configured" }); return; }
  const { q = "natureza", page = "1" } = req.query as { q?: string; page?: string };
  const apiUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(String(q))}&per_page=24&page=${Number(page) || 1}`;
  const r = await fetch(apiUrl, { headers: { Authorization: key } });
  const data = await r.json();
  res.json(data);
});

router.get("/stock-search-videos", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const key = process.env.PEXELS_API_KEY;
  if (!key) { res.status(503).json({ error: "PEXELS_API_KEY not configured" }); return; }
  const { q = "natureza", page = "1" } = req.query as { q?: string; page?: string };
  const apiUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(String(q))}&per_page=15&page=${Number(page) || 1}`;
  const r = await fetch(apiUrl, { headers: { Authorization: key } });
  const data = await r.json();
  res.json(data);
});

router.get("/stock-proxy", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { url } = req.query as { url?: string };
  if (!url) { res.status(400).json({ error: "URL não permitida" }); return; }
  let decoded: string;
  try { decoded = decodeURIComponent(url); } catch { res.status(400).json({ error: "URL inválida" }); return; }
  const allowed =
    decoded.startsWith("https://images.pexels.com/") ||
    decoded.startsWith("https://videos.pexels.com/") ||
    decoded.startsWith("https://player.pexels.com/");
  if (!allowed) { res.status(400).json({ error: "URL não permitida" }); return; }
  const r = await fetch(decoded);
  if (!r.ok) { res.status(502).json({ error: "Falha ao baixar mídia" }); return; }
  const ct = r.headers.get("content-type") || "application/octet-stream";
  res.set("Content-Type", ct);
  res.set("Cache-Control", "public, max-age=86400");
  const buf = await r.arrayBuffer();
  res.send(Buffer.from(buf));
});

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
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const rows = await db
    .selectDistinct({ mediaId: playlistItemsTable.mediaId })
    .from(playlistItemsTable)
    .innerJoin(playlistsTable, eq(playlistItemsTable.playlistId, playlistsTable.id))
    .where(eq(playlistsTable.userId, userId));
  res.json({ usedMediaIds: rows.map((r) => r.mediaId) });
});

router.get("/storage-stats", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const [rawResult, opResult] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::integer AS count,
        COALESCE(SUM((meta_json::jsonb->>'fileSize')::bigint), 0)::bigint AS total_bytes
      FROM media
      WHERE user_id = ${userId}
    `),
    db.select({ storageQuotaGb: operatorsTable.storageQuotaGb })
      .from(operatorsTable)
      .where(eq(operatorsTable.username, userId))
      .limit(1),
  ]);
  const row = (rawResult.rows?.[0] ?? { count: 0, total_bytes: 0 }) as { count: number; total_bytes: string };
  const op = opResult[0];
  const quotaGb = op?.storageQuotaGb ?? 5;
  const usedBytes = Number(row.total_bytes);
  const quotaBytes = quotaGb * 1024 * 1024 * 1024;
  const pct = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0;
  res.json({
    count: Number(row.count),
    totalBytes: usedBytes,
    quotaGb,
    quotaBytes,
    pct,
    nearLimit: pct >= 80,
    overLimit: pct >= 100,
  });
});

router.get("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const { id } = GetMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  if (media.userId !== userId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const id = Number(req.params.id);
  const { name, url, metaJson } = req.body as { name?: string; url?: string; metaJson?: string | null };
  const updates: { name?: string; url?: string; metaJson?: string | null } = {};
  if (name && name.trim()) updates.name = name.trim();
  if (url && url.trim()) updates.url = url.trim();
  if (metaJson !== undefined) updates.metaJson = metaJson;

  const [media] = await db
    .update(mediaTable)
    .set(updates)
    .where(and(eq(mediaTable.id, id), eq(mediaTable.userId, userId)))
    .returning();

  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ userId, action: "renamed", entityType: "media", entityName: media.name });
  res.json({ ...media, createdAt: media.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = String((req.user as any).id);
  const { id } = DeleteMediaParams.parse({ id: Number(req.params.id) });
  const [media] = await db
    .delete(mediaTable)
    .where(and(eq(mediaTable.id, id), eq(mediaTable.userId, userId)))
    .returning();
  if (!media) { res.status(404).json({ error: "Not found" }); return; }
  await db.insert(activityTable).values({ userId, action: "deleted", entityType: "media", entityName: media.name });
  res.status(204).send();
});

export default router;
