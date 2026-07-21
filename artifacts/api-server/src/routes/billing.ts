import { Router, type Request, type Response } from "express";
import { db, operatorsTable, subscriptionPaymentsTable, screensTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

const router = Router();

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.includes("T") ? v : new Date(v).toISOString();
  return null;
}

// Get current operator's billing info including per-screen breakdown
router.get("/billing/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  const id = Number(req.user!.id);

  let op: any = null;
  try {
    const rows = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id)).limit(1);
    op = rows[0] ?? null;
  } catch (err) {
    console.error("[billing/me] Falha ao buscar operador:", err);
    res.status(500).json({ error: "Erro ao buscar dados do operador" });
    return;
  }

  if (!op) {
    res.status(404).json({ error: "Operador não encontrado", userId: id });
    return;
  }

  // 3 camadas de fallback para tolerar schema drift no VPS
  let payments: any[] = [];
  let paymentsError: string | null = null;
  try {
    payments = await db.select()
      .from(subscriptionPaymentsTable)
      .where(eq(subscriptionPaymentsTable.operatorId, id))
      .orderBy(subscriptionPaymentsTable.referenceMonth);
  } catch {
    try {
      const raw = await db.execute(
        sql`SELECT id, operator_id as "operatorId", screen_id as "screenId",
                 reference_month as "referenceMonth", status, amount, notes,
                 paid_at as "paidAt", due_date as "dueDate", created_at as "createdAt",
                 payment_type as "paymentType", boleto_url as "boletoUrl"
            FROM subscription_payments WHERE operator_id = ${id} ORDER BY reference_month`
      );
      payments = ((raw as any).rows ?? raw ?? []);
    } catch {
      try {
        const raw = await db.execute(
          sql`SELECT id, operator_id as "operatorId",
                   reference_month as "referenceMonth", status, amount, notes,
                   paid_at as "paidAt", created_at as "createdAt"
              FROM subscription_payments WHERE operator_id = ${id} ORDER BY reference_month`
        );
        payments = ((raw as any).rows ?? raw ?? []).map((r: any) => ({
          ...r,
          screenId: null,
          dueDate: null,
          paymentType: null,
          boletoUrl: null,
        }));
      } catch (err: any) {
        paymentsError = String(err?.message ?? err);
        console.error("[billing/me] Falha ao buscar payments:", err);
        payments = [];
      }
    }
  }

  // Normaliza campos
  payments = payments.map((p: any) => ({
    ...p,
    screenId: p.screenId ?? null,
    dueDate: p.dueDate ?? null,
    paymentType: p.paymentType ?? null,
    boletoUrl: p.boletoUrl ?? null,
    paidAt: p.paidAt ?? null,
  }));

  // Screens com fallback
  let screens: any[] = [];
  try {
    screens = await db.select({
      id: screensTable.id,
      name: screensTable.name,
      location: screensTable.location,
      status: screensTable.status,
      code: screensTable.code,
      createdAt: screensTable.createdAt,
    })
      .from(screensTable)
      .where(eq(screensTable.userId, String(id)));
  } catch {
    try {
      const raw = await db.execute(
        sql`SELECT id, name, location, status, code, created_at as "createdAt" FROM screens WHERE user_id = ${String(id)}`
      );
      screens = ((raw as any).rows ?? raw ?? []);
    } catch (err) {
      console.error("[billing/me] Falha ao buscar screens:", err);
    }
  }

  // Enrich payments com screen details
  const screenIds = [...new Set(payments.map((p: any) => p.screenId).filter((v: any): v is number => v !== null))];
  const screenDetailMap = new Map<number, { name: string; code: string; cnpj: string | null; companyName: string | null; location: string | null }>();
  if (screenIds.length > 0) {
    try {
      const details = await db
        .select({ id: screensTable.id, name: screensTable.name, code: screensTable.code, cnpj: screensTable.cnpj, companyName: screensTable.companyName, location: screensTable.location })
        .from(screensTable)
        .where(inArray(screensTable.id, screenIds));
      for (const s of details) screenDetailMap.set(s.id, { name: s.name, code: s.code, cnpj: s.cnpj, companyName: s.companyName, location: s.location });
    } catch {
      try {
        const raw = await db.execute(
          sql`SELECT id, name, code, location FROM screens WHERE id = ANY(${screenIds})`
        );
        const rows = ((raw as any).rows ?? raw ?? []);
        for (const s of rows) screenDetailMap.set(s.id, { name: s.name, code: s.code, cnpj: null, companyName: null, location: s.location ?? null });
      } catch (err) {
        console.error("[billing/me] Falha ao enriquecer screens:", err);
      }
    }
  }

  const pricePerScreen = parseFloat(op.pricePerScreen ?? "50.00") || 50;
  const screenCount = screens.length;
  const effectiveMonthly = screenCount * pricePerScreen;

  const trialDaysLeft =
    op.subscriptionStatus === "trial" && op.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(op.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  res.json({
    operatorId: id,
    operatorName: op.name,
    operatorEmail: op.email ?? null,
    subscriptionStatus: op.subscriptionStatus,
    trialEndsAt: toIso(op.trialEndsAt),
    trialDaysLeft,
    paymentMethod: op.paymentMethod ?? "pix",
    monthlyAmount: effectiveMonthly.toFixed(2),
    pricePerScreen: pricePerScreen.toFixed(2),
    screenCount,
    _debug: paymentsError ? { paymentsError } : undefined,
    screens: screens.map((s: any) => ({
      id: s.id,
      name: s.name,
      location: s.location ?? null,
      status: s.status,
      code: s.code,
      monthlyPrice: pricePerScreen.toFixed(2),
      createdAt: toIso(s.createdAt) ?? new Date().toISOString(),
    })),
    payments: payments.map((p: any) => {
      const sd = p.screenId !== null ? (screenDetailMap.get(Number(p.screenId)) ?? null) : null;
      return {
        id: p.id,
        operatorId: p.operatorId,
        screenId: p.screenId ?? null,
        referenceMonth: p.referenceMonth,
        status: p.status,
        amount: p.amount,
        notes: p.notes ?? null,
        paymentType: p.paymentType ?? null,
        boletoUrl: p.boletoUrl ?? null,
        screenName: sd?.name ?? null,
        screenCode: sd?.code ?? null,
        screenCnpj: sd?.cnpj ?? null,
        screenCompanyName: sd?.companyName ?? null,
        screenLocation: sd?.location ?? null,
        paidAt: toIso(p.paidAt),
        dueDate: toIso(p.dueDate),
        createdAt: toIso(p.createdAt) ?? new Date().toISOString(),
      };
    }),
  });
});

