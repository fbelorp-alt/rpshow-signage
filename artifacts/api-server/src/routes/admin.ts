import { Router, type Request, type Response } from "express";
import { db, operatorsTable, subscriptionPaymentsTable, screensTable } from "@workspace/db";
import { eq, count, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return;
  }
  next();
}

function paramId(req: Request): number {
  return parseInt(req.params["id"] as string);
}

// List all operators with screen count and subscription info
router.get("/operators", requireAdmin, async (_req, res) => {
  const ops = await db.select().from(operatorsTable).where(ne(operatorsTable.role, "admin")).orderBy(operatorsTable.createdAt);

  const screenCounts = await db
    .select({ operatorId: screensTable.userId, total: count() })
    .from(screensTable)
    .groupBy(screensTable.userId);

  const countMap = new Map(screenCounts.map((s) => [s.operatorId, s.total]));

  const result = ops.map((op) => ({
    id: op.id,
    username: op.username,
    name: op.name,
    email: op.email,
    phone: op.phone,
    role: op.role,
    createdAt: op.createdAt.toISOString(),
    subscriptionStatus: op.subscriptionStatus,
    trialEndsAt: op.trialEndsAt?.toISOString() ?? null,
    trialDays: op.trialDays,
    monthlyAmount: op.monthlyAmount,
    screenCount: countMap.get(String(op.id)) ?? 0,
  }));

  res.json(result);
});

