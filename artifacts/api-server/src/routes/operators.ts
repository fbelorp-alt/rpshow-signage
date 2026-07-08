import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import { db, operatorsTable, screensTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

const router = Router();

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores" });
    return;
  }
  next();
}

const safeFields = {
  id: operatorsTable.id,
  username: operatorsTable.username,
  name: operatorsTable.name,
  email: operatorsTable.email,
  phone: operatorsTable.phone,
  role: operatorsTable.role,
  createdAt: operatorsTable.createdAt,
  blocked: operatorsTable.blocked,
  subscriptionStatus: operatorsTable.subscriptionStatus,
  trialEndsAt: operatorsTable.trialEndsAt,
  trialDays: operatorsTable.trialDays,
  pricePerScreen: operatorsTable.pricePerScreen,
};

router.get("/", requireAdmin, async (_req, res) => {
  const ops = await db.select(safeFields).from(operatorsTable).orderBy(operatorsTable.createdAt);

  const screenCounts = await db
    .select({ operatorId: screensTable.userId, total: count() })
    .from(screensTable)
    .groupBy(screensTable.userId);
  const countMap = new Map(screenCounts.map((s) => [s.operatorId, s.total]));

  res.json(ops.map((op) => {
    const screenCount = countMap.get(String(op.id)) ?? 0;
    const price = parseFloat(op.pricePerScreen ?? "50.00");
    return {
      ...op,
      createdAt: op.createdAt.toISOString(),
      trialEndsAt: op.trialEndsAt?.toISOString() ?? null,
      pricePerScreen: op.pricePerScreen ?? "50.00",
      screenCount,
      monthlyAmount: (screenCount * price).toFixed(2),
    };
  }));
});

router.post("/", requireAdmin, async (req, res) => {
  const { username, password, name, role } = req.body as {
    username?: string; password?: string; name?: string; role?: string;
  };
  if (!username || !password || !name) {
    res.status(400).json({ error: "username, password e name são obrigatórios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }
  const existing = await db.select({ id: operatorsTable.id }).from(operatorsTable)
    .where(eq(operatorsTable.username, username.trim())).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Nome de usuário já existe" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [op] = await db.insert(operatorsTable).values({
    username: username.trim(),
    passwordHash,
    name: name.trim(),
    role: role === "admin" ? "admin" : "operator",
  }).returning(safeFields);
  res.status(201).json({ ...op, createdAt: op.createdAt.toISOString() });
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, role, email, phone } = req.body as {
    name?: string; role?: string; email?: string; phone?: string;
  };
  const updates: { name?: string; role?: string; email?: string | null; phone?: string | null } = {};
  if (name) updates.name = name.trim();
  if (role) updates.role = role === "admin" ? "admin" : "operator";
  if (email !== undefined) updates.email = email || null;
  if (phone !== undefined) updates.phone = phone || null;
  if (!Object.keys(updates).length) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }
  const [op] = await db.update(operatorsTable).set(updates)
    .where(eq(operatorsTable.id, id)).returning(safeFields);
  if (!op) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  res.json({ ...op, createdAt: op.createdAt.toISOString(), trialEndsAt: op.trialEndsAt?.toISOString() ?? null });
});

router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body as { password?: string };
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [op] = await db.update(operatorsTable).set({ passwordHash })
    .where(eq(operatorsTable.id, id)).returning({ id: operatorsTable.id });
  if (!op) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  res.json({ ok: true });
});

router.patch("/:id/blocked", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const selfId = Number(req.user?.id);
  if (id === selfId) {
    res.status(400).json({ error: "Você não pode bloquear sua própria conta" });
    return;
  }
  const { blocked } = req.body as { blocked: boolean };
  const [op] = await db.update(operatorsTable).set({ blocked })
    .where(eq(operatorsTable.id, id)).returning({ id: operatorsTable.id, blocked: operatorsTable.blocked });
  if (!op) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  res.json({ ok: true, blocked: op.blocked });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const selfId = Number(req.user?.id);
  if (id === selfId) {
    res.status(400).json({ error: "Você não pode excluir sua própria conta" });
    return;
  }
  const [target] = await db.select({ role: operatorsTable.role }).from(operatorsTable)
    .where(eq(operatorsTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  if (target.role === "admin") {
    const admins = await db.select({ id: operatorsTable.id }).from(operatorsTable)
      .where(eq(operatorsTable.role, "admin"));
    if (admins.length <= 1) {
      res.status(400).json({ error: "Não é possível excluir o único administrador" });
      return;
    }
  }
  await db.delete(operatorsTable).where(eq(operatorsTable.id, id));
  res.json({ ok: true });
});

export default router;