// Cliente escolhe forma de pagamento de uma fatura própria
router.patch("/billing/me/payments/:paymentId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  const id = Number(req.user!.id);
  const paymentId = Number(req.params.paymentId);
  const { paymentType } = req.body as { paymentType: string };

  const VALID = ["pix", "boleto", "carteira", "credit_card", "debit_card", "cash", "transfer", "isento"];
  if (!paymentType || !VALID.includes(paymentType)) {
    res.status(400).json({ error: "Forma de pagamento inválida", valid: VALID });
    return;
  }

  // Verifica que a fatura pertence ao operador logado
  try {
    const [payment] = await db
      .select({ id: subscriptionPaymentsTable.id, operatorId: subscriptionPaymentsTable.operatorId })
      .from(subscriptionPaymentsTable)
      .where(eq(subscriptionPaymentsTable.id, paymentId))
      .limit(1);

    if (!payment || payment.operatorId !== id) {
      res.status(404).json({ error: "Fatura não encontrada" });
      return;
    }

    const [updated] = await db
      .update(subscriptionPaymentsTable)
      .set({ paymentType })
      .where(eq(subscriptionPaymentsTable.id, paymentId))
      .returning();

    res.json({ ok: true, paymentId, paymentType: updated!.paymentType });
  } catch {
    // Fallback para VPS com schema drift (payment_type pode não existir)
    try {
      await db.execute(
        sql`UPDATE subscription_payments SET payment_type = ${paymentType} WHERE id = ${paymentId} AND operator_id = ${id}`
      );
      res.json({ ok: true, paymentId, paymentType });
    } catch (err: any) {
      console.error("[billing/me/patch] Erro:", err);
      res.status(500).json({ error: "Erro ao atualizar forma de pagamento" });
    }
  }
});

export default router;