// Create a new operator/client
router.post("/operators", requireAdmin, async (req, res) => {
  const { username, password, name, email, phone, monthlyAmount, subscriptionStatus, trialDays } = req.body as {
    username?: string; password?: string; name?: string; email?: string;
    phone?: string; monthlyAmount?: string; subscriptionStatus?: string; trialDays?: number;
  };

  if (!username || !password || !name) {
    res.status(400).json({ error: "username, password e name são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }

  const existing = await db.select({ id: operatorsTable.id }).from(operatorsTable).where(eq(operatorsTable.username, username));
  if (existing.length > 0) {
    res.status(409).json({ error: "Nome de usuário já existe" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const status = subscriptionStatus ?? "trial";
  const days = trialDays ?? 30;
  const trialEndsAt = status === "trial" ? new Date(Date.now() + days * 86400000) : null;

  const [op] = await db.insert(operatorsTable).values({
    username, passwordHash, name, email: email || null, phone: phone || null,
    role: "operator", subscriptionStatus: status,
    trialDays: days, trialEndsAt: trialEndsAt ?? undefined,
    monthlyAmount: monthlyAmount ?? "80.00",
  }).returning({ id: operatorsTable.id, username: operatorsTable.username, name: operatorsTable.name });

  res.status(201).json(op);
});

// Update basic info for an operator (name, email, phone)
router.patch("/operators/:id/info", requireAdmin, async (req, res) => {
  const id = paramId(req);
  const { name, email, phone } = req.body as { name?: string; email?: string; phone?: string };
  const updates: Record<string, unknown> = {};
  if (name) updates["name"] = name;
  if (email !== undefined) updates["email"] = email || null;
  if (phone !== undefined) updates["phone"] = phone || null;
  await db.update(operatorsTable).set(updates).where(eq(operatorsTable.id, id));
  res.json({ ok: true });
});

// Update subscription for a specific operator
router.patch("/operators/:id/subscription", requireAdmin, async (req, res) => {
  const id = paramId(req);
  const { subscriptionStatus, trialDays, monthlyAmount } = req.body as {
    subscriptionStatus?: string;
    trialDays?: number;
    monthlyAmount?: string;
  };

  const updates: Record<string, unknown> = {};
  if (subscriptionStatus !== undefined) updates["subscriptionStatus"] = subscriptionStatus;
  if (monthlyAmount !== undefined) updates["monthlyAmount"] = monthlyAmount;

  if (trialDays !== undefined) {
    updates["trialDays"] = trialDays;
    updates["trialEndsAt"] = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    if (subscriptionStatus === undefined) updates["subscriptionStatus"] = "trial";
  }

  await db.update(operatorsTable).set(updates).where(eq(operatorsTable.id, id));
  res.json({ ok: true });
});

// List payments for an operator
router.get("/operators/:id/payments", requireAdmin, async (req, res) => {
  const id = paramId(req);
  const payments = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.operatorId, id))
    .orderBy(subscriptionPaymentsTable.referenceMonth);

  res.json(
    payments.map((p) => ({
      ...p,
      paidAt: p.paidAt?.toISOString() ?? null,
      dueDate: p.dueDate?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }))
  );
});

// Record a payment for an operator
router.post("/operators/:id/payments", requireAdmin, async (req, res) => {
  const operatorId = paramId(req);
  const { referenceMonth, status, amount, notes, paidAt, dueDate } = req.body as {
    referenceMonth: string;
    status: string;
    amount?: string;
    notes?: string;
    paidAt?: string;
    dueDate?: string;
  };

  const [payment] = await db
    .insert(subscriptionPaymentsTable)
    .values({
      operatorId,
      referenceMonth,
      status,
      amount: amount ?? "80.00",
      notes: notes ?? null,
      paidAt: paidAt ? new Date(paidAt) : status === "paid" ? new Date() : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  res.status(201).json({
    ...payment!,
    paidAt: payment!.paidAt?.toISOString() ?? null,
    dueDate: payment!.dueDate?.toISOString() ?? null,
    createdAt: payment!.createdAt.toISOString(),
  });
});

// Update a payment record
router.patch("/operators/:id/payments/:paymentId", requireAdmin, async (req, res) => {
  const paymentId = parseInt(req.params["paymentId"] as string);
  const { status, notes, paidAt } = req.body as {
    status?: string;
    notes?: string;
    paidAt?: string;
  };

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates["status"] = status;
  if (notes !== undefined) updates["notes"] = notes;
  if (paidAt !== undefined) updates["paidAt"] = new Date(paidAt);
  else if (status === "paid") updates["paidAt"] = new Date();

  await db.update(subscriptionPaymentsTable).set(updates).where(eq(subscriptionPaymentsTable.id, paymentId));
  res.json({ ok: true });
});

// List screens for a specific operator
router.get("/operators/:id/screens", requireAdmin, async (req, res) => {
  const id = paramId(req);
  const screens = await db
    .select({
      id: screensTable.id,
      name: screensTable.name,
      status: screensTable.status,
      resolution: screensTable.resolution,
      location: screensTable.location,
      blocked: screensTable.blocked,
      lastSeen: screensTable.lastSeen,
    })
    .from(screensTable)
    .where(eq(screensTable.userId, String(id)))
    .orderBy(screensTable.name);

  res.json(screens.map(s => ({
    ...s,
    lastSeen: s.lastSeen?.toISOString() ?? null,
  })));
});

// Block or unblock a specific screen
router.patch("/screens/:screenId/block", requireAdmin, async (req, res) => {
  const screenId = parseInt(req.params["screenId"] as string);
  const { blocked } = req.body as { blocked: boolean };
  await db.update(screensTable).set({ blocked }).where(eq(screensTable.id, screenId));
  res.json({ ok: true, blocked });
});

// Delete a specific payment
router.delete("/operators/:id/payments/:paymentId", requireAdmin, async (req, res) => {
  const paymentId = parseInt(req.params["paymentId"] as string);
  await db.delete(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.id, paymentId));
  res.json({ ok: true });
});

// Delete an operator
router.delete("/operators/:id", requireAdmin, async (req, res) => {
  const id = paramId(req);
  await db.delete(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.operatorId, id));
  await db.delete(operatorsTable).where(eq(operatorsTable.id, id));
  res.json({ ok: true });
});

export default router;
