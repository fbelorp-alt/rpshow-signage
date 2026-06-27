import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, screensTable, activityTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateClientBody,
  UpdateClientBody,
  UpdateClientParams,
  GetClientParams,
  DeleteClientParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const clients = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      type: clientsTable.type,
      contactName: clientsTable.contactName,
      contactPhone: clientsTable.contactPhone,
      address: clientsTable.address,
      active: clientsTable.active,
      createdAt: clientsTable.createdAt,
      screenCount: sql<number>`(select count(*) from screens where screens.client_id = ${clientsTable.id})`.mapWith(Number),
    })
    .from(clientsTable)
    .orderBy(clientsTable.createdAt);

  res.json(clients.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/", async (req, res) => {
  const body = CreateClientBody.parse(req.body);
  const [client] = await db.insert(clientsTable).values(body).returning();
  await db.insert(activityTable).values({ action: "created", entityType: "client", entityName: client.name });
  res.status(201).json({ ...client, screenCount: 0, createdAt: client.createdAt.toISOString() });
});

router.get("/:id", async (req, res) => {
  const { id } = GetClientParams.parse({ id: Number(req.params.id) });
  const [client] = await db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      type: clientsTable.type,
      contactName: clientsTable.contactName,
      contactPhone: clientsTable.contactPhone,
      address: clientsTable.address,
      active: clientsTable.active,
      createdAt: clientsTable.createdAt,
      screenCount: sql<number>`(select count(*) from screens where screens.client_id = ${clientsTable.id})`.mapWith(Number),
    })
    .from(clientsTable)
    .where(eq(clientsTable.id, id));
  if (!client) return res.status(404).json({ error: "Not found" });
  res.json({ ...client, createdAt: client.createdAt.toISOString() });
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdateClientParams.parse({ id: Number(req.params.id) });
  const body = UpdateClientBody.parse(req.body);
  const [client] = await db.update(clientsTable).set(body).where(eq(clientsTable.id, id)).returning();
  if (!client) return res.status(404).json({ error: "Not found" });
  await db.insert(activityTable).values({ action: "updated", entityType: "client", entityName: client.name });
  const screenCount = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(screensTable).where(eq(screensTable.clientId, id));
  res.json({ ...client, screenCount: screenCount[0]?.count ?? 0, createdAt: client.createdAt.toISOString() });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteClientParams.parse({ id: Number(req.params.id) });
  const [client] = await db.delete(clientsTable).where(eq(clientsTable.id, id)).returning();
  if (!client) return res.status(404).json({ error: "Not found" });
  await db.insert(activityTable).values({ action: "deleted", entityType: "client", entityName: client.name });
  res.status(204).send();
});

export default router;
