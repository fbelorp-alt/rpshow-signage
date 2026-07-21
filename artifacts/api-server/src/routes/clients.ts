import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, screensTable, activityTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const _uc = req.user as any;
  const userId = String(_uc.parentOperatorId ?? _uc.id);
  const isAdmin = _uc.role === "admin";

  const clients = await db
    .select({
      id: clientsTable.id,
      userId: clientsTable.userId,
      name: clientsTable.name,
      cnpj: clientsTable.cnpj,
      segment: clientsTable.segment,
      type: clientsTable.type,
      contactName: clientsTable.contactName,
      contactPhone: clientsTable.contactPhone,
      address: clientsTable.address,
      active: clientsTable.active,
      createdAt: clientsTable.createdAt,
      screenCount: sql<number>`(select count(*) from screens where screens.client_id = ${clientsTable.id})`.mapWith(Number),
    })
    .from(clientsTable)
    .where(isAdmin ? undefined : eq(clientsTable.userId, userId))
    .orderBy(clientsTable.name);

  res.json(clients.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const _ucp = req.user as any;
  const userId = String(_ucp.parentOperatorId ?? _ucp.id);
  const { name, cnpj, segment, type, contactName, contactPhone, address } = req.body as Record<string, string>;
  if (!name?.trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }

  const [client] = await db.insert(clientsTable).values({
    userId,
    name: name.trim(),
    cnpj: cnpj || null,
    segment: segment || null,
    type: type || "other",
    contactName: contactName || null,
    contactPhone: contactPhone || null,
    address: address || null,
  }).returning();

  await db.insert(activityTable).values({ action: "created", entityType: "client", entityName: client.name });
  res.status(201).json({ ...client, screenCount: 0, createdAt: client.createdAt.toISOString() });
});

router.get("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const id = Number(req.params.id);
  const _uc = req.user as any;
  const userId = String(_uc.parentOperatorId ?? _uc.id);
  const isAdmin = _uc.role === "admin";

  const [client] = await db
    .select({
      id: clientsTable.id,
      userId: clientsTable.userId,
      name: clientsTable.name,
      cnpj: clientsTable.cnpj,
      segment: clientsTable.segment,
      type: clientsTable.type,
      contactName: clientsTable.contactName,
      contactPhone: clientsTable.contactPhone,
      address: clientsTable.address,
      active: clientsTable.active,
      createdAt: clientsTable.createdAt,
      screenCount: sql<number>`(select count(*) from screens where screens.client_id = ${clientsTable.id})`.mapWith(Number),
    })
    .from(clientsTable)
    .where(isAdmin ? eq(clientsTable.id, id) : and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)));

  if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
  res.json({ ...client, createdAt: client.createdAt.toISOString() });
});

router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const id = Number(req.params.id);
  const _uc = req.user as any;
  const userId = String(_uc.parentOperatorId ?? _uc.id);
  const isAdmin = _uc.role === "admin";

  const { name, cnpj, segment, type, contactName, contactPhone, address, active } = req.body as Record<string, any>;

  const [client] = await db.update(clientsTable).set({
    ...(name !== undefined && { name }),
    ...(cnpj !== undefined && { cnpj }),
    ...(segment !== undefined && { segment }),
    ...(type !== undefined && { type }),
    ...(contactName !== undefined && { contactName }),
    ...(contactPhone !== undefined && { contactPhone }),
    ...(address !== undefined && { address }),
    ...(active !== undefined && { active }),
  }).where(isAdmin ? eq(clientsTable.id, id) : and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)))
    .returning();

  if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
  await db.insert(activityTable).values({ action: "updated", entityType: "client", entityName: client.name });
  const [sc] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(screensTable).where(eq(screensTable.clientId, id));
  res.json({ ...client, screenCount: sc?.count ?? 0, createdAt: client.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return; }
  const id = Number(req.params.id);
  const _uc = req.user as any;
  const userId = String(_uc.parentOperatorId ?? _uc.id);
  const isAdmin = _uc.role === "admin";

  const [client] = await db.delete(clientsTable)
    .where(isAdmin ? eq(clientsTable.id, id) : and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)))
    .returning();

  if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
  await db.insert(activityTable).values({ action: "deleted", entityType: "client", entityName: client.name });
  res.status(204).send();
});

export default router;
