import { Router } from "express";
import { db } from "@workspace/db";
import { screensTable, schedulesTable, playlistsTable, playlistItemsTable, mediaTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { GetPlayerPlaylistParams } from "@workspace/api-zod";

const router = Router();

router.post("/:screenCode/heartbeat", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });
  const [screen] = await db.select({ id: screensTable.id }).from(screensTable).where(eq(screensTable.code, screenCode));
  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }
  await db.update(screensTable).set({ status: "online", lastSeen: new Date() }).where(eq(screensTable.id, screen.id));
  res.status(204).send();
});

router.get("/:screenCode", async (req, res) => {
  const { screenCode } = GetPlayerPlaylistParams.parse({ screenCode: req.params.screenCode });

  const [screen] = await db.select().from(screensTable).where(eq(screensTable.code, screenCode));
  if (!screen) { res.status(404).json({ error: "Screen not found" }); return; }

  await db.update(screensTable).set({ status: "online", lastSeen: new Date() }).where(eq(screensTable.id, screen.id));

  const [schedule] = await db
    .select()
    .from(schedulesTable)
    .where(and(eq(schedulesTable.screenId, screen.id), eq(schedulesTable.active, true)))
    .limit(1);

  if (!schedule) {
    res.json({ screenId: screen.id, screenName: screen.name, items: [] });
    return;
  }

  const items = await db
    .select({
      mediaUrl: mediaTable.url,
      mediaType: mediaTable.type,
      durationSeconds: playlistItemsTable.durationSeconds,
      mediaName: mediaTable.name,
    })
    .from(playlistItemsTable)
    .leftJoin(mediaTable, eq(playlistItemsTable.mediaId, mediaTable.id))
    .where(eq(playlistItemsTable.playlistId, schedule.playlistId))
    .orderBy(asc(playlistItemsTable.position));

  res.json({
    screenId: screen.id,
    screenName: screen.name,
    items: items.map((i) => ({
      mediaUrl: i.mediaUrl ?? "",
      mediaType: i.mediaType ?? "image",
      durationSeconds: i.durationSeconds,
      mediaName: i.mediaName ?? "",
    })),
  });
});

export default router;
