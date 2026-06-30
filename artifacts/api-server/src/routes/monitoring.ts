import { Router, type Request, type Response } from "express";
import { db, screensTable, mediaPlaysTable } from "@workspace/db";
import { eq, desc, gte } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { randomUUID } from "crypto";

const router = Router();

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 min

function screenStatus(lastSeen: Date | null): "online" | "offline" | "never" {
  if (!lastSeen) return "never";
  return Date.now() - lastSeen.getTime() < ONLINE_THRESHOLD_MS ? "online" : "offline";
}

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }

  const screens = await db.select({
    id: screensTable.id,
    name: screensTable.name,
    code: screensTable.code,
    location: screensTable.location,
    status: screensTable.status,
    lastSeen: screensTable.lastSeen,
    resolution: screensTable.resolution,
    lastScreenshot: screensTable.lastScreenshot,
  }).from(screensTable)
    .orderBy(screensTable.name);

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentPlays = await db.select({
    screenId: mediaPlaysTable.screenId,
    mediaName: mediaPlaysTable.mediaName,
    mediaType: mediaPlaysTable.mediaType,
    playedAt: mediaPlaysTable.playedAt,
  }).from(mediaPlaysTable)
    .where(gte(mediaPlaysTable.playedAt, oneDayAgo))
    .orderBy(desc(mediaPlaysTable.playedAt))
    .limit(500);

  const lastPlayByScreen = new Map<number, typeof recentPlays[0]>();
  for (const p of recentPlays) {
    if (p.screenId && !lastPlayByScreen.has(p.screenId)) {
      lastPlayByScreen.set(p.screenId, p);
    }
  }

  const result = screens.map((s) => {
    const lp = lastPlayByScreen.get(s.id);
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      location: s.location ?? null,
      status: screenStatus(s.lastSeen),
      lastSeen: s.lastSeen?.toISOString() ?? null,
      resolution: s.resolution ?? null,
      lastScreenshot: s.lastScreenshot ?? null,
      lastPlay: lp ? {
        mediaName: lp.mediaName,
        mediaType: lp.mediaType,
        playedAt: lp.playedAt.toISOString(),
      } : null,
    };
  });

  res.json(result);
});

router.get("/:id/plays", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const id = Number(req.params.id);
  const [screen] = await db.select({ id: screensTable.id })
    .from(screensTable)
    .where(eq(screensTable.id, id))
    .limit(1);
  if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return; }

  const plays = await db.select({
    id: mediaPlaysTable.id,
    mediaName: mediaPlaysTable.mediaName,
    mediaType: mediaPlaysTable.mediaType,
    durationSeconds: mediaPlaysTable.durationSeconds,
    playedAt: mediaPlaysTable.playedAt,
  }).from(mediaPlaysTable)
    .where(eq(mediaPlaysTable.screenId, id))
    .orderBy(desc(mediaPlaysTable.playedAt))
    .limit(50);

  res.json(plays.map((p) => ({ ...p, playedAt: p.playedAt.toISOString() })));
});

router.post("/screenshot/:screenCode", async (req, res) => {
  const { screenCode } = req.params;
  const { imageBase64, contentType = "image/jpeg" } = req.body as {
    imageBase64?: string;
    contentType?: string;
  };

  if (!imageBase64) { res.status(400).json({ error: "imageBase64 obrigatório" }); return; }

  const [screen] = await db.select({ id: screensTable.id, userId: screensTable.userId })
    .from(screensTable)
    .where(eq(screensTable.code, screenCode))
    .limit(1);
  if (!screen) { res.status(404).json({ error: "Tela não encontrada" }); return; }

  try {
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateDir) { res.status(500).json({ error: "Object storage não configurado" }); return; }

    const objectId = `screenshots/${randomUUID()}.jpg`;
    const fullPath = `${privateDir}/${objectId}`;
    const parts = fullPath.replace(/^\//, "").split("/");
    const bucketName = parts[0];
    const objectName = parts.slice(1).join("/");

    const buffer = Buffer.from(imageBase64, "base64");
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(buffer, { contentType, resumable: false });

    const screenshotPath = `/objects/${objectId}`;
    await db.update(screensTable).set({ lastScreenshot: screenshotPath }).where(eq(screensTable.id, screen.id));

    res.json({ ok: true, path: screenshotPath });
  } catch (err) {
    res.status(500).json({ error: "Falha ao salvar screenshot" });
  }
});

export default router;
