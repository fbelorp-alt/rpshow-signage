import { Router } from "express";
import { db } from "@workspace/db";
import { screenGroupsTable, screensTable, schedulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  return String(req.user.parentOperatorId ?? req.user.id);
}

// List all groups belonging to the authenticated user
router.get("/", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const groups = await db.select().from(screenGroupsTable)
    .where(eq(screenGroupsTable.userId, userId));

  const screens = await db.select({
    id: screensTable.id,
    groupId: screensTable.groupId,
  }).from(screensTable)
    .where(eq(screensTable.userId, userId));

  const result = groups.map(g => ({
    ...g,
    screenCount: screens.filter(s => s.groupId === g.id).length,
  }));

  res.json(result);
});

// Create group
router.post("/", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { name, color } = req.body as { name: string; color?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }

  const [group] = await db.insert(screenGroupsTable).values({
    userId,
    name: name.trim(),
    color: color ?? "#3B82F6",
  }).returning();

  res.status(201).json(group);
});

// Update group — only the owner can update
router.patch("/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [existing] = await db.select({ id: screenGroupsTable.id, userId: screenGroupsTable.userId })
    .from(screenGroupsTable).where(eq(screenGroupsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Grupo não encontrado" }); return; }
  if (existing.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  const { name, color } = req.body as { name?: string; color?: string };
  const updates: Partial<typeof screenGroupsTable.$inferInsert> = {};
  if (name?.trim()) updates.name = name.trim();
  if (color) updates.color = color;
  if (!Object.keys(updates).length) { res.status(400).json({ error: "Nada a atualizar" }); return; }

  const [group] = await db.update(screenGroupsTable).set(updates)
    .where(eq(screenGroupsTable.id, id)).returning();
  res.json(group);
});

// Delete group — only the owner can delete
router.delete("/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [existing] = await db.select({ id: screenGroupsTable.id, userId: screenGroupsTable.userId })
    .from(screenGroupsTable).where(eq(screenGroupsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Grupo não encontrado" }); return; }
  if (existing.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  // Unassign all screens from this group first
  await db.update(screensTable).set({ groupId: null }).where(eq(screensTable.groupId, id));
  await db.delete(screenGroupsTable).where(eq(screenGroupsTable.id, id));
  res.status(204).send();
});

// Assign screen to group — verify both belong to the authenticated user
router.post("/:id/assign", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const groupId = parseInt(req.params.id);
  const { screenId } = req.body as { screenId: number };
  if (isNaN(groupId) || !screenId) { res.status(400).json({ error: "Dados inválidos" }); return; }

  // Verify group ownership
  const [group] = await db.select({ userId: screenGroupsTable.userId })
    .from(screenGroupsTable).where(eq(screenGroupsTable.id, groupId)).limit(1);
  if (!group || group.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  // Verify screen ownership
  const [screen] = await db.select({ userId: screensTable.userId })
    .from(screensTable).where(eq(screensTable.id, screenId)).limit(1);
  if (!screen || screen.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  await db.update(screensTable).set({ groupId }).where(eq(screensTable.id, screenId));
  res.status(204).send();
});

// Remove screen from group — verify ownership
router.post("/:id/unassign", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const groupId = parseInt(req.params.id);
  const { screenId } = req.body as { screenId: number };
  if (isNaN(groupId) || !screenId) { res.status(400).json({ error: "Dados inválidos" }); return; }

  // Verify screen belongs to the user and is in this group
  const [screen] = await db.select({ userId: screensTable.userId, groupId: screensTable.groupId })
    .from(screensTable).where(eq(screensTable.id, screenId)).limit(1);
  if (!screen || screen.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }
  if (screen.groupId !== groupId) { res.status(400).json({ error: "Tela não está neste grupo" }); return; }

  await db.update(screensTable).set({ groupId: null }).where(eq(screensTable.id, screenId));
  res.status(204).send();
});

// Push playlist to all screens in a group — verify group ownership
router.post("/:id/push", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const groupId = parseInt(req.params.id);
  const { playlistId } = req.body as { playlistId: number };
  if (isNaN(groupId) || !playlistId) { res.status(400).json({ error: "Dados inválidos" }); return; }

  // Verify group ownership
  const [group] = await db.select({ userId: screenGroupsTable.userId })
    .from(screenGroupsTable).where(eq(screenGroupsTable.id, groupId)).limit(1);
  if (!group || group.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  const screens = await db.select({ id: screensTable.id })
    .from(screensTable)
    .where(and(eq(screensTable.groupId, groupId), eq(screensTable.userId, userId)));

  if (!screens.length) { res.status(400).json({ error: "Nenhuma tela no grupo" }); return; }

  const now = new Date();
  for (const screen of screens) {
    await db.update(schedulesTable).set({ active: false })
      .where(and(eq(schedulesTable.screenId, screen.id), eq(schedulesTable.active, true)));

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
