import { Router } from "express";
import { db } from "@workspace/db";
import { screenGroupsTable, screensTable, playlistsTable, schedulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// List all groups
router.get("/", async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const groups = await db.select().from(screenGroupsTable)
    .where(userId ? eq(screenGroupsTable.userId, userId) : undefined as any);

  const screens = await db.select({
    id: screensTable.id,
    name: screensTable.name,
    groupId: screensTable.groupId,
    status: screensTable.status,
  }).from(screensTable)
    .where(userId ? eq(screensTable.userId, userId) : undefined as any);

  const result = groups.map(g => ({
    ...g,
    screenCount: screens.filter(s => s.groupId === g.id).length,
  }));

  res.json(result);
});

// Create group
router.post("/", async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const { name, color } = req.body as { name: string; color?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }

  const [group] = await db.insert(screenGroupsTable).values({
    userId: userId ?? null,
    name: name.trim(),
    color: color ?? "#3B82F6",
  }).returning();

  res.status(201).json(group);
});

// Update group
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, color } = req.body as { name?: string; color?: string };
  const updates: Partial<typeof screenGroupsTable.$inferInsert> = {};
  if (name?.trim()) updates.name = name.trim();
  if (color) updates.color = color;
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nada a atualizar" }); return; }
  const [group] = await db.update(screenGroupsTable).set(updates).where(eq(screenGroupsTable.id, id)).returning();
  res.json(group);
});

// Delete group
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  // Unassign screens from this group first
  await db.update(screensTable).set({ groupId: null }).where(eq(screensTable.groupId, id));
  await db.delete(screenGroupsTable).where(eq(screenGroupsTable.id, id));
  res.status(204).send();
});

// Assign screen to group
router.post("/:id/assign", async (req, res) => {
  const groupId = parseInt(req.params.id);
  const { screenId } = req.body as { screenId: number };
  await db.update(screensTable).set({ groupId }).where(eq(screensTable.id, screenId));
  res.status(204).send();
});

// Remove screen from group
router.post("/:id/unassign", async (req, res) => {
  const { screenId } = req.body as { screenId: number };
  await db.update(screensTable).set({ groupId: null }).where(eq(screensTable.id, screenId));
  res.status(204).send();
});

// Push playlist to all screens in a group
router.post("/:id/push", async (req, res) => {
  const groupId = parseInt(req.params.id);
  const userId = (req as any).userId as string | undefined;
  const { playlistId } = req.body as { playlistId: number };

  const screens = await db.select({ id: screensTable.id })
    .from(screensTable)
    .where(eq(screensTable.groupId, groupId));

  if (!screens.length) { res.status(400).json({ error: "Nenhuma tela no grupo" }); return; }

  const now = new Date();
  for (const screen of screens) {
    // Deactivate existing active schedules
    await db.update(schedulesTable).set({ active: false })
      .where(and(eq(schedulesTable.screenId, screen.id), eq(schedulesTable.active, true)));

    // Create a new active schedule with no time restriction (plays now indefinitely)
    await db.insert(schedulesTable).values({
      screenId: screen.id,
      name: "Envio em grupo",
      playlistId,
      active: true,
      startAt: now,
    });
  }

  res.json({ pushed: screens.length });
});

export default router;
