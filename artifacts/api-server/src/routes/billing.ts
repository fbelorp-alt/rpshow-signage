import { Router, type Request, type Response } from "express";
import { db, operatorsTable, subscriptionPaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Get current operator's billing info
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

  const payments = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(eq(subscriptionPaymentsTable.operatorId, id))
    .orderBy(subscriptionPaymentsTable.referenceMonth);

  const trialDaysLeft =
    op.subscriptionStatus === "trial" && op.trialEndsAt
      ? Math.max(0, Math.ceil((op.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  res.json({
    subscriptionStatus: op.subscriptionStatus,
    trialEndsAt: op.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    monthlyAmount: op.monthlyAmount,
    payments: payments.map((p) => ({
      ...p,
      paidAt: p.paidAt?.toISOString() ?? null,
      dueDate: p.dueDate?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

export default router;
