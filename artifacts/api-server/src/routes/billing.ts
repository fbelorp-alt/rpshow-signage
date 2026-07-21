/**
 * PATCH — billing.ts
 * Corrige: cobranças do admin sumindo na página /financeiro do cliente.
 *
 * Bugs reais:
 * 1) Após fallback SQL, paidAt/dueDate/createdAt podem ser string → .toISOString() explode → 500
 *    e o front trata como lista vazia ("Nenhum pagamento registrado").
 * 2) catch engolia erro e devolvia payments=[] (cliente via vazio mesmo com fatura no banco).
 * 3) Telas no billing/me ignoravam vínculo legacy via devices (Minhas Telas mostrava, Financeiro não).
 */
import { Router, type Request, type Response } from "express";
import {
  db,
  operatorsTable,
  subscriptionPaymentsTable,
  screensTable,
  devicesTable,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

const router = Router();

const CLIENT_PAY_TYPES = ["pix", "boleto", "carteira"] as const;

function toIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function asNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function loadPaymentsForOperator(operatorId: number): Promise<{ payments: any[]; source: string }> {
  // Nível 1: ORM
  try {
    const payments = await db
      .select()
      .from(subscriptionPaymentsTable)
      .where(eq(subscriptionPaymentsTable.operatorId, operatorId))
      .orderBy(subscriptionPaymentsTable.referenceMonth);
    return { payments, source: "orm" };
  } catch (err1) {
    console.warn("[billing/me] ORM payments falhou, tentando SQL completo:", err1);
  }

  // Nível 2: SQL com colunas novas
  try {
    const raw = await db.execute(
      sql`SELECT id, operator_id as "operatorId", screen_id as "screenId",
               reference_month as "referenceMonth", status, amount, notes,
               paid_at as "paidAt", due_date as "dueDate", created_at as "createdAt",
               payment_type as "paymentType", boleto_url as "boletoUrl"
          FROM subscription_payments
          WHERE operator_id = ${operatorId}
          ORDER BY reference_month`
    );
    return { payments: ((raw as any).rows ?? raw ?? []) as any[], source: "sql-full" };
  } catch (err2) {
    console.warn("[billing/me] SQL completo falhou, tentando SQL mínimo:", err2);
  }

  // Nível 3: colunas mínimas (sem boleto_url / payment_type / screen_id / due_date)
  try {
    const raw = await db.execute(
      sql`SELECT id, operator_id as "operatorId",
               reference_month as "referenceMonth", status, amount, notes,
               paid_at as "paidAt", created_at as "createdAt"
          FROM subscription_payments
          WHERE operator_id = ${operatorId}
          ORDER BY reference_month`
    );
    const payments = ((raw as any).rows ?? raw ?? []).map((r: any) => ({
      ...r,
      screenId: null,
      dueDate: null,
      paymentType: null,
      boletoUrl: null,
    }));
    return { payments, source: "sql-min" };
  } catch (err3) {
    console.error("[billing/me] TODAS as queries de payments falharam:", err3);
    throw err3;
  }
}

router.get("/billing/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  const id = Number(req.user!.id);
  if (!Number.isFinite(id)) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }

  let op: typeof operatorsTable.$inferSelect | undefined;
  try {
    const rows = await db.select().from(operatorsTable).where(eq(operatorsTable.id, id)).limit(1);
    op = rows[0];
  } catch (err) {
    // Coluna nova pode não existir no VPS — tenta sem colunas opcionais
    try {
      const rows = await db
        .select({
          id: operatorsTable.id,
          username: operatorsTable.username,
          name: operatorsTable.name,
          email: operatorsTable.email,
          phone: operatorsTable.phone,
          subscriptionStatus: operatorsTable.subscriptionStatus,
          trialEndsAt: operatorsTable.trialEndsAt,
          trialDays: operatorsTable.trialDays,
          paymentMethod: operatorsTable.paymentMethod,
          monthlyAmount: operatorsTable.monthlyAmount,
          pricePerScreen: operatorsTable.pricePerScreen,
        })
        .from(operatorsTable)
        .where(eq(operatorsTable.id, id))
        .limit(1);
      op = rows[0] as typeof operatorsTable.$inferSelect | undefined;
    } catch (err2) {
      res.status(500).json({
        error: "Falha ao carregar dados do operador.",
        detail: String((err2 as Error)?.message ?? err2),
      });
      return;
    }
  }
  if (!op) {
    res.status(404).json({ error: "Operador não encontrado" });
    return;
  }

  let payments: any[] = [];
  let paymentsSource = "none";
  try {
    const loaded = await loadPaymentsForOperator(id);
    payments = loaded.payments;
    paymentsSource = loaded.source;
  } catch (err) {
    // NÃO engolir como lista vazia — isso fazia o cliente achar que não há cobrança
    res.status(500).json({
      error: "Falha ao carregar faturas. Contate o suporte.",
      detail: String((err as Error)?.message ?? err),
      operatorId: id,
    });
    return;
  }

  // Normaliza tipos (SQL pode devolver string/number)
  payments = payments.map((p: any) => ({
    ...p,
    id: asNum(p.id) ?? p.id,
    operatorId: asNum(p.operatorId) ?? id,
    screenId: asNum(p.screenId),
    referenceMonth: p.referenceMonth,
    status: p.status,
    amount: p.amount != null ? String(p.amount) : "0.00",
    notes: p.notes ?? null,
    paymentType: p.paymentType ?? null,
    boletoUrl: p.boletoUrl ?? null,
    paidAt: p.paidAt ?? null,
    dueDate: p.dueDate ?? null,
    createdAt: p.createdAt ?? null,
  }));

  // Telas: mesmo critério de Minhas Telas (userId + devices legacy)
  const userId = String(id);

  // devices.screen_code / user_id podem não existir no VPS — fallback silencioso
  let deviceCodes: string[] = [];
  try {
    const userDevices = await db
      .select({ screenCode: devicesTable.screenCode })
      .from(devicesTable)
      .where(and(eq(devicesTable.userId, userId), isNotNull(devicesTable.screenCode)));
    deviceCodes = userDevices.map((d) => d.screenCode!).filter(Boolean);
  } catch {
    try {
      const raw = await db.execute(
        sql`SELECT screen_code FROM devices WHERE user_id = ${userId} AND screen_code IS NOT NULL`
      );
      deviceCodes = ((raw as any).rows ?? raw ?? []).map((r: any) => r.screen_code).filter(Boolean);
    } catch {
      // devices table pode não ter essas colunas no VPS — ignora
    }
  }

  if (deviceCodes.length > 0) {
    try {
      await db
        .update(screensTable)
        .set({ userId })
        .where(and(isNull(screensTable.userId), inArray(screensTable.code, deviceCodes)));
    } catch {
      // fallback silencioso se update falhar
    }
  }

  const screenWhere =
    deviceCodes.length > 0
      ? or(
          eq(screensTable.userId, userId),
          and(isNull(screensTable.userId), inArray(screensTable.code, deviceCodes))
        )
      : eq(screensTable.userId, userId);

  let screens: any[] = [];
  try {
    screens = await db
      .select({
        id: screensTable.id,
        name: screensTable.name,
        location: screensTable.location,
        status: screensTable.status,
        code: screensTable.code,
        createdAt: screensTable.createdAt,
      })
      .from(screensTable)
      .where(screenWhere!);
  } catch {
    try {
      const raw = await db.execute(
        sql`SELECT id, name, location, status, code, created_at as "createdAt" FROM screens WHERE user_id = ${userId}`
      );
      screens = ((raw as any).rows ?? raw ?? []);
    } catch (err) {
      console.error("[billing/me] Falha ao buscar screens:", err);
    }
  }

  const screenIds = [
    ...new Set(payments.map((p) => p.screenId).filter((v: number | null): v is number => v !== null)),
  ];
  const screenDetailMap = new Map<
    number,
    { name: string; code: string; cnpj: string | null; companyName: string | null; location: string | null }
  >();
  if (screenIds.length > 0) {
    try {
      const details = await db
        .select({
          id: screensTable.id,
          name: screensTable.name,
          code: screensTable.code,
          cnpj: screensTable.cnpj,
          companyName: screensTable.companyName,
          location: screensTable.location,
        })
        .from(screensTable)
        .where(inArray(screensTable.id, screenIds));
      for (const s of details) {
        screenDetailMap.set(s.id, {
          name: s.name,
          code: s.code,
          cnpj: s.cnpj,
          companyName: s.companyName,
          location: s.location,
        });
      }
    } catch {
      // cnpj/company_name podem faltar no VPS — tenta sem essas colunas
      const details = await db
        .select({
          id: screensTable.id,
          name: screensTable.name,
          code: screensTable.code,
          location: screensTable.location,
        })
        .from(screensTable)
        .where(inArray(screensTable.id, screenIds));
      for (const s of details) {
        screenDetailMap.set(s.id, {
          name: s.name,
          code: s.code,
          cnpj: null,
          companyName: null,
          location: s.location,
        });
      }
    }
  }

  const pricePerScreen = parseFloat(op.pricePerScreen ?? "50.00") || 50;
  const screenCount = screens.length;
  const effectiveMonthly = screenCount * pricePerScreen;

  const trialEndsAtIso = toIso(op.trialEndsAt);
  const trialDaysLeft =
    op.subscriptionStatus === "trial" && trialEndsAtIso
      ? Math.max(0, Math.ceil((new Date(trialEndsAtIso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

  res.json({
    operatorId: id,
    operatorUsername: op.username,
    operatorName: op.name,
    operatorEmail: op.email ?? null,
    operatorPhone: op.phone ?? null,
    operatorCnpj: op.cnpj ?? null,
    subscriptionStatus: op.subscriptionStatus,
    trialEndsAt: trialEndsAtIso,
    trialDaysLeft,
    paymentMethod: op.paymentMethod ?? "pix",
    monthlyAmount: effectiveMonthly.toFixed(2),
    pricePerScreen: pricePerScreen.toFixed(2),
    screenCount,
    paymentsSource, // debug: orm | sql-full | sql-min
    screens: screens.map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location ?? null,
      status: s.status,
      code: s.code,
      monthlyPrice: pricePerScreen.toFixed(2),
      createdAt: toIso(s.createdAt) ?? new Date().toISOString(),
    })),
    payments: payments.map((p) => {
      const sid = p.screenId as number | null;
      const sd = sid !== null ? (screenDetailMap.get(sid) ?? null) : null;
      return {
        id: p.id,
        operatorId: p.operatorId,
        screenId: sid,
        referenceMonth: p.referenceMonth,
        status: p.status,
        amount: p.amount,
        notes: p.notes,
        paymentType: p.paymentType,
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

/**
 * Cliente escolhe forma de pagamento na fatura (PIX / Boleto / Carteira).
 * Não marca como pago.
 */
router.patch("/billing/me/payments/:paymentId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  const operatorId = Number(req.user!.id);
  const paymentId = Number(req.params["paymentId"]);
  const { paymentType } = req.body as { paymentType?: string };

  if (!paymentId || !CLIENT_PAY_TYPES.includes(paymentType as (typeof CLIENT_PAY_TYPES)[number])) {
    res.status(400).json({ error: "Forma inválida. Use: pix, boleto ou carteira" });
    return;
  }

  const [pay] = await db
    .select()
    .from(subscriptionPaymentsTable)
    .where(
      and(
        eq(subscriptionPaymentsTable.id, paymentId),
        eq(subscriptionPaymentsTable.operatorId, operatorId)
      )
    )
    .limit(1);

  if (!pay) {
    res.status(404).json({ error: "Fatura não encontrada" });
    return;
  }
  if (pay.status === "paid" || pay.status === "cancelled") {
    res.status(400).json({ error: "Esta fatura não pode mais mudar a forma de pagamento" });
    return;
  }

  try {
    await db
      .update(subscriptionPaymentsTable)
      .set({ paymentType })
      .where(eq(subscriptionPaymentsTable.id, paymentId));
  } catch {
    // Coluna payment_type pode faltar — tenta SQL
    await db.execute(
      sql`UPDATE subscription_payments SET payment_type = ${paymentType} WHERE id = ${paymentId} AND operator_id = ${operatorId}`
    );
  }

  res.json({ ok: true, paymentId, paymentType });
});

export default router;
