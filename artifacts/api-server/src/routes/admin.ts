import { Router, type Request, type Response } from "express";
import { db, operatorsTable, subscriptionPaymentsTable, screensTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

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
  const ops = await db.select().from(operatorsTable).orderBy(operatorsTable.createdAt);

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

// Delete an operator
router.delete("/operators/:id", requireAdmin, async (req, res) => {
  const id = paramId(req);
  await db.delete(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.operatorId, id));
  await db.delete(operatorsTable).where(eq(operatorsTable.id, id));
  res.json({ ok: true });
});

export default router;
