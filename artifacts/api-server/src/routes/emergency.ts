import { Router } from "express";
import { db } from "@workspace/db";
import { emergencyAlertsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  return String((req.user as any).parentOperatorId ?? req.user.id);
}

// Get active alert for user
router.get("/active", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const now = new Date();
  const alerts = await db.select().from(emergencyAlertsTable)
    .where(and(eq(emergencyAlertsTable.userId, userId), eq(emergencyAlertsTable.isActive, true)));

  const expired = alerts.filter(a => a.expiresAt && a.expiresAt <= now);
  if (expired.length) {
    for (const a of expired) {
      await db.update(emergencyAlertsTable).set({ isActive: false }).where(eq(emergencyAlertsTable.id, a.id));
    }
  }

  const active = alerts.find(a => !a.expiresAt || a.expiresAt > now);
  res.json(active ?? null);
});

// List all alerts for the authenticated user
router.get("/", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const alerts = await db.select().from(emergencyAlertsTable)
    .where(eq(emergencyAlertsTable.userId, userId));
  res.json(alerts);
});

// Create emergency alert
router.post("/", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { message, bgColor, textColor, durationMinutes } = req.body as {
    message: string;
    bgColor?: string;
    textColor?: string;
    durationMinutes?: number;
  };

  if (!message?.trim()) { res.status(400).json({ error: "Mensagem obrigatória" }); return; }

  // Deactivate any existing active alert for this user first
  await db.update(emergencyAlertsTable).set({ isActive: false })
    .where(and(eq(emergencyAlertsTable.userId, userId), eq(emergencyAlertsTable.isActive, true)));

  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000)
    : null;

  const [alert] = await db.insert(emergencyAlertsTable).values({
    userId,
    message: message.trim(),
    bgColor: bgColor ?? "#DC2626",
    textColor: textColor ?? "#FFFFFF",
    isActive: true,
    expiresAt,
  }).returning();

  res.status(201).json(alert);
});

// Cancel alert — only the owning user can cancel
router.delete("/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  // Verify ownership before deactivating
  const [alert] = await db.select({ id: emergencyAlertsTable.id, userId: emergencyAlertsTable.userId })
    .from(emergencyAlertsTable)
    .where(eq(emergencyAlertsTable.id, id))
    .limit(1);

  if (!alert) { res.status(404).json({ error: "Alerta não encontrado" }); return; }
  if (alert.userId !== userId) { res.status(403).json({ error: "Sem permissão" }); return; }

  await db.update(emergencyAlertsTable).set({ isActive: false }).where(eq(emergencyAlertsTable.id, id));
  res.status(204).send();
});

export default router;
