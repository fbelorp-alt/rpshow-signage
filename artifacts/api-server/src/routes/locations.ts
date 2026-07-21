import { Router } from "express";
import { db, locationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const _ul = req.user as any;
  const userId = String(_ul.parentOperatorId ?? _ul.id);
  const isAdmin = _ul.role === "admin";

  const rows = await db.select().from(locationsTable)
    .where(isAdmin ? undefined : eq(locationsTable.userId, userId))
    .orderBy(locationsTable.name);
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const _ulp = req.user as any;
  const userId = String(_ulp.parentOperatorId ?? _ulp.id);
  const { name, abbreviation, address, city, latitude, longitude, imageUrl, audience, audienceUnit, timezone, internalId, productionType, description } = req.body as Record<string, string>;
  if (!name?.trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }

  const [row] = await db.insert(locationsTable).values({
    userId,
    name: name.trim(),
    abbreviation: abbreviation || null,
    address: address || null,
    city: city || null,
    latitude: latitude || null,
    longitude: longitude || null,
    imageUrl: imageUrl || null,
    audience: audience ? Number(audience) : null,
    audienceUnit: audienceUnit || "pessoas/hora",
    timezone: timezone || "America/Sao_Paulo",
    internalId: internalId || null,
    productionType: productionType || null,
    description: description || null,
  }).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.get("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const id = Number(req.params.id);
  const _ul = req.user as any;
  const userId = String(_ul.parentOperatorId ?? _ul.id);
  const isAdmin = _ul.role === "admin";

  const [row] = await db.select().from(locationsTable)
    .where(isAdmin ? eq(locationsTable.id, id) : and(eq(locationsTable.id, id), eq(locationsTable.userId, userId)));
  if (!row) { res.status(404).json({ error: "Local não encontrado" }); return; }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const id = Number(req.params.id);
  const _ul = req.user as any;
  const userId = String(_ul.parentOperatorId ?? _ul.id);
  const isAdmin = _ul.role === "admin";

  const existing = await db.select({ id: locationsTable.id }).from(locationsTable)
    .where(isAdmin ? eq(locationsTable.id, id) : and(eq(locationsTable.id, id), eq(locationsTable.userId, userId)));
  if (!existing.length) { res.status(404).json({ error: "Local não encontrado" }); return; }

  const { name, abbreviation, address, city, latitude, longitude, imageUrl, audience, audienceUnit, timezone, internalId, productionType, description } = req.body as Record<string, any>;

  const [row] = await db.update(locationsTable).set({
    ...(name !== undefined && { name }),
    ...(abbreviation !== undefined && { abbreviation }),
    ...(address !== undefined && { address }),
    ...(city !== undefined && { city }),
    ...(latitude !== undefined && { latitude }),
    ...(longitude !== undefined && { longitude }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(audience !== undefined && { audience: audience ? Number(audience) : null }),
    ...(audienceUnit !== undefined && { audienceUnit }),
    ...(timezone !== undefined && { timezone }),
    ...(internalId !== undefined && { internalId }),
    ...(productionType !== undefined && { productionType }),
    ...(description !== undefined && { description }),
  }).where(eq(locationsTable.id, id)).returning();
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const id = Number(req.params.id);
  const _ul = req.user as any;
  const userId = String(_ul.parentOperatorId ?? _ul.id);
  const isAdmin = _ul.role === "admin";

  const [row] = await db.delete(locationsTable)
    .where(isAdmin ? eq(locationsTable.id, id) : and(eq(locationsTable.id, id), eq(locationsTable.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Local não encontrado" }); return; }
  res.status(204).send();
});

export default router;
