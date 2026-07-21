import { Router, type Request, type Response } from "express";
import { db, operatorsTable, subscriptionPaymentsTable, screensTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

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

  // 3 camadas de fallback para tolerar schema drift no VPS
  let payments: any[] = [];
  try {
    // Nível 1: ORM completo (schema atual)
    payments = await db.select()
      .from(subscriptionPaymentsTable)
      .where(eq(subscriptionPaymentsTable.operatorId, id))
      .orderBy(subscriptionPaymentsTable.referenceMonth);
  } catch {
    try {
      // Nível 2: SQL com colunas adicionadas na migração VPS
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
        // Nível 3: mínimo absoluto — só colunas originais da tabela
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
      } catch (err) {
        // Se até o mínimo falhar, loga e retorna lista vazia (evita 500 para o cliente)
        console.error("[billing/me] Falha ao buscar payments:", err);
        payments = [];
      }
    }
  }
  // Normaliza campos que podem vir como null/undefined
  payments = payments.map((p: any) => ({
    ...p,
    screenId: p.screenId ?? null,
    dueDate: p.dueDate ?? null,
    paymentType: p.paymentType ?? null,
    boletoUrl: p.boletoUrl ?? null,
    paidAt: p.paidAt ?? null,
  }));

  const screens = await db.select({
    id: screensTable.id,
    name: screensTable.name,
    location: screensTable.location,
    status: screensTable.status,
    code: screensTable.code,
    createdAt: screensTable.createdAt,
  })
    .from(screensTable)
    .where(eq(screensTable.userId, String(id)));

  // Enrich payments with screen name + code + cnpj
  const screenIds = [...new Set(payments.map(p => p.screenId).filter((v): v is number => v !== null))];
  const screenDetailMap = new Map<number, { name: string; code: string; cnpj: string | null; companyName: string | null; location: string | null }>();
  if (screenIds.length > 0) {
    const details = await db
      .select({ id: screensTable.id, name: screensTable.name, code: screensTable.code, cnpj: screensTable.cnpj, companyName: screensTable.companyName, location: screensTable.location })
      .from(screensTable)
      .where(inArray(screensTable.id, screenIds));
    for (const s of details) screenDetailMap.set(s.id, { name: s.name, code: s.code, cnpj: s.cnpj, companyName: s.companyName, location: s.location });
  }

  const pricePerScreen = parseFloat(op.pricePerScreen ?? "50.00") || 50;
  const screenCount = screens.length;
  const effectiveMonthly = screenCount * pricePerScreen;

  const trialDaysLeft =
    op.subscriptionStatus === "trial" && op.trialEndsAt
      ? Math.max(0, Math.ceil((op.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  res.json({
    operatorName: op.name,
    operatorEmail: op.email ?? null,
    subscriptionStatus: op.subscriptionStatus,
    trialEndsAt: op.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    paymentMethod: op.paymentMethod ?? "pix",
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
    payments: payments.map((p) => {
      const sd = p.screenId !== null ? (screenDetailMap.get(p.screenId) ?? null) : null;
      return {
        ...p,
        screenName: sd?.name ?? null,
        screenCode: sd?.code ?? null,
        screenCnpj: sd?.cnpj ?? null,
        screenCompanyName: sd?.companyName ?? null,
        screenLocation: sd?.location ?? null,
        boletoUrl: p.boletoUrl ?? null,
        paidAt: p.paidAt?.toISOString() ?? null,
        dueDate: p.dueDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      };
    }),
  });
});

export default router;
