import { Router, type Request, type Response } from "express";
import { db, operatorsTable, subscriptionPaymentsTable, screensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

// Get current operator's billing info including per-screen breakdown
router.get("/billing/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  const id = Number(req.user!.id);
  const [op] = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id)).limit(1);

  if (!op) {
    res.status(404).json({ error: "Operador não encontrado" });
    return;
  }

  const [payments, screens] = await Promise.all([
    db.select()
      .from(subscriptionPaymentsTable)
      .where(eq(subscriptionPaymentsTable.operatorId, id))
      .orderBy(subscriptionPaymentsTable.referenceMonth),
    db.select({
      id: screensTable.id,
      name: screensTable.name,
      location: screensTable.location,
      status: screensTable.status,
      code: screensTable.code,
      createdAt: screensTable.createdAt,
    })
      .from(screensTable)
      .where(eq(screensTable.userId, String(id))),
  ]);

  // Enrich payments with screen name + code
  const screenIds = [...new Set(payments.map(p => p.screenId).filter((v): v is number => v !== null))];
  const screenDetailMap = new Map<number, { name: string; code: string }>();
  if (screenIds.length > 0) {
    const details = await db
      .select({ id: screensTable.id, name: screensTable.name, code: screensTable.code })
      .from(screensTable)
      .where(inArray(screensTable.id, screenIds));
    for (const s of details) screenDetailMap.set(s.id, { name: s.name, code: s.code });
  }

  const pricePerScreen = parseFloat(op.pricePerScreen ?? "50.00") || 50;
  const screenCount = screens.length;
  const effectiveMonthly = screenCount * pricePerScreen;

  const trialDaysLeft =
    op.subscriptionStatus === "trial" && op.trialEndsAt
      ? Math.max(0, Math.ceil((op.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  res.json({
    subscriptionStatus: op.subscriptionStatus,
    trialEndsAt: op.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    monthlyAmount: effectiveMonthly.toFixed(2),
    pricePerScreen: pricePerScreen.toFixed(2),
    screenCount,
    screens: screens.map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location ?? null,
      status: s.status,
      code: s.code,
      monthlyPrice: pricePerScreen.toFixed(2),
      createdAt: s.createdAt.toISOString(),
    })),
    payments: payments.map((p) => ({
      ...p,
      screenName: p.screenId !== null ? (screenDetailMap.get(p.screenId)?.name ?? null) : null,
      screenCode: p.screenId !== null ? (screenDetailMap.get(p.screenId)?.code ?? null) : null,
      paidAt: p.paidAt?.toISOString() ?? null,
      dueDate: p.dueDate?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

export default router;
