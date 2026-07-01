import { Router, type Request, type Response } from "express";
import { db, operatorsTable, subscriptionPaymentsTable, screensTable, mediaPlaysTable, activityTable } from "@workspace/db";
import { eq, count, ne, isNull, notInArray } from "drizzle-orm";
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

// List all operators with screen count and computed monthly amount
router.get("/operators", requireAdmin, async (_req, res) => {
  const ops = await db.select().from(operatorsTable).where(ne(operatorsTable.role, "admin")).orderBy(operatorsTable.createdAt);

  const screenCounts = await db
    .select({ operatorId: screensTable.userId, total: count() })
    .from(screensTable)
    .groupBy(screensTable.userId);

  const countMap = new Map(screenCounts.map((s) => [s.operatorId, s.total]));

  const result = ops.map((op) => {
    const screens = countMap.get(String(op.id)) ?? 0;
    const price = parseFloat(op.pricePerScreen ?? "50.00");
    const monthly = (screens * price).toFixed(2);
    return {
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
      pricePerScreen: op.pricePerScreen ?? "50.00",
      monthlyAmount: monthly,   // computed: screens × pricePerScreen
      screenCount: screens,
    };
  });

  res.json(result);
});

// Create a new operator/client
router.post("/operators", requireAdmin, async (req, res) => {
  const { username, password, name, email, phone, pricePerScreen, subscriptionStatus, trialDays } = req.body as {
    username?: string; password?: string; name?: string; email?: string;
    phone?: string; pricePerScreen?: string; subscriptionStatus?: string; trialDays?: number;
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
    pricePerScreen: pricePerScreen ?? "50.00",
    monthlyAmount: "0.00",
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
  const { subscriptionStatus, trialDays, pricePerScreen } = req.body as {
    subscriptionStatus?: string;
    trialDays?: number;
    pricePerScreen?: string;
  };

  const updates: Record<string, unknown> = {};
  if (subscriptionStatus !== undefined) updates["subscriptionStatus"] = subscriptionStatus;
  if (pricePerScreen !== undefined) updates["pricePerScreen"] = pricePerScreen;

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
      amount: amount ?? "0.00",
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

// Approve a pending operator
router.post("/operators/:id/approve", requireAdmin, async (req, res) => {
  const id = paramId(req);
  const { subscriptionStatus, trialDays, pricePerScreen } = req.body as {
    subscriptionStatus?: string; trialDays?: number; pricePerScreen?: string;
  };
  const status = subscriptionStatus ?? "trial";
  const days = trialDays ?? 30;
  const trialEndsAt = status === "trial" ? new Date(Date.now() + days * 86400000) : null;
  await db.update(operatorsTable).set({
    subscriptionStatus: status,
    trialDays: days,
    trialEndsAt: trialEndsAt ?? undefined,
    pricePerScreen: pricePerScreen ?? "50.00",
    monthlyAmount: "0.00",
  }).where(eq(operatorsTable.id, id));
  res.json({ ok: true });
});

// Comprehensive financial summary — all operators + all payments in one call
router.get("/financial", requireAdmin, async (_req, res) => {
  const ops = await db.select().from(operatorsTable).where(ne(operatorsTable.role, "admin")).orderBy(operatorsTable.createdAt);
  const screenCounts = await db.select({ operatorId: screensTable.userId, total: count() }).from(screensTable).groupBy(screensTable.userId);
  const allPayments = await db.select().from(subscriptionPaymentsTable).orderBy(subscriptionPaymentsTable.referenceMonth);

  const countMap = new Map(screenCounts.map((s) => [s.operatorId, s.total]));
  const paymentsByOp = new Map<number, typeof allPayments>();
  for (const p of allPayments) {
    if (!paymentsByOp.has(p.operatorId)) paymentsByOp.set(p.operatorId, []);
    paymentsByOp.get(p.operatorId)!.push(p);
  }

  const result = ops.map((op) => {
    const screens = countMap.get(String(op.id)) ?? 0;
    const price = parseFloat(op.pricePerScreen ?? "50.00");
    const monthly = (screens * price).toFixed(2);
    const payments = (paymentsByOp.get(op.id) ?? []).map((p) => ({
      ...p,
      paidAt: p.paidAt?.toISOString() ?? null,
      dueDate: p.dueDate?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
    return {
      id: op.id, username: op.username, name: op.name,
      email: op.email ?? null, phone: op.phone ?? null,
      createdAt: op.createdAt.toISOString(),
      subscriptionStatus: op.subscriptionStatus,
      trialEndsAt: op.trialEndsAt?.toISOString() ?? null,
      trialDays: op.trialDays,
      pricePerScreen: op.pricePerScreen ?? "50.00",
      monthlyAmount: monthly,
      screenCount: screens,
      payments,
    };
  });

  res.json(result);
});

// Generate pending payments for the current month for all non-cancelled operators
router.post("/generate-monthly", requireAdmin, async (_req, res) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dueDate = new Date(now.getFullYear(), now.getMonth(), 10);

  const ops = await db.select().from(operatorsTable).where(ne(operatorsTable.role, "admin"));
  const screenCounts = await db.select({ operatorId: screensTable.userId, total: count() }).from(screensTable).groupBy(screensTable.userId);
  const existing = await db.select({ operatorId: subscriptionPaymentsTable.operatorId })
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.referenceMonth, currentMonth));

  const countMap = new Map(screenCounts.map((s) => [s.operatorId, s.total]));
  const existingSet = new Set(existing.map((e) => e.operatorId));

  let created = 0;
  for (const op of ops) {
    if (op.subscriptionStatus === "cancelled") continue;
    if (existingSet.has(op.id)) continue;
    const screens = countMap.get(String(op.id)) ?? 0;
    const price = parseFloat(op.pricePerScreen ?? "50.00");
    const amount = (screens * price).toFixed(2);
    await db.insert(subscriptionPaymentsTable).values({
      operatorId: op.id, referenceMonth: currentMonth,
      status: "pending", amount, dueDate,
    });
    created++;
  }

  res.json({ created, month: currentMonth });
});

// Delete an operator
router.delete("/operators/:id", requireAdmin, async (req, res) => {
  const id = paramId(req);
  await db.delete(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.operatorId, id));
  await db.delete(operatorsTable).where(eq(operatorsTable.id, id));
  res.json({ ok: true });
});

// Purge orphaned test data: plays with no matching screen + activity with no userId
router.post("/purge-orphans", requireAdmin, async (_req, res) => {
  // Get all valid screen IDs
  const validScreens = await db.select({ id: screensTable.id }).from(screensTable);
  const validIds = validScreens.map((s) => s.id);

  let deletedPlays = 0;
  let deletedActivity = 0;

  if (validIds.length > 0) {
    const plays = await db.delete(mediaPlaysTable)
      .where(notInArray(mediaPlaysTable.screenId, validIds))
      .returning({ id: mediaPlaysTable.id });
    deletedPlays = plays.length;
  } else {
    // No valid screens — delete ALL plays
    const plays = await db.delete(mediaPlaysTable).returning({ id: mediaPlaysTable.id });
    deletedPlays = plays.length;
  }

  const activity = await db.delete(activityTable).where(isNull(activityTable.userId)).returning({ id: activityTable.id });
  deletedActivity = activity.length;

  res.json({ deletedPlays, deletedActivity });
});

export default router;
